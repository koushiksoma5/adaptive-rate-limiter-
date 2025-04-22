const fastify = require('fastify');
const path = require('path');
const http = require('http');
const WebsiteMonitor = require('./services/WebsiteMonitor');
const RedisService = require('./services/RedisService');
const websiteMonitor = new WebsiteMonitor(); // Create an instance
const config = require('./config/config');
const adaptiveRateLimiter = require('./middleware/adaptiveRateLimiter');
const requestLogger = require('./middleware/requestLogger');
const statsRoutes = require('./routes/stats');
const { getRequestStats } = require('./routes/stats');

const app = fastify({
    logger: true
});

// Register JSON body parser
app.addContentTypeParser('application/json', { parseAs: 'string' }, async(req, body) => {
    try {
        return body ? JSON.parse(body) : {};
    } catch (err) {
        throw new Error('Invalid JSON');
    }
});

// Serve static files
app.register(require('@fastify/static'), {
    root: path.join(__dirname, 'public'),
    prefix: '/' // serve the files under the root URL
});

// Register middlewares
app.addHook('onRequest', adaptiveRateLimiter);
app.addHook('onRequest', requestLogger);

// Register stats routes
app.register(statsRoutes);

// Start monitoring target websites
websiteMonitor.startMonitoring(config.targetWebsites); // API endpoint to get stats
app.get('/api/stats', async(request, reply) => {
    try {
        const stats = await getRequestStats();
        reply.send(stats);
    } catch (error) {
        reply.code(500).send({ error: 'Failed to fetch stats' });
    }
});

// API endpoint to get monitoring status
app.get('/api/monitoring/status', async(request, reply) => {
    try {
        const metrics = await RedisService.getAllWebsiteMetrics();
        reply.send(metrics);
    } catch (error) {
        reply.code(500).send({ error: 'Failed to fetch monitoring metrics' });
    }
});

// Test endpoints for monitoring
app.get('/api/test', async(request, reply) => {
    reply.send({ message: 'Test endpoint response' });
});

app.get('/api/users', async(request, reply) => {
    reply.send({ users: ['user1', 'user2', 'user3'] });
});

app.post('/api/users', async(request, reply) => {
    reply.code(201).send({ message: 'User created successfully' });
});

app.get('/api/data', async(request, reply) => {
    reply.send({ message: 'Data endpoint response' });
});

app.get('/api/status', async(request, reply) => {
    reply.send({ status: 'operational' });
});

// Slow endpoint for testing
app.get('/api/slow', async(request, reply) => {
    try {
        // Simulate a slow response
        await new Promise(resolve => setTimeout(resolve, 2000));
        reply.send({ message: 'Slow response from the API' });
    } catch (error) {
        reply.code(500).send({ error: 'Internal server error' });
    }
});

// Authentication endpoint
app.post('/login', async(request, reply) => {
    const { username, password } = request.body;
    try {
        if (username === 'admin' && password === 'password') {
            reply.send({ success: true });
        } else {
            reply.code(401).send({ success: false, error: 'Invalid credentials' });
        }
    } catch (error) {
        reply.code(500).send({ error: 'Authentication failed' });
    }
});

const start = async() => {
    try {
        await app.register(require('@fastify/cors'));
        await app.listen({ port: 3000, host: '0.0.0.0' });
        console.log('Server running on http://localhost:3000');
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

start();