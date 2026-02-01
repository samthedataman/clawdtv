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
exports.AuthService = void 0;
const bcrypt = __importStar(require("bcrypt"));
const jwt = __importStar(require("jsonwebtoken"));
const config_1 = require("../shared/config");
class AuthService {
    jwtSecret;
    jwtExpiresIn;
    db;
    constructor(db, jwtSecret, jwtExpiresIn = '7d') {
        this.db = db;
        this.jwtSecret = jwtSecret;
        this.jwtExpiresIn = jwtExpiresIn;
    }
    async hashPassword(password) {
        return bcrypt.hash(password, config_1.BCRYPT_ROUNDS);
    }
    async verifyPassword(password, hash) {
        return bcrypt.compare(password, hash);
    }
    generateToken(user) {
        const payload = {
            userId: user.id,
            username: user.username,
        };
        return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
    }
    verifyToken(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            return decoded;
        }
        catch {
            return null;
        }
    }
    async register(username, password, displayName) {
        // Validate username
        if (!username || username.length < 3 || username.length > 20) {
            return { error: 'Username must be between 3 and 20 characters' };
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
            return { error: 'Username can only contain letters, numbers, underscores, and hyphens' };
        }
        // Validate password
        if (!password || password.length < 6) {
            return { error: 'Password must be at least 6 characters' };
        }
        // Check if username exists
        const existingUser = this.db.getUserByUsername(username);
        if (existingUser) {
            return { error: 'Username already taken' };
        }
        // Create user
        const passwordHash = await this.hashPassword(password);
        const user = this.db.createUser(username, passwordHash, displayName);
        const token = this.generateToken(user);
        return {
            user: this.db.toUserPublic(user),
            token,
        };
    }
    async login(username, password) {
        const user = this.db.getUserByUsername(username);
        if (!user) {
            return { error: 'Invalid username or password' };
        }
        const valid = await this.verifyPassword(password, user.passwordHash);
        if (!valid) {
            return { error: 'Invalid username or password' };
        }
        const token = this.generateToken(user);
        return {
            user: this.db.toUserPublic(user),
            token,
        };
    }
    getUserFromToken(token) {
        const decoded = this.verifyToken(token);
        if (!decoded) {
            return null;
        }
        return this.db.getUserById(decoded.userId);
    }
    validateToken(token) {
        const decoded = this.verifyToken(token);
        if (!decoded) {
            return { valid: false };
        }
        return {
            valid: true,
            userId: decoded.userId,
            username: decoded.username,
        };
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.js.map