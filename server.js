const { createServer } = require('node:http');
const { createReadStream, existsSync, statSync } = require('node:fs');
const { extname, relative, resolve, sep } = require('node:path');
const { randomBytes, randomUUID, createHash } = require('node:crypto');

const root = resolve(__dirname);
const port = Number(process.env.PORT || 8000);
const maxMessageBytes = 64 * 1024;
const maxClients = 128;
const maxRooms = 32;
const maxMessagesPerWindow = 240;
const teamMissionIds = new Set([
  'team-mars-rover-recovery',
  'team-lunar-relay',
  'team-europa-rescue'
]);
const rooms = new Map();
const clients = new Set();

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.m4v': 'video/mp4',
  '.mov': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function send(client, message) {
  if (client.readyState !== 1) return;
  const body = Buffer.from(JSON.stringify(message));
  const header = body.length < 126
    ? Buffer.from([0x81, body.length])
    : body.length < 65536
      ? Buffer.from([0x81, 126, body.length >> 8, body.length & 0xff])
      : null;
  if (!header) {
    client.socket.destroy();
    return;
  }
  client.socket.write(Buffer.concat([header, body]));
}

function roomSnapshot(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    missionId: room.missionId,
    players: [...room.players.values()].map(({ id, name }) => ({ id, name }))
  };
}

function broadcastRoom(room) {
  const message = { type: 'room-update', room: roomSnapshot(room) };
  for (const player of room.players.values()) send(player, message);
}

function fail(client, message) {
  send(client, { type: 'error', message });
}

function leaveRoom(client) {
  const room = client.room;
  if (!room) return;
  room.players.delete(client.id);
  client.room = null;
  if (room.hostId === client.id || room.players.size === 0) {
    for (const player of room.players.values()) {
      player.room = null;
      send(player, { type: 'room-closed', message: 'The team leader left the room.' });
    }
    rooms.delete(room.code);
    return;
  }
  broadcastRoom(room);
}

function roomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from(randomBytes(6), (value) => alphabet[value % alphabet.length]).join('');
  } while (rooms.has(code));
  return code;
}

function broadcastPeers(client, message) {
  const room = client.room;
  if (!room) return;
  for (const player of room.players.values()) {
    if (player.id !== client.id) send(player, { ...message, playerId: client.id });
  }
}

function handleMessage(client, message) {
  if (!message || typeof message.type !== 'string') return;

  if (message.type === 'create') {
    if (client.room) return fail(client, 'Leave your current team before creating another.');
    if (rooms.size >= maxRooms) return fail(client, 'The team server is full. Try again later.');
    const name = typeof message.name === 'string' ? message.name.trim().slice(0, 20) : '';
    if (!name) return fail(client, 'Enter a pilot name first.');
    const room = { code: roomCode(), hostId: client.id, players: new Map(), missionId: null };
    client.name = name;
    client.room = room;
    room.players.set(client.id, client);
    rooms.set(room.code, room);
    send(client, { type: 'joined', playerId: client.id, room: roomSnapshot(room) });
    return;
  }

  if (message.type === 'join') {
    if (client.room) return fail(client, 'Leave your current team before joining another.');
    const code = typeof message.code === 'string' ? message.code.trim().toUpperCase() : '';
    const room = rooms.get(code);
    if (!room) return fail(client, 'That team code was not found.');
    if (room.missionId) return fail(client, 'That team has already started a mission.');
    if (room.players.size >= 4) return fail(client, 'That team is full (maximum 4 players).');
    const name = typeof message.name === 'string' ? message.name.trim().slice(0, 20) : '';
    if (!name) return fail(client, 'Enter a pilot name first.');
    client.name = name;
    client.room = room;
    room.players.set(client.id, client);
    send(client, { type: 'joined', playerId: client.id, room: roomSnapshot(room) });
    broadcastRoom(room);
    return;
  }

  if (message.type === 'leave') {
    leaveRoom(client);
    return;
  }

  const room = client.room;
  if (!room) return fail(client, 'Join a team before sending mission updates.');

  if (message.type === 'start-mission') {
    if (client.id !== room.hostId) return fail(client, 'Only the team leader can select a mission.');
    if (!teamMissionIds.has(message.missionId)) return fail(client, 'Choose a valid Team Mission.');
    room.missionId = message.missionId;
    broadcastPeers(client, { type: 'start-mission', missionId: room.missionId });
    return;
  }

  if (message.type === 'launch') {
    if (client.id !== room.hostId) return fail(client, 'Only the team leader can launch the mission.');
    broadcastPeers(client, { type: 'launch' });
    return;
  }

  if (message.type === 'abort-mission') {
    if (client.id !== room.hostId) return fail(client, 'Only the team leader can abort the mission.');
    broadcastPeers(client, { type: 'abort-mission' });
    room.missionId = null;
    broadcastRoom(room);
    return;
  }

  if (message.type === 'pose') {
    if (![message.x, message.y, message.z, message.yaw, message.pitch].every(Number.isFinite)) return;
    broadcastPeers(client, {
      type: 'pose',
      x: Math.max(-2000, Math.min(2000, message.x)),
      y: Math.max(-2000, Math.min(2000, message.y)),
      z: Math.max(-2000, Math.min(2000, message.z)),
      yaw: message.yaw,
      pitch: message.pitch
    });
    return;
  }

  if (message.type === 'action') {
    if (!Number.isInteger(message.interactableIndex) || message.interactableIndex < 0 || message.interactableIndex > 200) return;
    broadcastPeers(client, { type: 'action', interactableIndex: message.interactableIndex });
    return;
  }

  if (message.type === 'finish-request') {
    if (client.id === room.hostId) return;
    const host = room.players.get(room.hostId);
    if (host) send(host, { type: 'finish-request', playerId: client.id });
    return;
  }

  if (message.type === 'mission-finished') {
    if (client.id !== room.hostId) return fail(client, 'Only the team leader can end the mission.');
    broadcastPeers(client, { type: 'mission-finished' });
    room.missionId = null;
    broadcastRoom(room);
  }
}

function parseFrames(client, chunk) {
  client.buffer = Buffer.concat([client.buffer, chunk]);
  while (client.buffer.length >= 2) {
    const first = client.buffer[0];
    const second = client.buffer[1];
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    let offset = 2;
    if (!masked || (first & 0x80) === 0) {
      client.socket.destroy();
      return;
    }
    if (length === 126) {
      if (client.buffer.length < 4) return;
      length = client.buffer.readUInt16BE(2);
      offset = 4;
    } else if (length === 127) {
      client.socket.destroy();
      return;
    }
    if (length > maxMessageBytes) {
      client.socket.destroy();
      return;
    }
    if (client.buffer.length < offset + 4 + length) return;
    const mask = client.buffer.subarray(offset, offset + 4);
    offset += 4;
    const payload = Buffer.from(client.buffer.subarray(offset, offset + length));
    for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    client.buffer = client.buffer.subarray(offset + length);

    if (opcode === 8) {
      if (payload.length <= 125) {
        client.socket.end(Buffer.concat([Buffer.from([0x88, payload.length]), payload]));
      } else {
        client.socket.destroy();
      }
      return;
    }
    if (opcode === 9) {
      client.socket.write(Buffer.from([0x8a, 0x00]));
      continue;
    }
    if (opcode !== 1) continue;
    const now = Date.now();
    if (now - client.messageWindowStarted > 10000) {
      client.messageWindowStarted = now;
      client.messageCount = 0;
    }
    client.messageCount++;
    if (client.messageCount > maxMessagesPerWindow) {
      client.socket.destroy();
      return;
    }
    let message;
    try {
      message = JSON.parse(payload.toString('utf8'));
    } catch {
      fail(client, 'Invalid team message.');
      continue;
    }
    handleMessage(client, message);
  }
}

const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  let requested;
  try {
    requested = pathname === '/' ? '/index/main.html' : decodeURIComponent(pathname);
    if (requested.startsWith('/css/')) {
      requested = `/index${requested}`;
    }
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Invalid path');
    return;
  }
  const filePath = resolve(root, `.${requested}`);
  const relativePath = relative(root, filePath);
  const fileStat = existsSync(filePath) ? statSync(filePath) : null;
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) ||
      !fileStat || !fileStat.isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  const headers = {
    'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
    'Content-Length': fileStat.size,
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff'
  };
  const range = request.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) {
      response.writeHead(416, {
        ...headers,
        'Content-Length': 0,
        'Content-Range': `bytes */${fileStat.size}`
      });
      response.end();
      return;
    }
    let start = match[1] ? Number(match[1]) : null;
    let end = match[2] ? Number(match[2]) : null;
    if (start === null) {
      start = Math.max(0, fileStat.size - end);
      end = fileStat.size - 1;
    } else {
      end = end === null ? fileStat.size - 1 : Math.min(end, fileStat.size - 1);
    }
    if (start >= fileStat.size || start > end) {
      response.writeHead(416, {
        ...headers,
        'Content-Length': 0,
        'Content-Range': `bytes */${fileStat.size}`
      });
      response.end();
      return;
    }
    headers['Content-Length'] = end - start + 1;
    headers['Content-Range'] = `bytes ${start}-${end}/${fileStat.size}`;
    response.writeHead(206, headers);
    if (request.method !== 'HEAD') createReadStream(filePath, { start, end }).pipe(response);
    else response.end();
    return;
  }
  response.writeHead(200, headers);
  if (request.method !== 'HEAD') createReadStream(filePath).pipe(response);
  else response.end();
});

server.on('upgrade', (request, socket) => {
  if (new URL(request.url, 'http://localhost').pathname !== '/multiplayer') {
    socket.destroy();
    return;
  }
  if (clients.size >= maxClients) {
    socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
    return;
  }
  if (request.headers.origin) {
    try {
      if (new URL(request.headers.origin).host !== request.headers.host) {
        socket.destroy();
        return;
      }
    } catch {
      socket.destroy();
      return;
    }
  }
  const key = request.headers['sec-websocket-key'];
  if (typeof key !== 'string' || request.headers.upgrade?.toLowerCase() !== 'websocket') {
    socket.destroy();
    return;
  }
  const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '',
    ''
  ].join('\r\n'));

  const client = {
    id: randomUUID(),
    name: '',
    room: null,
    socket,
    buffer: Buffer.alloc(0),
    readyState: 1,
    messageWindowStarted: Date.now(),
    messageCount: 0
  };
  clients.add(client);
  socket.on('data', (chunk) => parseFrames(client, chunk));
  socket.on('close', () => {
    client.readyState = 3;
    clients.delete(client);
    leaveRoom(client);
  });
  socket.on('error', () => {
    client.readyState = 3;
    clients.delete(client);
    leaveRoom(client);
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Junior Space Academy server listening on http://localhost:${port}`);
  console.log('For remote play, expose this host on a reachable network; use HTTPS/WSS behind a TLS reverse proxy.');
});

process.on('SIGINT', () => {
  for (const client of clients) client.socket.destroy();
  server.close(() => process.exit(0));
});
