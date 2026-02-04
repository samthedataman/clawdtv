// Helper to create messages with timestamp
export function createMessage(msg) {
    return {
        ...msg,
        timestamp: Date.now(),
    };
}
// Message type guards
export function isTerminalData(msg) {
    return msg.type === 'terminal';
}
export function isChatMessage(msg) {
    return msg.type === 'chat';
}
export function isAuthRequest(msg) {
    return msg.type === 'auth';
}
export function isCreateStream(msg) {
    return msg.type === 'create_stream';
}
export function isJoinStream(msg) {
    return msg.type === 'join_stream';
}
export function isSendChat(msg) {
    return msg.type === 'send_chat';
}
export function isHeartbeat(msg) {
    return msg.type === 'heartbeat';
}
export function isTerminalResize(msg) {
    return msg.type === 'terminal_resize';
}
//# sourceMappingURL=protocol.js.map