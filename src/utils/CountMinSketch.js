class CountMinSketch {
    constructor(epsilon = 0.001, delta = 0.99) {
        this.width = Math.ceil(Math.E / epsilon);
        this.depth = Math.ceil(Math.log(1 / delta));
        this.matrix = Array(this.depth).fill().map(() => Array(this.width).fill(0));
        this.hashFunctions = this.generateHashFunctions();
    }

    generateHashFunctions() {
        return Array(this.depth).fill().map(() => {
            const a = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
            const b = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
            return (x) => Math.abs((a * x + b) % this.width);
        });
    }

    update(key, count = 1) {
        const keyNum = this.hashString(key);
        this.hashFunctions.forEach((hash, i) => {
            const index = hash(keyNum);
            this.matrix[i][index] += count;
        });
    }

    estimate(key) {
        const keyNum = this.hashString(key);
        return Math.min(...this.hashFunctions.map((hash, i) =>
            this.matrix[i][hash(keyNum)]
        ));
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
}

module.exports = CountMinSketch;