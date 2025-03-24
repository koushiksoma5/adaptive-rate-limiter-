const config = {
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
    },
    rateLimit: {
        windowMs: 60000, // 1 minute
        maxRequests: 100, // max requests per window
        adaptiveFactorWeight: 0.3, // weight for adaptive threshold adjustment
        anomalyThreshold: 2.0, // standard deviations for anomaly detection
    },
    server: {
        port: process.env.PORT || 3000,
    }
};
module.exports = config;