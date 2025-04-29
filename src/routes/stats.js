const RedisService = require('../services/RedisService');

async function getBlockedRequests() {
    return await RedisService.getBlockedRequests(100);
}

async function statsRoutes(fastify) {
    fastify.get('/api/requests/blocked', async(request, reply) => {
        try {
            const blocked = await getBlockedRequests();
            return blocked;
        } catch (error) {
            request.log.error('Error fetching blocked requests:', error);
            reply.status(500).send({ error: 'Internal Server Error' });
        }
    });
}

module.exports = statsRoutes;