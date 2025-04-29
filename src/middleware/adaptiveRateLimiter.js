const RedisService = require('../services/RedisService');
const config = require('../config/config');
const PerformanceMonitor = require('../utils/PerformanceMonitor');
const CountMinSketch = require('../utils/CountMinSketch');

const cms = new CountMinSketch(config.cmsEpsilon || 0.001, config.cmsDelta || 0.99);
const suspiciousThreshold = config.rateLimit.suspiciousThreshold || 100; // threshold to start Redis tracking
const blockThreshold = config.rateLimit.blockThreshold || 200; // threshold to block attacker

async function adaptiveRateLimiter(request, reply) {
    const ip = request.ip || request.headers['x-forwarded-for'] || request.socket.remoteAddress;
    const key = `ratelimit:${ip}`;
    const now = Date.now();
    const windowMs = config.rateLimit.windowMs;

    try {
        // Step 1: Use CountMinSketch to track requests
        cms.update(ip);

        const estimatedCount = cms.estimate(ip);

        // Step 2: If estimated count exceeds suspicious threshold, start Redis tracking
        if (estimatedCount > suspiciousThreshold) {
            // Check if IP is blocked
            const isBlocked = await RedisService.isBlocked(ip);
            if (isBlocked) {
                // Log blocked request
                await RedisService.logBlockedRequest(ip, request);
                console.log(`Blocked request from IP: ${ip}, Method: ${request.method}, URL: ${request.url}`);
                reply.code(429).send({ error: 'Too Many Requests - You are blocked' });
                return;
            }

            // Track request in Redis sorted set for rate limiting
            const result = await RedisService.checkRateLimit(key, now, windowMs);

            if (!result.allowed) {
                // Block attacker by adding to blocklist
                await RedisService.blockIp(ip);
                await RedisService.logBlockedRequest(ip, request);
                console.log(`Blocked request from IP: ${ip}, Method: ${request.method}, URL: ${request.url}`);
                reply.code(429).send({ error: 'Too Many Requests - You are blocked' });
                return;
            }

            // Adjust threshold based on performance
            const performanceKey = `request:${ip}:${now}`;
            PerformanceMonitor.startTimer(performanceKey);
            const metrics = PerformanceMonitor.endTimer(performanceKey);

            if (metrics && metrics.duration > 100) {
                await RedisService.adjustThreshold(key, false);
            } else if (metrics && metrics.duration < 50) {
                await RedisService.adjustThreshold(key, true);
            }
        }

        // If below suspicious threshold, allow request
        return;

    } catch (error) {
        console.error('Rate limiting error:', error);
        await RedisService.adjustThreshold(key, true);
    }
}

module.exports = adaptiveRateLimiter;