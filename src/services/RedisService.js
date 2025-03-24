const Redis = require('ioredis');
const config = require('../config/config');

class RedisService {
    constructor() {
        this.redis = new Redis({
            host: 'localhost',
            port: 6379
        });
    }

    async checkRateLimit(key, now, windowMs) {
        const multi = this.redis.multi();
        multi.zremrangebyscore(key, 0, now - windowMs);
        multi.zadd(key, now, `${now}`);
        multi.zcard(key);
        multi.pttl(key);

        const [, , requestCount] = await multi.exec();
        const threshold = await this.getThreshold(key) || config.rateLimit.maxRequests;

        return {
            allowed: requestCount[1] <= threshold
        };
    }

    async adjustThreshold(key, increase) {
        const thresholdKey = `threshold:${key}`;
        const currentThreshold = await this.getThreshold(key) || config.rateLimit.maxRequests;

        const newThreshold = increase ?
            Math.min(currentThreshold * 1.1, config.rateLimit.maxThreshold) :
            Math.max(currentThreshold * 0.9, config.rateLimit.minThreshold);

        await this.redis.set(thresholdKey, newThreshold);
    }

    async getThreshold(key) {
        const thresholdKey = `threshold:${key}`;
        const threshold = await this.redis.get(thresholdKey);
        return threshold ? parseInt(threshold) : null;
    }
}

module.exports = new RedisService();