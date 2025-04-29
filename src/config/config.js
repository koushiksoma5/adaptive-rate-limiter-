module.exports = {
    rateLimit: {
        windowMs: 60000,
        maxRequests: 100,
        minThreshold: 50,
        maxThreshold: 200
    },
    targetWebsites: [{
        url: 'https://zerowastex.vercel.app',
        monitorPath: '/home',
        alertThreshold: 200,
        minAlertCount: 3,
        cooldownPeriod: 300000 // 5 minutes in milliseconds
    }]
};