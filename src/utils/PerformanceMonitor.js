class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
    }

    startTimer(key) {
        this.metrics.set(key, {
            start: process.hrtime(),
            memory: process.memoryUsage()
        });
    }

    endTimer(key) {
        const start = this.metrics.get(key);
        if (!start) return null;

        const diff = process.hrtime(start.start);
        const duration = (diff[0] * 1e9 + diff[1]) / 1e6; // Convert to milliseconds
        const memoryDiff = {
            heapUsed: process.memoryUsage().heapUsed - start.memory.heapUsed,
            external: process.memoryUsage().external - start.memory.external
        };

        this.metrics.delete(key);
        return { duration, memoryDiff };
    }
}

module.exports = new PerformanceMonitor();