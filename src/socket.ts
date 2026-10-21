import { io, Socket } from 'socket.io-client';

// Use same origin in browser (port 3000 where Express + Socket.io runs)
export const socket: Socket = io({
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});
