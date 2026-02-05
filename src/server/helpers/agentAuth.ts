import { DatabaseService } from '../database.js';

/** Validate agent API key from X-API-Key header and return agent record */
export async function getAgentFromRequest(request: any, db: DatabaseService) {
  const apiKey = request.headers['x-api-key'] as string;
  if (!apiKey) return null;
  return await db.getAgentByApiKey(apiKey);
}
