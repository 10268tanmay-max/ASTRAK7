export class TeamNetwork {
  constructor(handlers) {
    this.handlers = handlers;
    this.socket = null;
    this.playerId = null;
    this.room = null;
  }

  connect(message) {
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) {
      this.socket.close();
    }
    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${scheme}//${window.location.host}/multiplayer`);
    this.socket = socket;
    socket.addEventListener('open', () => socket.send(JSON.stringify(message)), { once: true });
    socket.addEventListener('message', (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        this.handlers.onError('Received an invalid message from the team server.');
        return;
      }
      this.handleMessage(data);
    });
    socket.addEventListener('error', () => {
      this.handlers.onError('Could not reach the multiplayer server. Check that the host is running and reachable.');
    });
    socket.addEventListener('close', () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.playerId = null;
      this.room = null;
      this.handlers.onDisconnected();
    });
  }

  create(name) {
    this.connect({ type: 'create', name });
  }

  join(name, code) {
    this.connect({ type: 'join', name, code });
  }

  leave() {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'leave' }));
      this.room = null;
      this.handlers.onRoomChanged(null, this.playerId);
    }
  }

  close() {
    this.socket?.close();
    this.socket = null;
    this.playerId = null;
    this.room = null;
  }

  send(message) {
    if (this.socket?.readyState !== WebSocket.OPEN || !this.room) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  startMission(missionId) {
    return this.send({ type: 'start-mission', missionId });
  }

  launch() {
    return this.send({ type: 'launch' });
  }

  abortMission() {
    return this.send({ type: 'abort-mission' });
  }

  sendPose(pos, yaw, pitch) {
    return this.send({ type: 'pose', x: pos.x, y: pos.y, z: pos.z, yaw, pitch });
  }

  sendAction(interactableIndex) {
    return this.send({ type: 'action', interactableIndex });
  }

  requestFinish() {
    return this.send({ type: 'finish-request' });
  }

  finishMission() {
    return this.send({ type: 'mission-finished' });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'joined':
        this.playerId = message.playerId;
        this.room = message.room;
        this.handlers.onRoomChanged(this.room, this.playerId);
        break;
      case 'room-update':
        this.room = message.room;
        this.handlers.onRoomChanged(this.room, this.playerId);
        break;
      case 'room-closed':
        this.room = null;
        this.handlers.onRoomClosed(message.message);
        break;
      case 'start-mission':
        this.handlers.onStartMission(message.missionId);
        break;
      case 'launch':
        this.handlers.onLaunch();
        break;
      case 'pose':
        this.handlers.onPose(message);
        break;
      case 'action':
        this.handlers.onAction(message.interactableIndex);
        break;
      case 'finish-request':
        this.handlers.onFinishRequest();
        break;
      case 'mission-finished':
        this.handlers.onMissionFinished();
        break;
      case 'abort-mission':
        this.handlers.onAbortMission();
        break;
      case 'error':
        this.handlers.onError(message.message);
        break;
      default:
        this.handlers.onError('Received an unsupported message from the team server.');
    }
  }
}
