import { AuthToken, User, UserPublic } from '../shared/types';
import { DatabaseService } from './database';
export declare class AuthService {
    private jwtSecret;
    private jwtExpiresIn;
    private db;
    constructor(db: DatabaseService, jwtSecret: string, jwtExpiresIn?: string);
    hashPassword(password: string): Promise<string>;
    verifyPassword(password: string, hash: string): Promise<boolean>;
    generateToken(user: User): string;
    verifyToken(token: string): AuthToken | null;
    register(username: string, password: string, displayName?: string): Promise<{
        user: UserPublic;
        token: string;
    } | {
        error: string;
    }>;
    login(username: string, password: string): Promise<{
        user: UserPublic;
        token: string;
    } | {
        error: string;
    }>;
    getUserFromToken(token: string): User | null;
    validateToken(token: string): {
        valid: boolean;
        userId?: string;
        username?: string;
    };
}
//# sourceMappingURL=auth.d.ts.map