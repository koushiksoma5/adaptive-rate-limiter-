const fastify = require('fastify');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');
const WebsiteMonitor = require('./services/WebsiteMonitor');
const RedisService = require('./services/RedisService');
const websiteMonitor = new WebsiteMonitor(); // Create an instance
const config = require('./config/config');
const adaptiveRateLimiter = require('./middleware/adaptiveRateLimiter');
const requestLogger = require('./middleware/requestLogger');
const statsRoutes = require('./routes/stats');
const dashboardStatsRoutes = require('./routes/dashboardStats');

const app = fastify({
    logger: {
        level: 'warn'
    }
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
app.register(dashboardStatsRoutes);

// Start monitoring target websit
websiteMonitor.startMonitoring(config.targetWebsites);

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
        const port = process.env.PORT || 5000;
        await app.listen({ port: port, host: '0.0.0.0' });
        // Removed auto-opening of test-requests and dashboard pages
        console.log(`Server running on http://localhost:${port}`);
        // Open the default browser automatically on Windows
        exec(`start http://localhost:${port}`);
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

start();