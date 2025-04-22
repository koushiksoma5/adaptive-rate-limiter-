module.exports = {
    rateLimit: {
        windowMs: 60000,
        maxRequests: 100,
        minThreshold: 50,
        maxThreshold: 200
    },
    targetWebsites: [{
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        monitorPath: '/',
        alertThreshold: 200,
        minAlertCount: 3,
        cooldownPeriod: 300000 // 5 minutes in milliseconds
    }]
};