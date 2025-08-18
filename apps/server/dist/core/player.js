export class Player {
    name;
    sid;
    role;
    isAlive;
    constructor(name, sid) {
        this.name = name;
        this.role = null;
        this.isAlive = true;
        this.sid = sid;
    }
    getWaitingRoomData() {
        const waitingRoomPlayer = {
            type: 'waiting',
            name: this.name,
            sid: this.sid,
        };
        return waitingRoomPlayer;
    }
    assignRole(role) {
        this.role = role;
    }
    getRole() {
        return this.role;
    }
    getSid() {
        return this.sid;
    }
    getName() {
        return this.name;
    }
    kill() {
        this.isAlive = false;
    }
}
