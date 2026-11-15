# Online team missions

Team play uses a six-character room code. The room creator is the team leader and selects and launches a Team Mission. Up to four players can join; movement and mission interactions are relayed to everyone in the room. Single Player missions are unchanged, and Team Missions can still be launched without joining a room.

## Run locally

Use Node.js 18 or later:

```sh
node server.js
```

Open `http://localhost:8000/index/main.html` and have other devices on the same network use the host computer's LAN address, for example `http://192.168.1.20:8000/index/main.html`. Allow inbound TCP port 8000 through the host firewall.

### Share from a home network

To let players on a different Wi-Fi or mobile network connect through your home internet:

1. Give the host computer a reserved LAN address in your router's DHCP settings so it does not change.
2. Add a router port-forward rule for **TCP port 8000** to that computer's LAN address on port **8000**.
3. Allow inbound TCP port 8000 through the host computer's firewall.
4. Find your router's public WAN IPv4 address and share `http://PUBLIC_IP:8000/index/main.html`. Test from a phone with Wi-Fi turned off; some routers do not let devices reach their public address from inside the same Wi-Fi.

The server already listens on all network interfaces, and the game and multiplayer WebSocket relay use the same port. If your public IP changes, the link changes too; a dynamic DNS service can provide a stable hostname. If the router's WAN address is in `10.x.x.x`, `192.168.x.x`, `172.16.x.x`-`172.31.x.x`, or `100.64.x.x`-`100.127.x.x`, another router or carrier-grade NAT may be in front of it. Port forwarding may then require configuring the upstream router or asking your ISP for a public IP. Render hosting is an alternative when inbound connections cannot be forwarded.

Port forwarding exposes this server to the public internet over plain HTTP. The relay has no accounts or authentication, so only share it with people you trust; use the HTTPS deployment below for a public-facing game.

## Play over the internet

### Deploy on Render

The repository includes a Render Blueprint and Node.js start script:

1. Push the project to a GitHub repository.
2. In the [Render Dashboard](https://dashboard.render.com), create a new Blueprint instance and connect that repository. Render reads `render.yaml` and deploys the web service.
3. Open the public service URL followed by `/index/main.html`, for example `https://your-service.onrender.com/index/main.html`.

The Blueprint selects Render's free service plan. Free services can spin down when idle and may take about a minute to start again; active room state is lost when the server stops. Render provides HTTPS and supports WebSocket upgrades on the same web service, so the game and `/multiplayer` relay use the same public URL. Players outside your Wi-Fi can use that HTTPS URL; the local `192.168.x.x` address only works on the same network.

For other Node.js hosts, run `npm start` and use the host-provided `PORT`. Serve the site over HTTPS and proxy `/multiplayer` WebSocket upgrades to the same Node.js process.

Room state is held in memory by one server process. Rooms disappear when that process restarts, and this simple relay does not provide accounts or authoritative anti-cheat validation. Use a single server instance unless room state is moved to shared storage.
