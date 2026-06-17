/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** WebSocket endpoint of the multiplayer server (ws:// local/LAN, wss:// prod). */
  readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
