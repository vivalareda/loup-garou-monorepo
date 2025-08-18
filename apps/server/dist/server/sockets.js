import { Server } from 'socket.io';
import { httpServer } from './http-server';
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        allowedHeaders: ['*'],
        credentials: true,
    },
    pingTimeout: 60_000,
    pingInterval: 25_000,
});
export { io };
