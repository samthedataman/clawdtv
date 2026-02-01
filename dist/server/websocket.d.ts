import { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { AuthService } from './auth';
import { RoomManager } from './rooms';
import { DatabaseService } from './database';
export declare class WebSocketHandler {
    private wss;
    private auth;
    private rooms;
    private db;
    private clients;
    private heartbeatInterval;
    constructor(auth: AuthService, rooms: RoomManager, db: DatabaseService);
    private setupHeartbeat;
    getServer(): WebSocketServer;
    handleUpgrade(request: IncomingMessage, socket: any, head: Buffer): void;
    private handleConnection;
    private handleMessage;
    private handleAuth;
    private handleCreateStream;
    private handleJoinStream;
    private handleSendChat;
    private handleChatCommand;
    private handleModCommand;
    private handleTerminalData;
    private handleTerminalResize;
    private handleDisconnect;
    private send;
    private sendError;
    private getUserRole;
    private findUserInRoom;
    private broadcastModAction;
    shutdown(): void;
}
//# sourceMappingURL=websocket.d.ts.map