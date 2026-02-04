import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { BCRYPT_ROUNDS } from '../shared/config.js';
export class AuthService {
    jwtSecret;
    jwtExpiresIn;
    db;
    constructor(db, jwtSecret, jwtExpiresIn = '7d') {
        this.db = db;
        this.jwtSecret = jwtSecret;
        this.jwtExpiresIn = jwtExpiresIn;
    }
    async hashPassword(password) {
        return bcrypt.hash(password, BCRYPT_ROUNDS);
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
        const existingUser = await this.db.getUserByUsername(username);
        if (existingUser) {
            return { error: 'Username already taken' };
        }
        // Create user
        const passwordHash = await this.hashPassword(password);
        const user = await this.db.createUser(username, passwordHash, displayName);
        const token = this.generateToken(user);
        return {
            user: this.db.toUserPublic(user),
            token,
        };
    }
    async login(username, password) {
        const user = await this.db.getUserByUsername(username);
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
    async getUserFromToken(token) {
        const decoded = this.verifyToken(token);
        if (!decoded) {
            return null;
        }
        return await this.db.getUserById(decoded.userId);
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
//# sourceMappingURL=auth.js.map