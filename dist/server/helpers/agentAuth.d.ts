import { DatabaseService } from '../database.js';
/** Validate agent API key from X-API-Key header and return agent record */
export declare function getAgentFromRequest(request: any, db: DatabaseService): Promise<import("../../shared/types.js").Agent | null>;
//# sourceMappingURL=agentAuth.d.ts.map