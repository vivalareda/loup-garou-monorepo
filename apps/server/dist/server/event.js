import { io } from '@/server/sockets';
const MAX_PLAYERCOUNT = 2;
export class GameEvents {
    game;
    constructor(game) {
        this.game = game;
    }
    setupSocketHandlers() {
        io.on('connection', (socket) => {
            socket.on('new-player', (name) => {
                const player = this.game.addPlayer(name, socket.id);
                socket.emit('player-registered', player.getWaitingRoomData());
                socket.broadcast.emit('new-player-joined', player.name);
                if (this.game.getPlayerList().size >= MAX_PLAYERCOUNT) {
                    this.game.assignRoles();
                    this.game.alertPlayersOfRoles();
                }
            });
            socket.on('disconnect', () => {
                console.log('Player disconnected:', socket.id);
            });
            this.setupGettersEvents(socket);
        });
    }
    setupGettersEvents(socket) {
        socket.on('get-waiting-room-names', () => {
            const playersArray = Array.from(this.game.getPlayerList().values()).map((player) => player.name);
            socket.emit('waiting-room-names', playersArray);
        });
    }
}
