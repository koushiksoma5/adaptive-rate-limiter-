const RedisService = require('../services/RedisService');

async function getRequestStats() {
    const redis = RedisService.redis;
    const keys = await redis.keys('request:*');
    const pipeline = redis.pipeline();

    // Get all request data
    keys.forEach(key => pipeline.hgetall(key));
    const requests = await pipeline.exec();
    const requestData = requests.map(result => result[1]);

    // Calculate statistics
    const totalRequests = requestData.length;
    const completedRequests = requestData.filter(req => req.status === 'completed');

    // Calculate average response time
    const responseTimes = completedRequests
        .map(req => parseFloat(req.responseTime))
        .filter(time => !isNaN(time));
    const averageResponseTime = responseTimes.length > 0 ?
        Math.round(responseTimes.reduce((a, b) => a + b) / responseTimes.length) :
        0;

    // Group by status codes
    const statusCodes = completedRequests.reduce((acc, req) => {
        const status = req.statusCode || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});

    // Get recent requests for time-series data
    const recentRequests = completedRequests
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 20)
        .map(req => ({
            timestamp: req.timestamp,
            responseTime: parseFloat(req.responseTime) || 0,
            statusCode: req.statusCode
        }));

    return {
        totalRequests,
        averageResponseTime,
        statusCodes,
        recentRequests
    };
}

async function statsRoutes(fastify) {
    fastify.get('/api/requests/stats', async(request, reply) => {
        try {
            const stats = await getRequestStats();
            return stats;
        } catch (error) {
            request.log.error('Error fetching request stats:', error);
            reply.status(500).send({ error: 'Internal Server Error' });
        }
    });
}

module.exports = statsRoutes;