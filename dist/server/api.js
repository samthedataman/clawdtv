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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pendingJoinRequests = exports.roomRules = void 0;
exports.createApi = createApi;
const fastify_1 = __importDefault(require("fastify"));
const view_1 = __importDefault(require("@fastify/view"));
const static_1 = __importDefault(require("@fastify/static"));
const eta_1 = require("eta");
const path = __importStar(require("path"));
const auth_1 = require("./routes/auth");
const discovery_1 = require("./routes/discovery");
const agent_1 = require("./routes/agent");
const broadcast_1 = require("./routes/broadcast");
const watching_1 = require("./routes/watching");
const utility_1 = require("./routes/utility");
const pages_1 = require("./routes/pages");
const assets_1 = require("./routes/assets");
// Shared state maps that routes need access to
exports.roomRules = new Map();
exports.pendingJoinRequests = new Map();
function createApi(db, auth, rooms) {
    const fastify = (0, fastify_1.default)({ logger: false });
    // Register view engine (Eta templates)
    const templatesDir = path.join(__dirname, '../../templates');
    const eta = new eta_1.Eta({ views: templatesDir });
    fastify.register(view_1.default, {
        engine: { eta },
        root: templatesDir,
        viewExt: 'eta',
    });
    // Register static file serving
    fastify.register(static_1.default, {
        root: path.join(__dirname, '../../public'),
        prefix: '/',
    });
    // Helper functions for SSE that routes need
    const broadcastSSE = (roomId, eventType, data, excludeAgentId) => {
        rooms.broadcastSSE(roomId, eventType, data, excludeAgentId);
    };
    const removeSSESubscriber = (roomId, agentId) => {
        rooms.removeSSESubscriber(roomId, agentId);
    };
    // Register all route modules
    (0, auth_1.registerAuthRoutes)(fastify, db, auth);
    (0, discovery_1.registerDiscoveryRoutes)(fastify, db, rooms, exports.roomRules);
    (0, agent_1.registerAgentRoutes)(fastify, db, auth, rooms, exports.roomRules);
    (0, broadcast_1.registerBroadcastRoutes)(fastify, db, auth, rooms, exports.roomRules, exports.pendingJoinRequests);
    (0, watching_1.registerWatchingRoutes)(fastify, db, auth, rooms, exports.roomRules, exports.pendingJoinRequests, broadcastSSE, removeSSESubscriber);
    (0, utility_1.registerUtilityRoutes)(fastify, db, rooms);
    (0, pages_1.registerPageRoutes)(fastify, db, rooms, exports.roomRules);
    (0, assets_1.registerAssetRoutes)(fastify);
    return fastify;
}
//# sourceMappingURL=api.js.map