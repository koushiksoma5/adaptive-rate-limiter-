const Redis = require('ioredis');
const config = require('../config/config');

class RedisService {
    constructor() {
        this.redis = new Redis({
            host: 'localhost',
            port: 6379
        });

        this.redis.on('connect', () => {
            console.log('Redis connected');
        });

        this.redis.on('error', (err) => {
            console.error('Redis error:', err);
        });
    }

    async getRequestLogs(limit = 100) {
        try {
            const keys = await this.redis.keys('request:*');
            const logs = [];

            for (const key of keys.slice(-limit)) {
                const log = await this.redis.hgetall(key);
                if (log) {
                    logs.push(log);
                }
            }

            return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (error) {
            console.error('Error in getRequestLogs:', error);
            return [];
        }
    }

    async getRequestStats() {
        try {
            const logs = await this.getRequestLogs();
            const stats = {
                totalRequests: logs.length,
                averageResponseTime: 0,
                statusCodes: {},
                methodCounts: {},
                recentRequests: logs.slice(0, 10)
            };

            let totalResponseTime = 0;
            let responseCount = 0;

            logs.forEach(log => {
                // Count status codes
                if (log.statusCode) {
                    stats.statusCodes[log.statusCode] = (stats.statusCodes[log.statusCode] || 0) + 1;
                }

                // Count HTTP methods
                if (log.method) {
                    stats.methodCounts[log.method] = (stats.methodCounts[log.method] || 0) + 1;
                }

                // Calculate average response time
                if (log.responseTime) {
                    totalResponseTime += parseFloat(log.responseTime);
                    responseCount++;
                }
            });

            if (responseCount > 0) {
                stats.averageResponseTime = (totalResponseTime / responseCount).toFixed(2);
            }

            return stats;
        } catch (error) {
            console.error('Error in getRequestStats:', error);
            return {};
        }
    }

    async checkRateLimit(key, now, windowMs) {
        try {
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
        } catch (error) {
            console.error('Error in checkRateLimit:', error);
            return { allowed: true }; // Fail open to avoid blocking legitimate requests
        }
    }

    async adjustThreshold(key, increase) {
        try {
            const thresholdKey = `threshold:${key}`;
            const currentThreshold = await this.getThreshold(key) || config.rateLimit.maxRequests;

            const newThreshold = increase ?
                Math.min(currentThreshold * 1.1, config.rateLimit.maxThreshold) :
                Math.max(currentThreshold * 0.9, config.rateLimit.minThreshold);

            await this.redis.set(thresholdKey, newThreshold);
        } catch (error) {
            console.error('Error in adjustThreshold:', error);
        }
    }

    async getThreshold(key) {
        try {
            const thresholdKey = `threshold:${key}`;
            const threshold = await this.redis.get(thresholdKey);
            return threshold ? parseInt(threshold) : null;
        } catch (error) {
            console.error('Error in getThreshold:', error);
            return null;
        }
    }

    async trackWebsiteMetrics(metrics) {
        try {
            const key = `website:${metrics.url}:${Math.floor(metrics.timestamp / 60000)}`;
            await this.redis.multi()
                .hincrby(key, 'requests', 1)
                .hset(key, 'lastResponseTime', metrics.responseTime)
                .hset(key, 'lastStatusCode', metrics.statusCode)
                .expire(key, 3600) // Keep data for 1 hour
                .exec();
        } catch (error) {
            console.error('Error in trackWebsiteMetrics:', error);
        }
    }

    async getWebsiteMetrics(url) {
        try {
            const now = Math.floor(Date.now() / 60000);
            const key = `website:${url}:${now}`;
            const data = await this.redis.hgetall(key);
            return {
                url,
                requestsPerMinute: parseInt(data.requests) || 0,
                lastResponseTime: parseInt(data.lastResponseTime) || 0,
                lastStatusCode: parseInt(data.lastStatusCode) || 0
            };
        } catch (error) {
            console.error('Error in getWebsiteMetrics:', error);
            return {
                url,
                requestsPerMinute: 0,
                lastResponseTime: 0,
                lastStatusCode: 0
            };
        }
    }

    async getAllWebsiteMetrics() {
        try {
            const metrics = [];
            for (const site of config.targetWebsites) {
                const siteMetrics = await this.getWebsiteMetrics(site.url);
                metrics.push(siteMetrics);
            }
            return metrics;
        } catch (error) {
            console.error('Error in getAllWebsiteMetrics:', error);
            return [];
        }
    }

    async cleanupOldRequestLogs(maxAgeMs = 3600000) {
        try {
            const keys = await this.redis.keys('request:*');
            const now = Date.now();

            for (const key of keys) {
                const log = await this.redis.hgetall(key);
                if (log && log.timestamp) {
                    const logTime = new Date(log.timestamp).getTime();
                    if (now - logTime > maxAgeMs) {
                        await this.redis.del(key);
                    }
                }
            }
        } catch (error) {
            console.error('Error in cleanupOldRequestLogs:', error);
        }
    }

    async blockIp(ip) {
        try {
            const blockKey = 'blocked:ips';
            await this.redis.sadd(blockKey, ip);
        } catch (error) {
            console.error('Error in blockIp:', error);
        }
    }

    async isBlocked(ip) {
        try {
            const blockKey = 'blocked:ips';
            return await this.redis.sismember(blockKey, ip) === 1;
        } catch (error) {
            console.error('Error in isBlocked:', error);
            return false;
        }
    }

    async logBlockedRequest(ip, request) {
        try {
            const blockedKey = `blocked:request:${ip}:${Date.now()}`;
            const data = {
                ip,
                method: request.method,
                url: request.url,
                headers: JSON.stringify(request.headers),
                timestamp: new Date().toISOString()
            };
            const fieldValuePairs = [];
            for (const [field, value] of Object.entries(data)) {
                fieldValuePairs.push(field, value);
            }
            await this.redis.hset(blockedKey, ...fieldValuePairs);
            // Set expiration for blocked request logs (e.g., 1 hour)
            await this.redis.expire(blockedKey, 3600);
        } catch (error) {
            console.error('Error in logBlockedRequest:', error);
        }
    }

    async getBlockedRequests(limit = 100) {
        try {
            const keys = await this.redis.keys('blocked:request:*');
            const logs = [];

            for (const key of keys.slice(-limit)) {
                const log = await this.redis.hgetall(key);
                if (log) {
                    logs.push(log);
                }
            }

            return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (error) {
            console.error('Error in getBlockedRequests:', error);
            return [];
        }
    }
}

module.exports = new RedisService();