const WebSocket = require('ws');
const RedisService = require('./RedisService');

class WebSocketService {
    constructor() {
        this.wss = null;
        this.clients = new Set();
    }

    initialize(server) {
        this.wss = new WebSocket.Server({ server });

        this.wss.on('connection', (ws) => {
            this.clients.add(ws);

            ws.on('close', () => {
                this.clients.delete(ws);
            });
        });

        // Subscribe to Redis updates
        const redisSubscriber = RedisService.redis.duplicate();
        redisSubscriber.subscribe('metrics-update', (err) => {
            if (err) console.error('Redis subscription error:', err);
        });

        redisSubscriber.on('message', (channel, message) => {
            if (channel === 'metrics-update') {
                this.broadcastMetrics(message);
            }
        });
    }

    broadcastMetrics(data) {
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    async sendMetricsUpdate(metrics) {
        await RedisService.redis.publish('metrics-update', JSON.stringify(metrics));
    }
}

module.exports = new WebSocketService();