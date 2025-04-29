const axios = require('axios');

const targetUrl = 'https://zerowastex.vercel.app/home';
const totalRequests = 1000; // total number of requests to send
const concurrency = 50; // number of concurrent requests

async function sendRequest() {
    try {
        await axios.get(targetUrl);
        console.log('Request sent');
    } catch (error) {
        console.error('Request error:', error.message);
    }
}

async function sendRequests() {
    let ongoing = 0;
    let sent = 0;

    return new Promise((resolve) => {
        function next() {
            while (ongoing < concurrency && sent < totalRequests) {
                ongoing++;
                sent++;
                sendRequest().finally(() => {
                    ongoing--;
                    if (sent === totalRequests && ongoing === 0) {
                        resolve();
                    } else {
                        next();
                    }
                });
            }
        }
        next();
    });
}

sendRequests().then(() => {
    console.log('All requests sent');
});