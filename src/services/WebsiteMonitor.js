const axios = require('axios');
const RedisService = require('./RedisService');
const WebSocketService = require('./WebSocketService');
const config = require('../config/config');

class WebsiteMonitor {
    constructor() {
        this.monitoringActive = false;
        this.metrics = {
            requests: 0,
            errors: 0,
            lastCheck: Date.now(),
            endpoints: {},
            averageResponseTime: 0,
            lastMinuteRequests: 0,
            successRate: 100
        };
        this.alertSent = new Map();
        this.responseTimeWindow = new Map();
        this.alertCooldown = new Map();
        this.alertCount = new Map();
        this.requestWindow = [];
    }

    getMetrics() {
        return {
            ...this.metrics,
            uptime: Date.now() - this.metrics.lastCheck
        };
    }

    async startMonitoring(targetWebsites) {
        this.monitoringActive = true;
        for (const site of targetWebsites) {
            this.metrics.endpoints[site.url] = {
                requests: 0,
                errors: 0,
                lastResponseTime: 0
            };
            this.monitorSite(site).catch(err => {
                console.error(`Error in monitoring site ${site.url}:`, err);
            });
        }
    }

    async stopMonitoring() {
        this.monitoringActive = false;
    }

    async monitorSite(site) {
        while (this.monitoringActive) {
            try {
                const startTime = Date.now();
                const response = await axios.get(site.url + site.monitorPath, {
                    timeout: 5000
                });
                const endTime = Date.now();
                const responseTime = endTime - startTime;

                this.metrics.requests++;
                this.metrics.endpoints[site.url].requests++;
                this.metrics.endpoints[site.url].lastResponseTime = responseTime;

                this.requestWindow.push({ timestamp: startTime, success: true });
                this.cleanRequestWindow();
                this.updateAggregateMetrics();

                const metrics = {
                    url: site.url,
                    timestamp: startTime,
                    responseTime,
                    statusCode: response.status,
                    success: true
                };
                await RedisService.trackWebsiteMetrics(metrics);
                await WebSocketService.sendMetricsUpdate({
                    ...this.metrics,
                    currentRequest: metrics
                });

                if (responseTime > site.alertThreshold) {
                    await this.handleAlert(site, responseTime);
                } else {
                    this.alertSent.set(site.url, false);
                }

            } catch (error) {
                this.metrics.errors++;
                this.metrics.endpoints[site.url].errors++;

                this.requestWindow.push({ timestamp: Date.now(), success: false });
                this.cleanRequestWindow();
                this.updateAggregateMetrics();

                console.error(`Error monitoring ${site.url}:`, error.message);
                await this.handleAlert(site, null, error);
            }
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    cleanRequestWindow() {
        const oneMinuteAgo = Date.now() - 60000;
        this.requestWindow = this.requestWindow.filter(req => req.timestamp > oneMinuteAgo);
    }

    updateAggregateMetrics() {
        this.metrics.lastMinuteRequests = this.requestWindow.length;
        const successfulRequests = this.requestWindow.filter(req => req.success).length;
        this.metrics.successRate = this.requestWindow.length > 0 ?
            Math.round((successfulRequests / this.requestWindow.length) * 100) : 100;

        const responseTimes = Array.from(this.responseTimeWindow.values())
            .flat()
            .filter(time => time !== null && time !== undefined);

        this.metrics.averageResponseTime = responseTimes.length > 0 ?
            Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0;
    }

    async handleAlert(site, responseTime, error = null) {
        const now = Date.now();
        const lastAlertTime = this.alertCooldown.get(site.url) || 0;

        if (now - lastAlertTime < site.cooldownPeriod) {
            return; // Skip alert if in cooldown period
        }

        if (!error && responseTime) {
            let times = this.responseTimeWindow.get(site.url) || [];
            times.push(responseTime);
            if (times.length > 5) times.shift();
            this.responseTimeWindow.set(site.url, times);

            const avgResponseTime = times.reduce((a, b) => a + b, 0) / times.length;
            let currentAlertCount = this.alertCount.get(site.url) || 0;

            if (avgResponseTime > site.alertThreshold) {
                currentAlertCount++;
                this.alertCount.set(site.url, currentAlertCount);
            } else {
                this.alertCount.set(site.url, 0);
                return;
            }

            if (currentAlertCount < site.minAlertCount) {
                return;
            }
        }

        const alertMessage = error ?
            `Alert: ${site.url} is down! Error: ${error.message}` :
            `Alert: High response time (${responseTime}ms) detected for ${site.url}\n` +
            `Average response time exceeds threshold for ${this.alertCount.get(site.url)} consecutive checks`;

        console.error(alertMessage);
        this.alertCooldown.set(site.url, now);
        this.alertCount.set(site.url, 0);
    }

    calculateAverageResponseTime(url) {
        const metrics = this.metrics.endpoints[url];
        if (!metrics || metrics.requests === 0) return 0;
        return Math.round(metrics.lastResponseTime);
    }
}

module.exports = WebsiteMonitor;