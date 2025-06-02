const RedisService = require('../services/RedisService');

async function dashboardStatsRoutes(fastify) {
    fastify.get('/api/stats', async(request, reply) => {
        try {
            const stats = await RedisService.getRequestStats();
            reply.send(stats);
        } catch (error) {
            request.log.error('Error fetching stats:', error);
            reply.status(500).send({ error: 'Internal Server Error' });
        }
    });
}

module.exports = dashboardStatsRoutes;