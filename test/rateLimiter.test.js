const fastify = require('fastify');
const adaptiveRateLimiter = require('../src/middleware/adaptiveRateLimiter');
const RedisService = require('../src/services/RedisService');
const Redis = require('ioredis');

jest.setTimeout(60000);

describe('Adaptive Rate Limiter', () => {
    let app;
    let redis;

    beforeAll(async() => {
        redis = new Redis({
            host: 'localhost',
            port: 6379
        });

        try {
            await redis.ping();
            RedisService.redis = redis;
        } catch (error) {
            console.error('Redis connection failed:', error);
            throw error;
        }
    });

    afterAll(async() => {
        await redis.flushall();
        await redis.quit();
        // Remove the second quit call since we're using the same connection
    });

    beforeEach(async() => {
        app = fastify();
        app.addHook('onRequest', adaptiveRateLimiter);
        await redis.flushdb();
    });

    afterEach(async() => {
        await app.close();
    });

    test('should allow requests within limits', async() => {
        app.get('/test', async() => ({ status: 'ok' }));
        await app.ready();

        const response = await app.inject({
            method: 'GET',
            url: '/test'
        });

        expect(response.statusCode).toBe(200);
    });
});