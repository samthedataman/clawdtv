#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
// Stream state
let streamProcess = null;
let currentRoomId = null;
let viewerCount = 0;
const tools = [
    {
        name: 'stream_start',
        description: 'Start streaming your Claude Code session to claude.tv. Viewers can watch and chat in real-time.',
        inputSchema: {
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                    description: 'Title for the stream (default: "Claude Code Session")',
                },
                private: {
                    type: 'boolean',
                    description: 'Make stream private/unlisted (default: false)',
                },
            },
        },
    },
    {
        name: 'stream_stop',
        description: 'Stop the current stream',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'stream_status',
        description: 'Get current stream status including room ID and viewer count',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'stream_chat',
        description: 'Send a chat message to viewers',
        inputSchema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    description: 'Message to send to chat',
                },
            },
            required: ['message'],
        },
    },
    {
        name: 'stream_list',
        description: 'List all active streams on claude.tv',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
];
async function startStream(title = 'Claude Code Session', isPrivate = false) {
    if (streamProcess) {
        return 'Stream already running. Stop it first with stream_stop.';
    }
    return new Promise((resolve) => {
        const cliPath = path.join(__dirname, '..', 'index.js');
        const args = ['stream', title];
        if (isPrivate)
            args.push('--private');
        streamProcess = (0, child_process_1.spawn)('node', [cliPath, ...args], {
            stdio: ['pipe', 'pipe', 'pipe'],
            detached: true,
        });
        let output = '';
        streamProcess.stdout?.on('data', (data) => {
            output += data.toString();
            // Look for room ID in output
            const match = output.match(/Room ID:\s*(\S+)/);
            if (match) {
                currentRoomId = match[1];
            }
            const viewerMatch = output.match(/viewers?:\s*(\d+)/i);
            if (viewerMatch) {
                viewerCount = parseInt(viewerMatch[1]);
            }
        });
        streamProcess.stderr?.on('data', (data) => {
            output += data.toString();
        });
        streamProcess.on('close', () => {
            streamProcess = null;
            currentRoomId = null;
            viewerCount = 0;
        });
        // Give it a moment to start
        setTimeout(() => {
            if (currentRoomId) {
                resolve(`Stream started! Room ID: ${currentRoomId}\nShare URL: https://claude-tv.onrender.com (then run: claude-tv watch ${currentRoomId})`);
            }
            else {
                resolve('Stream starting... Check status in a moment.');
            }
        }, 2000);
    });
}
function stopStream() {
    if (!streamProcess) {
        return 'No stream is currently running.';
    }
    streamProcess.kill('SIGTERM');
    streamProcess = null;
    const roomId = currentRoomId;
    currentRoomId = null;
    viewerCount = 0;
    return `Stream stopped.${roomId ? ` (was room: ${roomId})` : ''}`;
}
function getStatus() {
    if (!streamProcess) {
        return 'No stream running. Use stream_start to begin streaming.';
    }
    return `Stream active!
Room ID: ${currentRoomId || 'connecting...'}
Viewers: ${viewerCount}
Watch URL: claude-tv watch ${currentRoomId || '<room-id>'}`;
}
async function listStreams() {
    try {
        const response = await fetch('https://claude-tv.onrender.com/api/streams');
        const result = await response.json();
        if (!result.success || !result.data?.streams?.length) {
            return 'No active streams right now.';
        }
        const streams = result.data.streams;
        let output = `${streams.length} active stream(s):\n\n`;
        for (const stream of streams) {
            output += `- "${stream.title}" by ${stream.ownerUsername}\n`;
            output += `  Viewers: ${stream.viewerCount} | Room: ${stream.id}\n`;
            output += `  Watch: claude-tv watch ${stream.id}\n\n`;
        }
        return output;
    }
    catch (error) {
        return `Error fetching streams: ${error}`;
    }
}
async function sendChat(message) {
    if (!streamProcess || !currentRoomId) {
        return 'No active stream. Start one first with stream_start.';
    }
    // Send to stdin of the stream process
    if (streamProcess.stdin) {
        // The broadcaster chat uses special commands
        streamProcess.stdin.write(`/say ${message}\n`);
        return `Sent to chat: ${message}`;
    }
    return 'Could not send message - stream stdin not available.';
}
// Create MCP server
const server = new index_js_1.Server({
    name: 'claude-tv',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
// List tools handler
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
    return { tools };
});
// Call tool handler
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        let result;
        switch (name) {
            case 'stream_start':
                result = await startStream(args?.title || 'Claude Code Session', args?.private || false);
                break;
            case 'stream_stop':
                result = stopStream();
                break;
            case 'stream_status':
                result = getStatus();
                break;
            case 'stream_chat':
                result = await sendChat(args?.message || '');
                break;
            case 'stream_list':
                result = await listStreams();
                break;
            default:
                result = `Unknown tool: ${name}`;
        }
        return {
            content: [{ type: 'text', text: result }],
        };
    }
    catch (error) {
        return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
        };
    }
});
// Start server
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('claude-tv MCP server running');
}
main().catch(console.error);
//# sourceMappingURL=index.js.map