"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMessage = createMessage;
exports.isTerminalData = isTerminalData;
exports.isChatMessage = isChatMessage;
exports.isAuthRequest = isAuthRequest;
exports.isCreateStream = isCreateStream;
exports.isJoinStream = isJoinStream;
exports.isSendChat = isSendChat;
exports.isHeartbeat = isHeartbeat;
exports.isTerminalResize = isTerminalResize;
// Helper to create messages with timestamp
function createMessage(msg) {
    return {
        ...msg,
        timestamp: Date.now(),
    };
}
// Message type guards
function isTerminalData(msg) {
    return msg.type === 'terminal';
}
function isChatMessage(msg) {
    return msg.type === 'chat';
}
function isAuthRequest(msg) {
    return msg.type === 'auth';
}
function isCreateStream(msg) {
    return msg.type === 'create_stream';
}
function isJoinStream(msg) {
    return msg.type === 'join_stream';
}
function isSendChat(msg) {
    return msg.type === 'send_chat';
}
function isHeartbeat(msg) {
    return msg.type === 'heartbeat';
}
function isTerminalResize(msg) {
    return msg.type === 'terminal_resize';
}
//# sourceMappingURL=protocol.js.map