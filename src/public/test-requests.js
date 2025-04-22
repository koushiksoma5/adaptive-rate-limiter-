// Test script to generate various types of requests
const makeRequest = async(endpoint, method = 'GET', payload = null) => {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (payload) {
            options.body = JSON.stringify(payload);
        }

        const startTime = performance.now();
        const response = await fetch(endpoint, options);
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        const statusElement = document.getElementById('requestStatus');
        const status = `${method} ${endpoint} - Status: ${response.status} - Time: ${responseTime.toFixed(2)}ms`;

        statusElement.innerHTML = `<div class="${response.ok ? 'success' : 'error'}">${status}</div>` + statusElement.innerHTML;
        if (statusElement.children.length > 10) {
            statusElement.removeChild(statusElement.lastChild);
        }

        return response;
    } catch (error) {
        console.error(`Error making request to ${endpoint}:`, error);
        const statusElement = document.getElementById('requestStatus');
        statusElement.innerHTML = `<div class="error">Error: ${error.message}</div>` + statusElement.innerHTML;
    }
};

let normalInterval, burstInterval, errorInterval;

// Function to simulate different request patterns
const simulateRequests = async() => {
    const endpoints = [
        '/api/test',
        '/api/users',
        '/api/data',
        '/api/status'
    ];

    const methods = ['GET', 'POST', 'PUT', 'DELETE'];

    // Make a request every second
    normalInterval = setInterval(async() => {
        const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
        const method = methods[Math.floor(Math.random() * methods.length)];
        const payload = method !== 'GET' ? { data: 'test-' + Date.now() } : null;
        await makeRequest(endpoint, method, payload);
    }, 1000);

    // Burst of requests every 10 seconds
    burstInterval = setInterval(async() => {
        console.log('Simulating burst of requests...');
        for (let i = 0; i < 5; i++) {
            const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
            await makeRequest(endpoint);
        }
    }, 10000);

    // Simulate errors occasionally
    errorInterval = setInterval(async() => {
        const invalidEndpoint = '/api/nonexistent';
        await makeRequest(invalidEndpoint);
    }, 15000);
};

// Add controls to start/stop simulation
document.addEventListener('DOMContentLoaded', () => {
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'card';
    controlsDiv.style.marginBottom = '20px';
    controlsDiv.innerHTML = `
        <h2>Request Simulation Controls</h2>
        <button id="startSimulation" class="button">Start Simulation</button>
        <button id="stopSimulation" class="button" style="background-color: #f44336;">Stop Simulation</button>
        <div id="requestStatus" style="margin-top: 20px; max-height: 300px; overflow-y: auto;"></div>
    `;

    document.body.insertBefore(controlsDiv, document.body.firstChild);

    let isSimulationRunning = false;
    const startButton = document.getElementById('startSimulation');
    const stopButton = document.getElementById('stopSimulation');

    startButton.addEventListener('click', () => {
        if (!isSimulationRunning) {
            simulateRequests();
            isSimulationRunning = true;
            startButton.disabled = true;
            stopButton.disabled = false;
        }
    });

    stopButton.addEventListener('click', () => {
        if (isSimulationRunning) {
            clearInterval(normalInterval);
            clearInterval(burstInterval);
            clearInterval(errorInterval);
            isSimulationRunning = false;
            startButton.disabled = false;
            stopButton.disabled = true;
            console.log('Simulation stopped');
        }
    });

    // Initially disable stop button
    stopButton.disabled = true;
});