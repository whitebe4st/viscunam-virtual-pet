// Viscunam Game - Server Side
// This is the server for the Viscunam virtual pet game using WebSockets

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Create HTTP server
const server = http.createServer((req, res) => {
    // Serve static files
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = path.extname(filePath);
    let contentType = 'text/html';
    
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.json':
            contentType = 'application/json';
            break;
        case '.png':
            contentType = 'image/png';
            break;
        case '.jpg':
            contentType = 'image/jpg';
            break;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// ViscunamProtocol - Custom Application Layer Protocol
// Message format: ACTION|PARAM1:VALUE1|PARAM2:VALUE2|...
// Status codes:
// 200: OK
// 400: Bad Request
// 500: Server Error

// Protocol Actions
const ACTIONS = {
    CONNECT: 'CONNECT',
    FEED: 'FEED',
    COFFEE: 'COFFEE',
    UPDATE: 'UPDATE',
    DISCONNECT: 'DISCONNECT'
};

// Store connected clients and their pet states
const clients = new Map();

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('Client connected');
    
    // Create a unique ID for this client
    const clientId = Date.now().toString();
    
    // Initialize pet state for this client
    const petState = {
        hunger: 100,
        happiness: 100,
        sleepiness: 0, // Add sleepiness property (0 means not sleepy at all)
        lastUpdate: Date.now(),
        status: 'normal'
    };
    
    // Store client and pet state
    clients.set(clientId, { ws, petState });
    
    // Set up interval to update pet state and send updates to client
    const updateInterval = setInterval(() => {
        updatePetState(clientId);
        sendUpdate(clientId);
    }, 5000); // Update every 5 seconds
    
    // Handle messages from client
    ws.on('message', (message) => {
        handleClientMessage(clientId, message.toString());
    });
    
    // Handle client disconnection
    ws.on('close', () => {
        console.log('Client disconnected');
        clearInterval(updateInterval);
        clients.delete(clientId);
    });
});

// Handle messages from clients
function handleClientMessage(clientId, message) {
    console.log(`Received from client ${clientId}: ${message}`);
    console.log(`Message type: ${typeof message}`);
    
    const client = clients.get(clientId);
    if (!client) return;
    
    const parts = message.split('|');
    const action = parts[0];
    const params = {};
    
    console.log(`Parsed action: "${action}"`);
    console.log(`ACTIONS.COFFEE value: "${ACTIONS.COFFEE}"`);
    console.log(`Are they equal? ${action === ACTIONS.COFFEE}`);
    
    // Parse parameters
    for (let i = 1; i < parts.length; i++) {
        const [key, value] = parts[i].split(':');
        params[key] = value;
    }
    
    // Handle different actions
    switch (action) {
        case ACTIONS.CONNECT:
            // Send initial update to client
            sendUpdate(clientId);
            sendStatus(clientId, 200, 'Connected successfully', ACTIONS.CONNECT);
            break;
            
        case ACTIONS.FEED:
            // Feed the pet
            client.petState.hunger = Math.min(100, client.petState.hunger + 20);
            client.petState.happiness = Math.min(100, client.petState.happiness + 10);
            client.petState.lastUpdate = Date.now();
            updatePetStatus(client.petState);
            
            // Send update to client
            sendUpdate(clientId);
            sendStatus(clientId, 200, 'Fed Viscunam successfully', ACTIONS.FEED);
            break;
            
        case ACTIONS.COFFEE:
            // Check if sleepiness is already 0
            if (client.petState.sleepiness === 0) {
                // Pet is already fully awake, can't drink more coffee
                sendStatus(clientId, 400, 'Viscunam is already fully awake and doesn\'t need coffee', ACTIONS.COFFEE);
                break;
            }
            
            // Give coffee to the pet (reduce sleepiness)
            client.petState.sleepiness = Math.max(0, client.petState.sleepiness - 30);
            client.petState.happiness = Math.min(100, client.petState.happiness + 5);
            client.petState.lastUpdate = Date.now();
            
            // Update status to normal if it was slumber
            if (client.petState.status === 'slumber') {
                client.petState.status = 'normal';
            }
            
            updatePetStatus(client.petState);
            
            // Send update to client
            sendUpdate(clientId);
            sendStatus(clientId, 200, 'Gave coffee to Viscunam successfully', ACTIONS.COFFEE);
            break;
            
        case ACTIONS.DISCONNECT:
            // Client is disconnecting
            sendStatus(clientId, 200, 'Disconnected successfully', ACTIONS.DISCONNECT);
            break;
            
        default:
            sendStatus(clientId, 400, `Unknown action: ${action}`);
    }
}

// Update pet state based on time elapsed
function updatePetState(clientId) {
    const client = clients.get(clientId);
    if (!client) return;
    
    const { petState } = client;
    const currentTime = Date.now();
    const timeElapsed = (currentTime - petState.lastUpdate) / 1000; // in seconds
    
    // Decrease hunger over time (1 point per 5 seconds)
    petState.hunger = Math.max(0, petState.hunger - (timeElapsed / 5));
    
    // Increase sleepiness over time (1 point per 8 seconds)
    petState.sleepiness = Math.min(100, petState.sleepiness + (timeElapsed / 8));
    
    // Happiness depends on hunger and sleepiness
    if (petState.hunger < 30 || petState.sleepiness > 70) {
        // Pet is hungry or sleepy, happiness decreases faster
        petState.happiness = Math.max(0, petState.happiness - (timeElapsed / 3));
    } else {
        // Pet is well-fed and awake, happiness decreases slowly
        petState.happiness = Math.max(0, petState.happiness - (timeElapsed / 10));
    }
    
    // Update pet status
    updatePetStatus(petState);
    
    // Update last update time
    petState.lastUpdate = currentTime;
}

// Update pet status based on current stats
function updatePetStatus(petState) {
    if (petState.sleepiness > 70) {
        petState.status = 'slumber'; // Pet is very sleepy
    } else if (petState.hunger < 30) {
        petState.status = 'slumber'; // Pet is hungry and tired
    } else if (petState.happiness > 70) {
        petState.status = 'happi'; // Pet is happy
    } else {
        petState.status = 'normal'; // Pet is in normal state
    }
}

// Send update to client
function sendUpdate(clientId) {
    const client = clients.get(clientId);
    if (!client) return;
    
    const { ws, petState } = client;
    
    // Format message according to our protocol
    const message = `${ACTIONS.UPDATE}|hunger:${Math.floor(petState.hunger)}|happiness:${Math.floor(petState.happiness)}|sleepiness:${Math.floor(petState.sleepiness)}|status:${petState.status}`;
    
    ws.send(message);
    console.log(`Sent to client ${clientId}: ${message}`);
}

// Send status message to client
function sendStatus(clientId, code, message, action = '') {
    const client = clients.get(clientId);
    if (!client) return;
    
    const { ws } = client;
    
    // Format status message according to our protocol
    let statusMessage = `STATUS|code:${code}|message:${message}`;
    
    // Add action if provided
    if (action) {
        statusMessage += `|action:${action}`;
    }
    
    ws.send(statusMessage);
    console.log(`Sent to client ${clientId}: ${statusMessage}`);
}

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Viscunam server running on port ${PORT}`);
}); 