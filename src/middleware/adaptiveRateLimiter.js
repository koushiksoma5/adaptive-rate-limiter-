const RedisService = require('../services/RedisService');
const config = require('../config/config');
const PerformanceMonitor = require('../utils/PerformanceMonitor');

async function adaptiveRateLimiter(request, reply) {
    const ip = request.ip || request.headers['x-forwarded-for'] || request.socket.remoteAddress;
    const key = `ratelimit:${ip}`;
    const now = Date.now();
    const windowMs = config.rateLimit.windowMs;

    try {
        const performanceKey = `request:${ip}:${now}`;
        PerformanceMonitor.startTimer(performanceKey);

        const result = await RedisService.checkRateLimit(key, now, windowMs);
        const metrics = PerformanceMonitor.endTimer(performanceKey);

        if (!result.allowed) {
            reply.code(429).send({ error: 'Too Many Requests' });
            return;
        }

        if (metrics && metrics.duration > 100) {
            await RedisService.adjustThreshold(key, false);
        } else if (metrics && metrics.duration < 50) {
            await RedisService.adjustThreshold(key, true);
        }

    } catch (error) {
        console.error('Rate limiting error:', error);
        await RedisService.adjustThreshold(key, true);
    }
}

module.exports = adaptiveRateLimiter;