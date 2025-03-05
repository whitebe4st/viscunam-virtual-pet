// Viscunam Game - Client Side
// This is a virtual pet game using a custom application-layer protocol over WebSockets

// Game state
const gameState = {
    hunger: 100, // 0-100, 0 is starving, 100 is full
    happiness: 100, // 0-100, 0 is sad, 100 is happy
    lastFed: Date.now(),
    status: 'normal', // normal, happy, slumber
    connected: false,
    isWalking: false,
    walkStep: 1, // 1 or 2 for animation frames
    position: { x: 50, y: 50 }, // percentage of screen
    direction: 1, // 1 = right, -1 = left
    walkAnimationSpeed: 400, // milliseconds between animation frames (slower = cuter)
    moveSpeed: 0.3, // percentage of screen per step (increased for more noticeable movement)
    targetPosition: null, // target position for autonomous movement
    pauseTime: 0, // time to pause between explorations
    maxPauseTime: 1.5, // maximum pause time in seconds (reduced for more frequent movement)
    isExploring: true, // whether Viscunam is in exploration mode
    explorationRange: 100, // percentage of screen width for exploration (increased to full screen)
    userInteracted: false, // flag to track if user has interacted recently
    restlessness: 0.8 // probability of changing direction during exploration (increased for more active movement)
};

// DOM Elements
const petSprite = document.getElementById('pet-sprite');
const petContainer = document.querySelector('.pet-container');
const hungerBar = document.getElementById('hunger-bar');
const happinessBar = document.getElementById('happiness-bar');
const feedButton = document.getElementById('feed-btn');
const exploreButton = document.getElementById('explore-btn');
const messageContainer = document.getElementById('message-container');
const gameContainer = document.querySelector('.game-container');

// WebSocket connection
let socket;
const SERVER_URL = 'ws://localhost:8080'; // Change this to your server URL if needed

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
    UPDATE: 'UPDATE',
    DISCONNECT: 'DISCONNECT'
};

// Connect to server
function connectToServer() {
    try {
        socket = new WebSocket(SERVER_URL);
        
        socket.onopen = () => {
            gameState.connected = true;
            sendMessage(ACTIONS.CONNECT);
            logMessage('Connected to server', 'client');
            updateUI();
        };
        
        socket.onmessage = (event) => {
            handleServerMessage(event.data);
        };
        
        socket.onclose = () => {
            gameState.connected = false;
            logMessage('Disconnected from server', 'client');
            updateUI();
            
            // Try to reconnect after 5 seconds
            setTimeout(connectToServer, 5000);
        };
        
        socket.onerror = (error) => {
            logMessage(`WebSocket Error: ${error.message}`, 'error');
            // For now, we'll simulate the server locally if connection fails
            simulateLocalMode();
        };
    } catch (error) {
        logMessage(`Failed to connect: ${error.message}`, 'error');
        // Simulate local mode if connection fails
        simulateLocalMode();
    }
}

// Simulate local mode (no server connection)
function simulateLocalMode() {
    gameState.connected = false;
    logMessage('Running in local mode (no server connection)', 'client');
    
    // Set up local game loop
    setInterval(() => {
        updateGameState();
        updateUI();
    }, 1000);
}

// Send message to server
function sendMessage(action, params = {}) {
    if (!gameState.connected) {
        logMessage(`Cannot send ${action}: Not connected to server`, 'error');
        return;
    }
    
    // Format message according to our protocol
    let message = action;
    
    for (const [key, value] of Object.entries(params)) {
        message += `|${key}:${value}`;
    }
    
    socket.send(message);
    logMessage(`Sent: ${message}`, 'client');
}

// Handle messages from server
function handleServerMessage(message) {
    logMessage(`Received: ${message}`, 'server');
    
    const parts = message.split('|');
    const action = parts[0];
    const params = {};
    
    // Parse parameters
    for (let i = 1; i < parts.length; i++) {
        const [key, value] = parts[i].split(':');
        params[key] = value;
    }
    
    // Handle different actions
    switch (action) {
        case ACTIONS.UPDATE:
            if (params.hunger) gameState.hunger = parseInt(params.hunger);
            if (params.happiness) gameState.happiness = parseInt(params.happiness);
            if (params.status) gameState.status = params.status;
            updateUI();
            break;
            
        case 'STATUS':
            const statusCode = params.code;
            const statusMessage = params.message;
            
            if (statusCode === '200') {
                logMessage(`Success: ${statusMessage}`, 'server');
            } else {
                logMessage(`Error (${statusCode}): ${statusMessage}`, 'error');
            }
            break;
            
        default:
            logMessage(`Unknown action: ${action}`, 'error');
    }
}

// Update game state (used in local mode or to predict state between server updates)
function updateGameState() {
    const currentTime = Date.now();
    const timeSinceLastFed = (currentTime - gameState.lastFed) / 1000; // in seconds
    
    // Decrease hunger over time (1 point per 5 seconds)
    gameState.hunger = Math.max(0, gameState.hunger - (timeSinceLastFed / 5));
    
    // Happiness depends on hunger
    if (gameState.hunger < 30) {
        // Pet is hungry, happiness decreases faster
        gameState.happiness = Math.max(0, gameState.happiness - (timeSinceLastFed / 3));
    } else {
        // Pet is well-fed, happiness decreases slowly
        gameState.happiness = Math.max(0, gameState.happiness - (timeSinceLastFed / 10));
    }
    
    // Update pet status based on stats
    updatePetStatus();
    
    // Reset timer
    gameState.lastFed = currentTime;
    
    // Handle continuous exploration
    if (gameState.isExploring && !gameState.userInteracted) {
        if (!gameState.isWalking) {
            // If paused, count down pause time
            if (gameState.pauseTime > 0) {
                gameState.pauseTime -= timeSinceLastFed;
            } else {
                // Time to explore again
                startWandering();
            }
        } else if (Math.random() < gameState.restlessness * (timeSinceLastFed / 2)) {
            // Occasionally change direction or destination while walking
            // to make movement more dynamic and unpredictable
            startWandering();
        }
    }
    
    // Reset user interaction flag after a while
    if (gameState.userInteracted) {
        gameState.userInteractionTimer = (gameState.userInteractionTimer || 0) + timeSinceLastFed;
        if (gameState.userInteractionTimer > 3) { // Reduced from 5 to 3 seconds
            gameState.userInteracted = false;
            gameState.userInteractionTimer = 0;
            
            // Resume exploration if not walking
            if (!gameState.isWalking && gameState.isExploring) {
                startWandering();
            }
        }
    }
}

// Update pet status based on current stats
function updatePetStatus() {
    if (gameState.hunger < 30) {
        gameState.status = 'slumber'; // Pet is hungry and tired
    } else if (gameState.happiness > 70) {
        gameState.status = 'happi'; // Pet is happy
    } else {
        gameState.status = 'normal'; // Pet is in normal state
    }
}

// Feed the pet
function feedPet() {
    if (gameState.connected) {
        // Send feed action to server
        sendMessage(ACTIONS.FEED);
    } else {
        // Local mode
        gameState.hunger = Math.min(100, gameState.hunger + 20);
        gameState.happiness = Math.min(100, gameState.happiness + 10);
        gameState.lastFed = Date.now();
        updatePetStatus();
        updateUI();
        logMessage('Fed Viscunam (+20 hunger, +10 happiness)', 'client');
    }
    
    // Add animation effect
    petSprite.classList.add('eating');
    setTimeout(() => {
        petSprite.classList.remove('eating');
    }, 1000);
    
    // Stop walking when feeding
    stopWalking();
    
    // Mark as user interaction
    gameState.userInteracted = true;
    gameState.userInteractionTimer = 0;
}

// Pet the Viscunam (new interaction)
function petTheViscunam() {
    // Increase happiness
    gameState.happiness = Math.min(100, gameState.happiness + 5);
    updatePetStatus();
    updateUI();
    logMessage('Petted Viscunam (+5 happiness)', 'client');
    
    // Add animation effect
    petSprite.style.transform = 'scale(1.1)';
    setTimeout(() => {
        petSprite.style.transform = '';
    }, 300);
    
    // Stop walking when being petted
    stopWalking();
    
    // Mark as user interaction
    gameState.userInteracted = true;
    gameState.userInteractionTimer = 0;
}

// Start walking
function startWalking() {
    if (gameState.isWalking) return;
    
    gameState.isWalking = true;
    
    // Start the walking animation and movement
    walkingInterval = setInterval(moveViscunam, 30); // Faster interval for smoother movement
    walkAnimationInterval = setInterval(updateWalkAnimation, gameState.walkAnimationSpeed); // Animation speed
}

// Stop walking
function stopWalking() {
    if (!gameState.isWalking) return;
    
    gameState.isWalking = false;
    gameState.targetPosition = null;
    clearInterval(walkingInterval);
    clearInterval(walkAnimationInterval);
    
    // Reset to normal standing sprite
    updateUI();
    
    // Set pause time before next exploration
    if (gameState.isExploring && !gameState.userInteracted) {
        gameState.pauseTime = Math.random() * gameState.maxPauseTime;
    }
}

// Toggle walking state
function toggleWalking() {
    if (gameState.isWalking) {
        stopWalking();
        logMessage('Viscunam stopped walking', 'client');
    } else {
        // Pick a random direction
        gameState.direction = Math.random() > 0.5 ? 1 : -1;
        startWalking();
        logMessage('Viscunam started walking', 'client');
    }
    
    // Mark as user interaction
    gameState.userInteracted = true;
    gameState.userInteractionTimer = 0;
}

// Toggle exploration mode
function toggleExploration() {
    gameState.isExploring = !gameState.isExploring;
    
    // Update button appearance
    if (gameState.isExploring) {
        exploreButton.classList.remove('inactive');
        exploreButton.classList.add('active');
        logMessage('Viscunam is now in exploration mode', 'client');
        if (!gameState.isWalking && !gameState.userInteracted) {
            startWandering();
        }
    } else {
        exploreButton.classList.remove('active');
        exploreButton.classList.add('inactive');
        logMessage('Viscunam is now in stationary mode', 'client');
        if (gameState.isWalking && gameState.targetPosition) {
            stopWalking();
        }
    }
}

// Update walking animation frame
function updateWalkAnimation() {
    if (!gameState.isWalking) return;
    
    // Toggle between walk frames 1 and 2
    gameState.walkStep = gameState.walkStep === 1 ? 2 : 1;
    
    // Update sprite for walking animation
    petSprite.src = `sprite/${gameState.status}_walk${gameState.walkStep}.png`;
}

// Move Viscunam around
function moveViscunam() {
    if (!gameState.isWalking) return;
    
    // If we have a target position, move towards it
    if (gameState.targetPosition) {
        const dx = gameState.targetPosition.x - gameState.position.x;
        
        // If we're close enough to the target, stop walking or pick a new target
        if (Math.abs(dx) < 1) {
            if (Math.random() < 0.7 && gameState.isExploring && !gameState.userInteracted) {
                // 70% chance to immediately pick a new target when reaching destination
                startWandering();
            } else {
                stopWalking();
            }
            return;
        }
        
        // Set direction based on target
        gameState.direction = dx > 0 ? 1 : -1;
    }
    
    // Calculate new position with smoother movement
    gameState.position.x += gameState.moveSpeed * gameState.direction;
    
    // Check boundaries and change direction if needed
    const margin = 5; // percentage from edge (reduced to allow more exploration area)
    if (gameState.position.x > (100 - margin)) {
        gameState.position.x = 100 - margin;
        gameState.direction = -1; // change direction to left
        
        // If we hit a boundary during autonomous movement, pick a new target
        if (gameState.targetPosition) {
            startWandering();
        }
    } else if (gameState.position.x < margin) {
        gameState.position.x = margin;
        gameState.direction = 1; // change direction to right
        
        // If we hit a boundary during autonomous movement, pick a new target
        if (gameState.targetPosition) {
            startWandering();
        }
    }
    
    // Update position
    petContainer.style.left = `${gameState.position.x}%`;
    
    // No flipping - just center the pet container
    petContainer.style.transform = 'translate(-50%, -50%)';
}

// Make Viscunam walk to a specific point
function walkToPoint(x, y) {
    // Convert click coordinates to percentage of screen
    const containerRect = gameContainer.getBoundingClientRect();
    const targetX = ((x - containerRect.left) / containerRect.width) * 100;
    
    // Set target position
    gameState.targetPosition = { x: targetX, y: gameState.position.y };
    
    // Determine direction
    if (targetX > gameState.position.x) {
        gameState.direction = 1; // right
    } else {
        gameState.direction = -1; // left
    }
    
    // Start walking
    startWalking();
    
    // Mark as user interaction
    gameState.userInteracted = true;
    gameState.userInteractionTimer = 0;
    
    logMessage('Viscunam is walking to a new location', 'client');
}

// Start wandering to a random location
function startWandering() {
    // Don't interrupt if user is interacting
    if (gameState.userInteracted) return;
    
    // Don't start if not in exploration mode
    if (!gameState.isExploring) return;
    
    // Pick a random position on the screen - more varied destinations
    const margin = 10; // percentage from edge
    
    // Choose between targeted exploration or completely random position
    let randomX;
    if (Math.random() < 0.7) {
        // 70% chance: Pick a completely random position across the screen
        randomX = margin + Math.random() * (100 - 2 * margin);
    } else {
        // 30% chance: Pick a position near current location
        const centerX = gameState.position.x;
        const range = 30; // smaller range for local exploration
        const minX = Math.max(margin, centerX - range);
        const maxX = Math.min(100 - margin, centerX + range);
        randomX = minX + Math.random() * (maxX - minX);
    }
    
    // Set as target
    gameState.targetPosition = { x: randomX, y: gameState.position.y };
    
    // Determine direction
    gameState.direction = randomX > gameState.position.x ? 1 : -1;
    
    // Start walking
    startWalking();
}

// Update UI based on game state
function updateUI() {
    // Update progress bars
    hungerBar.style.width = `${gameState.hunger}%`;
    happinessBar.style.width = `${gameState.happiness}%`;
    
    // Update pet sprite based on status and walking state
    if (gameState.isWalking) {
        petSprite.src = `sprite/${gameState.status}_walk${gameState.walkStep}.png`;
    } else {
        petSprite.src = `sprite/${gameState.status}_normal.png`;
    }
    
    // Update pet position
    petContainer.style.left = `${gameState.position.x}%`;
    petContainer.style.top = `${gameState.position.y}%`;
    
    // No flipping - just center the pet container
    petContainer.style.transform = 'translate(-50%, -50%)';
    
    // Update feed button state
    feedButton.disabled = !gameState.connected && gameState.hunger >= 100;
    
    // Update explore button state
    if (gameState.isExploring) {
        exploreButton.classList.remove('inactive');
        exploreButton.classList.add('active');
    } else {
        exploreButton.classList.remove('active');
        exploreButton.classList.add('inactive');
    }
}

// Log message to the message container
function logMessage(message, type = 'info') {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', type);
    messageElement.textContent = message;
    
    messageContainer.appendChild(messageElement);
    messageContainer.scrollTop = messageContainer.scrollHeight;
    
    // Limit the number of messages (keep last 50)
    while (messageContainer.children.length > 50) {
        messageContainer.removeChild(messageContainer.firstChild);
    }
}

// Add CSS for the eating animation
function addAnimationStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes eating {
            0%, 100% { transform: translateY(0); }
            25% { transform: translateY(5px); }
            50% { transform: translateY(0); }
            75% { transform: translateY(5px); }
        }
        
        .eating {
            animation: eating 0.5s ease-in-out;
        }
    `;
    document.head.appendChild(style);
}

// Event listeners
feedButton.addEventListener('click', feedPet);
exploreButton.addEventListener('click', toggleExploration);
petContainer.addEventListener('click', petTheViscunam);

// Double click on pet to toggle walking
petContainer.addEventListener('dblclick', toggleWalking);

// Click on game container to make Viscunam walk to that point
gameContainer.addEventListener('click', (event) => {
    // Ignore clicks on the pet itself or UI elements
    if (event.target !== gameContainer) return;
    
    walkToPoint(event.clientX, event.clientY);
});

// Initialize the game
function init() {
    addAnimationStyles();
    
    // Position pet container absolutely
    petContainer.style.position = 'absolute';
    petContainer.style.left = `${gameState.position.x}%`;
    petContainer.style.top = `${gameState.position.y}%`;
    petContainer.style.transform = 'translate(-50%, -50%)';
    
    // Set initial button states
    if (gameState.isExploring) {
        exploreButton.classList.add('active');
        exploreButton.classList.remove('inactive');
    } else {
        exploreButton.classList.add('inactive');
        exploreButton.classList.remove('active');
    }
    
    updateUI();
    
    // Try to connect to server
    connectToServer();
    
    // Fallback to local mode if server connection fails
    // This is handled in the connectToServer function
    
    // Start exploration immediately
    setTimeout(() => {
        if (gameState.isExploring) {
            startWandering();
        }
    }, 500); // Start exploring sooner
    
    // Set up continuous exploration check
    setInterval(() => {
        // If not walking and in exploration mode, start wandering
        if (!gameState.isWalking && gameState.isExploring && !gameState.userInteracted && gameState.pauseTime <= 0) {
            startWandering();
        }
    }, 300); // Check more frequently
}

// Global variables for intervals
let walkingInterval;
let walkAnimationInterval;

// Start the game when the page loads
window.addEventListener('load', init); 