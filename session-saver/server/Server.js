import { WebSocketServer } from "ws";
import Session from "./Session/Session.js";
import chalk from "chalk"

class Server {
    constructor() {
        this.wss = new WebSocketServer({
            // compression, don't touch
            perMessageDeflate: {
                zlibDeflateOptions: {
                    chunkSize: 1024,
                    memLevel: 7,
                    level: 9
                },
                zlibInflateOptions: {
                    chunkSize: 10 * 1024
                },
                clientNoContextTakeover: true,
                serverNoContextTakeover: true,
                serverMaxWindowBits: 10,
                concurrencyLimit: 10,
                threshold: 1024
            },
            port: 3000
        }, () => {
            console.log("Server Started!");
            this.bindListeners();
        });

        this.sessions = {};
        this.sessionIdIndex = 0;
        this.clients = new Set();
    }

    init() {
        console.log(chalk
            .underline.bgYellowBright.bold.italic("SESSION SAVER ~ By BlueLatios")
        );
    }

    bindListeners() {
        this.wss.on("connection", (socket) => {
            this.clients.add(socket);

            socket.on("message", (message) => {
                this.handleMessage(this.decodePacket(message), socket);
            });

            socket.on("close", () => {
                if (!socket.connectedSession) return;

                const session = socket.connectedSession;
                session.connectedClients = session.connectedClients.filter(client => client !== socket);
                this.clients.delete(socket);
            });
        })
    }

    handleMessage(packet, socket) {
        const { type, ...rest } = packet;
    
        const handlers = {
            "CreateSession": this.handleCreateSession,
            "JoinSession": this.handleJoinSession,
            "GetSessions": this.handleGetSessions,
            "CloseSession": this.handleCloseSession,
            "ClientRpc": this.handleClientRpc,
            "ClientInput": this.handleClientInput,
            "ToggleScript": this.handleScriptToggle
        };
    
        const handler = handlers[type];
        if (handler) {
            handler.call(this, rest, socket);
        } else {
            console.error(`Unknown message type: ${type}`);
        }
    }

    handleCreateSession(data) {
        const sessionId = this.sessionIdIndex += 1;
        const session = new Session(data.sessionName, {
            serverId: data.serverId,
            name: data.name,
            psk: data.partyKey,
            sessionId: sessionId,
            rootServer: this
        });

        this.sessions[sessionId] = session;
    }

    handleJoinSession(data, socket) {
        const requestedSession = this.sessions[data.id];
        if (!requestedSession) return;

        requestedSession.connectedClients.push(socket);
        socket.connectedSession = requestedSession;
        const syncWorldData = requestedSession.sendWorldSyncData();
        const payload = {
            type: "SyncWorldData",
            ...syncWorldData
        };
        this.sendPacket(socket, payload);
    }

    handleGetSessions(socket) {
        this.sendSessionList(socket);
    }

    handleCloseSession(data) {
        const requestedSession = this.sessions[data.id];
        if (!requestedSession) return;

        requestedSession.socket.terminate();
    }

    handleClientRpc(data, socket) {
        const connectedSession = socket.connectedSession;
        if (!connectedSession) return;

        connectedSession.sendRpc(data.rpc);
    }

    handleClientInput(data, socket) {
        const connectedSession = socket.connectedSession;
        if (!connectedSession) return;

        connectedSession.sendInput(data.input);
    }

    handleScriptToggle(data, socket) {
        const connectedSession = socket.connectedSession;
        if (!connectedSession) return;

        connectedSession.toggleScript(data.scriptName);
    }

    sendSessionList() {
        const sessions = [];
        for (const sessionId in this.sessions) {
            const sessionInfo = this.sessions[sessionId];
            sessions.push({
                sessionName: sessionInfo.sessionName,
                sessionId: sessionInfo.id,
                serverId: sessionInfo.serverId,
                playerInfo: sessionInfo.sessionData.myPlayer
            });
        }

        for (const client of this.clients) {
            this.sendPacket(client, {
                type: "SessionList",
                sessions: sessions
            });
        }
    }

    decodePacket(packet) {
        // add schematics
        if (typeof packet !== "object") return;
        return JSON.parse(packet);
    }

    encodePacket(packet) {
        return JSON.stringify(packet);
    }

    sendPacket(socket, packet) {
        socket.send(JSON.stringify(packet));
    }
}

export default Server;