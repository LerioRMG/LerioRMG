import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    socket = io(`${base}/realtime`, {
      withCredentials: true,
      transports: ['websocket'],
    });
  }
  return socket;
}
