import { Player } from '@/core/player';
import { io } from '@/server/sockets';
export class Game {
    players;
    availableRoles = [];
    constructor() {
        this.players = new Map();
    }
    addPlayer(name, sid) {
        const player = new Player(name, sid);
        this.players.set(sid, player);
        return player;
    }
    initRolesList() {
        const playerCount = this.players.size;
        this.availableRoles = [];
        if (playerCount >= 4) {
            const werewolfCount = Math.floor(playerCount / 3) || 1;
            for (let i = 0; i < werewolfCount; i++) {
                this.availableRoles.push('WEREWOLF');
            }
            this.availableRoles.push('SEER');
            if (playerCount >= 6) {
                this.availableRoles.push('WITCH');
            }
            if (playerCount >= 8) {
                this.availableRoles.push('HUNTER');
                this.availableRoles.push('CUPID');
            }
            const remainingSlots = playerCount - this.availableRoles.length;
            for (let i = 0; i < remainingSlots; i++) {
                this.availableRoles.push('VILLAGER');
            }
        }
        else {
            for (let i = 0; i < this.players.size; i++) {
                this.availableRoles.push('VILLAGER');
            }
        }
    }
    getPlayerList() {
        return this.players;
    }
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    assignRoles() {
        this.initRolesList();
        const shuffledRoles = this.shuffleArray(this.availableRoles);
        for (const player of this.players.values()) {
            const role = shuffledRoles.pop();
            if (role) {
                console.log(`Assigning role ${role} to player ${player.name}`);
                player.assignRole(role);
            }
        }
    }
    alertPlayersOfRoles() {
        for (const player of this.players.values()) {
            const role = player.getRole();
            if (!role) {
                return;
            }
            io.to(player.getSid()).emit('role-assigned', role);
        }
    }
}
