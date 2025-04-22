const Redis = require('ioredis');
const redis = new Redis();

redis.ping().then(result => {
    console.log('Redis ping response:', result);
    process.exit(0);
}).catch(err => {
    console.error('Redis connection error:', err);
    process.exit(1);
});