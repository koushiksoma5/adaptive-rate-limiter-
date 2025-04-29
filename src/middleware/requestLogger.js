const RedisService = require('../services/RedisService');
const { v4: uuidv4 } = require('uuid');

function requestLogger(request, reply, done) {
    const startTime = process.hrtime();
    const requestId = uuidv4();
    request.id = requestId;

    const requestInfo = {
        method: request.method,
        url: request.url,
        ip: request.ip || request.headers['x-forwarded-for'] || request.socket.remoteAddress,
        timestamp: new Date().toISOString()
    };

    // Store request info in Redis with a unique key
    const requestKey = `request:${requestId}`;
    RedisService.redis.hset(requestKey, {
        ...requestInfo,
        status: 'pending'
    }).then(() => {
        RedisService.redis.expire(requestKey, 3600);
    }).catch(err => {
        request.log.error('Error storing request info in Redis:', err);
    });

    reply.raw.on('finish', () => {
        const diff = process.hrtime(startTime);
        const responseTime = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);

        RedisService.redis.hset(requestKey, {
            statusCode: reply.statusCode,
            status: 'completed'
        }).catch(err => {
            request.log.error('Error updating request info in Redis:', err);
        });

        request.log.info({
            request: requestInfo,
            response: {
                statusCode: reply.statusCode,
                responseTime: `${responseTime}ms`
            }
        });
    });

    done();
}

module.exports = requestLogger;