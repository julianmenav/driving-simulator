import { Server } from 'colyseus';
import { RaceRoom } from './rooms/RaceRoom';

// Railway (and most hosts) inject PORT; default to Colyseus's 2567 locally.
const port = Number(process.env.PORT ?? 2567);

// `new Server()` auto-creates the WebSocket transport and serves the
// matchmaking HTTP routes (with permissive CORS by default — fine for the MVP).
const gameServer = new Server();

// `filterBy(['code'])` routes `client.join('race', { code })` to the room whose
// creator passed that code, giving us human-friendly join codes for free.
gameServer.define('race', RaceRoom).filterBy(['code']);

gameServer
  .listen(port)
  .then(() => console.log(`🏁 Race server listening on :${port}`))
  .catch((error) => {
    console.error('Failed to start race server', error);
    process.exit(1);
  });
