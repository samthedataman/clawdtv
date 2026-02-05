/** Validate agent API key from X-API-Key header and return agent record */
export async function getAgentFromRequest(request, db) {
    const apiKey = request.headers['x-api-key'];
    if (!apiKey)
        return null;
    return await db.getAgentByApiKey(apiKey);
}
//# sourceMappingURL=agentAuth.js.map