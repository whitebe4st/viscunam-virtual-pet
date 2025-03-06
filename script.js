// Viscunam Game - Client Side
// This is a virtual pet game using a custom application-layer protocol over WebSockets

// Game state
const gameState = {
    hunger: 100, // 0-100, 0 is starving, 100 is full
    happiness: 100, // 0-100, 0 is sad, 100 is happy
    sleepiness: 0, // 0-100, 0 is awake, 100 is very sleepy
    lastFed: Date.now(),
    lastSlept: Date.now(), // Track when Viscunam last slept
    status: 'normal', // normal, happy, slumber
    connected: false,
    isWalking: false,
    walkStep: 1, // 1 or 2 for animation frames
    position: { x: 50, y: 50 }, // percentage of screen
    direction: { x: 1, y: 0 }, // direction vector
    walkAnimationSpeed: 400, // milliseconds between animation frames (slower = cuter)
    moveSpeed: 0.3, // percentage of screen per step
    targetPosition: null, // target position for autonomous movement
    pauseTime: 0, // time to pause between explorations
    maxPauseTime: 1.5, // maximum pause time in seconds (reduced for more frequent movement)
    isExploring: true, // whether Viscunam is in exploration mode
    explorationRange: { x: 100, y: 70 }, // percentage of screen for exploration
    userInteracted: false, // flag to track if user has interacted recently
    restlessness: 0.8, // probability of changing direction during exploration (increased for more active movement)
    debugMode: false, // whether debug mode is active
    zScaleFactor: 0.5, // how much to scale based on z position (depth perception)
    minScale: 0.7, // minimum scale factor for z-axis movement
    maxScale: 1.3, // maximum scale factor for z-axis movement
    isSleeping: false // whether Viscunam is currently sleeping
};

// DOM Elements
const petSprite = document.getElementById('pet-sprite');
const petContainer = document.querySelector('.pet-container');
const hungerBar = document.getElementById('hunger-bar');
const happinessBar = document.getElementById('happiness-bar');
const sleepinessBar = document.getElementById('sleepiness-bar');
const feedButton = document.getElementById('feed-btn');
const exploreButton = document.getElementById('explore-btn');
const sleepButton = document.getElementById('sleep-btn');
const messageContainer = document.getElementById('message-container');
const gameContainer = document.querySelector('.game-container');
const cakeSprite = document.getElementById('cake-sprite');
const cakeContainer = document.getElementById('cake-container');
const coffeeSprite = document.getElementById('coffee-sprite');
const coffeeContainer = document.getElementById('coffee-container');
const clearMessagesBtn = document.getElementById('clear-messages');

// Debug Menu Elements
const debugMenu = document.querySelector('.debug-menu');
const toggleDebugButton = document.getElementById('toggle-debug');
const hungerDecreaseButton = document.getElementById('hunger-decrease');
const hungerIncreaseButton = document.getElementById('hunger-increase');
const hungerZeroButton = document.getElementById('hunger-zero');
const hungerFullButton = document.getElementById('hunger-full');
const happinessDecreaseButton = document.getElementById('happiness-decrease');
const happinessIncreaseButton = document.getElementById('happiness-increase');
const happinessZeroButton = document.getElementById('happiness-zero');
const happinessFullButton = document.getElementById('happiness-full');
const sleepinessDecreaseButton = document.getElementById('sleepiness-decrease');
const sleepinessIncreaseButton = document.getElementById('sleepiness-increase');
const sleepinessZeroButton = document.getElementById('sleepiness-zero');
const sleepinessFullButton = document.getElementById('sleepiness-full');

// DOM Elements for debug sprite buttons
const checkSpritesButton = document.getElementById('check-sprites');
const logCurrentSpriteButton = document.getElementById('log-current-sprite');

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
    COFFEE: 'COFFEE',
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
            if (params.sleepiness) gameState.sleepiness = parseInt(params.sleepiness);
            if (params.status) gameState.status = params.status;
            updateUI();
            break;
            
        case ACTIONS.COFFEE:
            // Server acknowledges coffee action directly
            // Reduce sleepiness
            modifySleepiness(-30);
            
            // Increase happiness slightly
            modifyHappiness(5);
            
            // Update status
            updatePetStatus();
            updateUI();
            
            // Log message
            logMessage('Viscunam drank coffee and feels energized! (-30 sleepiness)', 'client');
            break;
            
        case 'STATUS':
            const statusCode = params.code;
            const statusMessage = params.message;
            
            if (statusCode === '200') {
                logMessage(`Success: ${statusMessage}`, 'server');
                
                // If this is a response to a COFFEE action, update the pet
                if (params.action === ACTIONS.COFFEE) {
                    // Reduce sleepiness
                    modifySleepiness(-30);
                    
                    // Increase happiness slightly
                    modifyHappiness(5);
                    
                    // Update status
                    updatePetStatus();
                    updateUI();
                    
                    // Log message
                    logMessage('Viscunam drank coffee and feels energized! (-30 sleepiness)', 'client');
                }
            } else {
                logMessage(`Error (${statusCode}): ${statusMessage}`, 'error');
                
                // If this is a response to a COFFEE action with status 400, show a specific message
                if (params.action === ACTIONS.COFFEE && statusCode === '400') {
                    // Show a message that Viscunam doesn't need coffee
                    logMessage('Viscunam doesn\'t want any more coffee right now!', 'client');
                    
                    // Maybe add a visual indication that the coffee was rejected
                    petSprite.classList.add('shake');
                    setTimeout(() => {
                        petSprite.classList.remove('shake');
                    }, 500);
                }
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
    const timeSinceLastSlept = (currentTime - gameState.lastSlept) / 1000; // in seconds
    
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
    
    // Increase sleepiness over time (1 point per 10 seconds)
    if (gameState.isSleeping) {
        // Decrease sleepiness while sleeping (5 points per second)
        gameState.sleepiness = Math.max(0, gameState.sleepiness - (timeSinceLastFed * 5));
        
        // Wake up automatically when fully rested
        if (gameState.sleepiness === 0 && gameState.isSleeping) {
            toggleSleep(); // Wake up
        }
    } else {
        // Increase sleepiness while awake
        gameState.sleepiness = Math.min(100, gameState.sleepiness + (timeSinceLastFed / 10));
        
        // Walking makes Viscunam more tired
        if (gameState.isWalking) {
            gameState.sleepiness = Math.min(100, gameState.sleepiness + (timeSinceLastFed / 20));
        }
    }
    
    // Update pet status based on stats
    updatePetStatus();
    
    // Reset timer
    gameState.lastFed = currentTime;
    
    // Handle continuous exploration
    if (gameState.isExploring && !gameState.userInteracted && !gameState.isSleeping) {
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
    // If sleeping or very sleepy, status is slumber
    if (gameState.isSleeping || gameState.sleepiness > 80) {
        gameState.status = 'slumber';
        return;
    }
    
    // Then check hunger and happiness
    if (gameState.hunger < 30) {
        gameState.status = 'normal'; // Pet is hungry but not sleepy
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
    petSprite.classList.add('feeding');
    setTimeout(() => {
        petSprite.classList.remove('feeding');
    }, 1000);
    
    // Stop walking when feeding
    stopWalking();
    
    // Mark as user interaction
    gameState.userInteracted = true;
    gameState.userInteractionTimer = 0;
}

// Create a cake clone and animate it to the pet
function animateCakeFeeding() {
    // Create a clone of the cake
    const cakeClone = cakeSprite.cloneNode(true);
    document.body.appendChild(cakeClone);
    
    // Position the clone at the original cake's position
    const cakeRect = cakeSprite.getBoundingClientRect();
    const petRect = petSprite.getBoundingClientRect();
    
    cakeClone.style.position = 'fixed';
    cakeClone.style.left = `${cakeRect.left}px`;
    cakeClone.style.top = `${cakeRect.top}px`;
    cakeClone.style.width = `${cakeRect.width}px`;
    cakeClone.style.height = `${cakeRect.height}px`;
    cakeClone.style.zIndex = '1000';
    
    // Calculate the target position (center of the pet)
    const targetX = petRect.left + petRect.width / 2 - cakeRect.left;
    const targetY = petRect.top + petRect.height / 2 - cakeRect.top;
    
    // Set the CSS variables for the animation
    cakeClone.style.setProperty('--target-x', `${targetX}px`);
    cakeClone.style.setProperty('--target-y', `${targetY}px`);
    
    // Add the animation class
    cakeClone.classList.add('float-to-pet');
    
    // Remove the clone after animation completes
    setTimeout(() => {
        document.body.removeChild(cakeClone);
        feedPet();
    }, 800);
}

// Variables for coffee drag and drop
let isDraggingCoffee = false;
let draggedCoffee = null;
let coffeeOffsetX = 0;
let coffeeOffsetY = 0;

// Initialize coffee drag and drop
function initCoffeeDragDrop() {
    // Make coffee draggable
    coffeeSprite.setAttribute('draggable', 'true');
    
    // Drag start
    coffeeSprite.addEventListener('dragstart', (e) => {
        console.log('Coffee drag start');
        e.dataTransfer.setData('text/plain', 'coffee');
        e.dataTransfer.effectAllowed = 'move';
        
        // Create a custom drag image
        const dragIcon = document.createElement('img');
        dragIcon.src = coffeeSprite.src;
        dragIcon.style.width = '40px';
        dragIcon.style.height = '40px';
        e.dataTransfer.setDragImage(dragIcon, 20, 20);
    });
    
    // Alternative touch/mouse implementation for better mobile support
    coffeeSprite.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Only left mouse button
        
        e.preventDefault();
        
        // Create a clone for dragging
        draggedCoffee = coffeeSprite.cloneNode(true);
        document.body.appendChild(draggedCoffee);
        
        // Style the clone
        draggedCoffee.style.position = 'fixed';
        draggedCoffee.style.zIndex = '1000';
        draggedCoffee.style.opacity = '0.7';
        draggedCoffee.style.pointerEvents = 'none';
        draggedCoffee.style.width = '30px'; // Smaller size
        draggedCoffee.style.height = '30px'; // Smaller size
        
        // Calculate offset
        const rect = coffeeSprite.getBoundingClientRect();
        coffeeOffsetX = e.clientX - rect.left;
        coffeeOffsetY = e.clientY - rect.top;
        
        // Position the clone
        draggedCoffee.style.left = `${e.clientX - coffeeOffsetX}px`;
        draggedCoffee.style.top = `${e.clientY - coffeeOffsetY}px`;
        
        isDraggingCoffee = true;
    });
    
    // Touch events for mobile
    coffeeSprite.addEventListener('touchstart', (e) => {
        e.preventDefault();
        
        // Create a clone for dragging
        draggedCoffee = coffeeSprite.cloneNode(true);
        document.body.appendChild(draggedCoffee);
        
        // Style the clone
        draggedCoffee.style.position = 'fixed';
        draggedCoffee.style.zIndex = '1000';
        draggedCoffee.style.opacity = '0.7';
        draggedCoffee.style.pointerEvents = 'none';
        
        // Calculate offset
        const touch = e.touches[0];
        const rect = coffeeSprite.getBoundingClientRect();
        coffeeOffsetX = touch.clientX - rect.left;
        coffeeOffsetY = touch.clientY - rect.top;
        
        // Position the clone
        draggedCoffee.style.left = `${touch.clientX - coffeeOffsetX}px`;
        draggedCoffee.style.top = `${touch.clientY - coffeeOffsetY}px`;
        
        isDraggingCoffee = true;
    });
}

// Update the mousemove event to handle both cake and coffee
document.addEventListener('mousemove', (e) => {
    // Handle cake dragging
    if (isDragging && draggedCake) {
        // Move the clone
        draggedCake.style.left = `${e.clientX - offsetX}px`;
        draggedCake.style.top = `${e.clientY - offsetY}px`;
        
        // Check if over pet
        const petRect = petContainer.getBoundingClientRect();
        if (
            e.clientX >= petRect.left && 
            e.clientX <= petRect.right && 
            e.clientY >= petRect.top && 
            e.clientY <= petRect.bottom
        ) {
            petContainer.classList.add('can-feed');
        } else {
            petContainer.classList.remove('can-feed');
        }
    }
    
    // Handle coffee dragging
    if (isDraggingCoffee && draggedCoffee) {
        // Move the clone
        draggedCoffee.style.left = `${e.clientX - coffeeOffsetX}px`;
        draggedCoffee.style.top = `${e.clientY - coffeeOffsetY}px`;
        
        // Check if over pet
        const petRect = petContainer.getBoundingClientRect();
        if (
            e.clientX >= petRect.left && 
            e.clientX <= petRect.right && 
            e.clientY >= petRect.top && 
            e.clientY <= petRect.bottom
        ) {
            petContainer.classList.add('can-feed');
        } else {
            petContainer.classList.remove('can-feed');
        }
    }
});

// Update the mouseup event to handle both cake and coffee
document.addEventListener('mouseup', (e) => {
    // Handle cake drop
    if (isDragging && draggedCake) {
        // Check if dropped on pet
        const petRect = petContainer.getBoundingClientRect();
        if (
            e.clientX >= petRect.left && 
            e.clientX <= petRect.right && 
            e.clientY >= petRect.top && 
            e.clientY <= petRect.bottom
        ) {
            // Remove the dragged clone
            document.body.removeChild(draggedCake);
            draggedCake = null;
            
            // Feed the pet with animation
            animateCakeFeeding();
        } else if (draggedCake) {
            // Remove the dragged clone
            document.body.removeChild(draggedCake);
            draggedCake = null;
        }
        
        petContainer.classList.remove('can-feed');
        isDragging = false;
    }
    
    // Handle coffee drop
    if (isDraggingCoffee && draggedCoffee) {
        // Check if dropped on pet
        const petRect = petContainer.getBoundingClientRect();
        if (
            e.clientX >= petRect.left && 
            e.clientX <= petRect.right && 
            e.clientY >= petRect.top && 
            e.clientY <= petRect.bottom
        ) {
            // Remove the dragged clone
            document.body.removeChild(draggedCoffee);
            draggedCoffee = null;
            
            // Give coffee to the pet with animation
            animateCoffeeFeeding();
        } else if (draggedCoffee) {
            // Remove the dragged clone
            document.body.removeChild(draggedCoffee);
            draggedCoffee = null;
        }
        
        petContainer.classList.remove('can-feed');
        isDraggingCoffee = false;
    }
});

// Update the touchmove event to handle both cake and coffee
document.addEventListener('touchmove', (e) => {
    // Handle cake dragging
    if (isDragging && draggedCake) {
        const touch = e.touches[0];
        
        // Move the clone
        draggedCake.style.left = `${touch.clientX - offsetX}px`;
        draggedCake.style.top = `${touch.clientY - offsetY}px`;
        
        // Check if over pet
        const petRect = petContainer.getBoundingClientRect();
        if (
            touch.clientX >= petRect.left && 
            touch.clientX <= petRect.right && 
            touch.clientY >= petRect.top && 
            touch.clientY <= petRect.bottom
        ) {
            petContainer.classList.add('can-feed');
        } else {
            petContainer.classList.remove('can-feed');
        }
        
        // Prevent scrolling
        e.preventDefault();
    }
    
    // Handle coffee dragging
    if (isDraggingCoffee && draggedCoffee) {
        const touch = e.touches[0];
        
        // Move the clone
        draggedCoffee.style.left = `${touch.clientX - coffeeOffsetX}px`;
        draggedCoffee.style.top = `${touch.clientY - coffeeOffsetY}px`;
        
        // Check if over pet
        const petRect = petContainer.getBoundingClientRect();
        if (
            touch.clientX >= petRect.left && 
            touch.clientX <= petRect.right && 
            touch.clientY >= petRect.top && 
            touch.clientY <= petRect.bottom
        ) {
            petContainer.classList.add('can-feed');
        } else {
            petContainer.classList.remove('can-feed');
        }
        
        // Prevent scrolling
        e.preventDefault();
    }
});

// Update the touchend event to handle both cake and coffee
document.addEventListener('touchend', (e) => {
    // Handle cake drop
    if (isDragging && draggedCake) {
        // Get the last touch position
        const lastTouch = e.changedTouches[0];
        
        // Check if dropped on pet
        const petRect = petContainer.getBoundingClientRect();
        if (
            lastTouch.clientX >= petRect.left && 
            lastTouch.clientX <= petRect.right && 
            lastTouch.clientY >= petRect.top && 
            lastTouch.clientY <= petRect.bottom
        ) {
            // Remove the dragged clone
            document.body.removeChild(draggedCake);
            draggedCake = null;
            
            // Feed the pet with animation
            animateCakeFeeding();
        } else if (draggedCake) {
            // Remove the dragged clone
            document.body.removeChild(draggedCake);
            draggedCake = null;
        }
        
        petContainer.classList.remove('can-feed');
        isDragging = false;
    }
    
    // Handle coffee drop
    if (isDraggingCoffee && draggedCoffee) {
        // Get the last touch position
        const lastTouch = e.changedTouches[0];
        
        // Check if dropped on pet
        const petRect = petContainer.getBoundingClientRect();
        if (
            lastTouch.clientX >= petRect.left && 
            lastTouch.clientX <= petRect.right && 
            lastTouch.clientY >= petRect.top && 
            lastTouch.clientY <= petRect.bottom
        ) {
            // Remove the dragged clone
            document.body.removeChild(draggedCoffee);
            draggedCoffee = null;
            
            // Give coffee to the pet with animation
            animateCoffeeFeeding();
        } else if (draggedCoffee) {
            // Remove the dragged clone
            document.body.removeChild(draggedCoffee);
            draggedCoffee = null;
        }
        
        petContainer.classList.remove('can-feed');
        isDraggingCoffee = false;
    }
});

// Update the drop event on pet container to handle both cake and coffee
petContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    console.log('Drop on pet');
    petContainer.classList.remove('can-feed');
    
    // Check what was dropped
    const data = e.dataTransfer.getData('text/plain');
    if (data === 'cake') {
        // Feed the pet with cake
        animateCakeFeeding();
    } else if (data === 'coffee') {
        // Give coffee to the pet
        animateCoffeeFeeding();
    }
});

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
        gameState.direction = Math.random() > 0.5 ? { x: 1, y: 0 } : { x: -1, y: 0 };
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

// Toggle debug menu
function toggleDebugMenu() {
    gameState.debugMode = !gameState.debugMode;
    
    if (gameState.debugMode) {
        debugMenu.classList.add('active');
        toggleDebugButton.textContent = 'Hide Debug Menu';
    } else {
        debugMenu.classList.remove('active');
        toggleDebugButton.textContent = 'Show Debug Menu';
    }
}

// Debug functions to modify hunger and happiness
function modifyHunger(amount) {
    gameState.hunger = Math.max(0, Math.min(100, gameState.hunger + amount));
    updatePetStatus();
    updateUI();
    logMessage(`Debug: Hunger set to ${gameState.hunger}`, 'client');
}

function modifyHappiness(amount) {
    gameState.happiness = Math.max(0, Math.min(100, gameState.happiness + amount));
    updatePetStatus();
    updateUI();
    logMessage(`Debug: Happiness set to ${gameState.happiness}`, 'client');
}

function setHunger(value) {
    gameState.hunger = value;
    updatePetStatus();
    updateUI();
    logMessage(`Debug: Hunger set to ${value}`, 'client');
}

function setHappiness(value) {
    gameState.happiness = value;
    updatePetStatus();
    updateUI();
    logMessage(`Debug: Happiness set to ${value}`, 'client');
}

// Update walking animation frame
function updateWalkAnimation() {
    if (!gameState.isWalking) return;
    
    // Toggle between walk frames 1 and 2
    gameState.walkStep = gameState.walkStep === 1 ? 2 : 1;
    
    // Determine sprite filename
    let spriteFilename;
    if (gameState.status === 'slumber') {
        spriteFilename = `sprite/slumber_walking${gameState.walkStep}.png`;
    } else {
        spriteFilename = `sprite/${gameState.status}_walk${gameState.walkStep}.png`;
    }
    
    // Log the sprite being used if in debug mode
    if (gameState.debugMode) {
        logMessage(`Debug: Walking animation using ${spriteFilename}`, 'client');
    }
    
    // Set the sprite with error handling
    petSprite.onerror = () => {
        logMessage(`Error: Failed to load walking sprite ${spriteFilename}`, 'error');
        // Try to fall back to normal sprite
        if (spriteFilename !== 'sprite/normal.png') {
            petSprite.src = 'sprite/normal.png';
            logMessage('Debug: Falling back to normal.png', 'client');
        }
    };
    
    // Update sprite for walking animation
    petSprite.src = spriteFilename;
}

// Move Viscunam based on current direction and speed
function moveViscunam() {
    if (!gameState.isWalking || !gameState.targetPosition) return;
    
    // Calculate direction to target
    const dx = gameState.targetPosition.x - gameState.position.x;
    const dy = gameState.targetPosition.y - gameState.position.y;
    
    // Calculate distance to target
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    // If we're close enough to the target, stop walking or pick a new target
    if (distance < 1) {
        if (gameState.isExploring && !gameState.userInteracted && Math.random() < 0.7) {
            // 70% chance to pick a new target if we're exploring and not interacted with
            pickRandomTarget();
        } else {
            stopWalking();
        }
        return;
    }
    
    // Normalize direction vector
    gameState.direction = {
        x: dx / distance,
        y: dy / distance
    };
    
    // Define boundaries
    const margin = 5; // percentage from edge
    const yMargin = 10; // percentage from top/bottom
    
    // Calculate new position with boundary checks
    let newX = gameState.position.x + gameState.moveSpeed * gameState.direction.x;
    let newY = gameState.position.y + gameState.moveSpeed * gameState.direction.y;
    
    // Check if new position would be out of bounds
    let hitBoundary = false;
    
    // X-axis boundaries
    if (newX > 100 - margin) {
        newX = 100 - margin;
        hitBoundary = true;
    } else if (newX < margin) {
        newX = margin;
        hitBoundary = true;
    }
    
    // Y-axis boundaries
    if (newY > 100 - yMargin) {
        newY = 100 - yMargin;
        hitBoundary = true;
    } else if (newY < yMargin) {
        newY = yMargin;
        hitBoundary = true;
    }
    
    // Update position
    gameState.position.x = newX;
    gameState.position.y = newY;
    
    // If we hit a boundary, either pick a new target or stop walking
    if (hitBoundary) {
        if (gameState.isExploring && Math.random() < gameState.restlessness) {
            // Start wandering in a new direction
            startWandering();
        } else {
            // Stop at the boundary
            stopWalking();
        }
    }
    
    // Update position in the DOM
    petContainer.style.left = `${gameState.position.x}%`;
    petContainer.style.top = `${gameState.position.y}%`;
    
    // Apply flip based on movement direction
    if (gameState.isWalking && gameState.direction.x > 0) {
        // Moving right - flip the sprite
        petContainer.style.transform = 'translate(-50%, -50%) scaleX(-1)';
    } else if (gameState.isWalking) {
        // Moving left - normal orientation
        petContainer.style.transform = 'translate(-50%, -50%)';
    } else {
        // Not walking - use last direction for orientation
        petContainer.style.transform = gameState.direction.x >= 0 ? 
            'translate(-50%, -50%) scaleX(-1)' : 'translate(-50%, -50%)';
    }
    
    // Debug info
    if (gameState.debugMode) {
        logMessage(`Position: x=${gameState.position.x.toFixed(1)}, y=${gameState.position.y.toFixed(1)}`, 'client');
    }
}

// Walk to a specific point on the screen
function walkToPoint(x, y) {
    // Convert click coordinates to percentage of screen
    const targetX = (x / window.innerWidth) * 100;
    const targetY = (y / window.innerHeight) * 100;
    
    // Ensure target is within bounds
    const margin = 5; // percentage from edge
    const yMargin = 10; // percentage from top/bottom
    
    const boundedX = Math.max(margin, Math.min(100 - margin, targetX));
    const boundedY = Math.max(yMargin, Math.min(100 - yMargin, targetY));
    
    // Set as target
    gameState.targetPosition = { x: boundedX, y: boundedY };
    
    // Calculate direction vector
    const dx = boundedX - gameState.position.x;
    const dy = boundedY - gameState.position.y;
    
    // Set initial direction
    gameState.direction = { 
        x: dx, 
        y: dy 
    };
    
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
    
    // Don't start if not in exploration mode or if sleeping
    if (!gameState.isExploring || gameState.isSleeping) return;
    
    const margin = 5; // percentage from edge
    const yMargin = 10; // percentage from top/bottom
    
    let randomX, randomY;
    
    // 70% chance: Pick a completely random position
    if (Math.random() < 0.7) {
        randomX = margin + Math.random() * (100 - 2 * margin);
        randomY = yMargin + Math.random() * (100 - 2 * yMargin);
    } else {
        // 30% chance: Pick a position near current location
        const centerX = gameState.position.x;
        const centerY = gameState.position.y;
        
        const rangeX = 30; // smaller range for local exploration
        const rangeY = 20;
        
        const minX = Math.max(margin, centerX - rangeX);
        const maxX = Math.min(100 - margin, centerX + rangeX);
        randomX = minX + Math.random() * (maxX - minX);
        
        const minY = Math.max(yMargin, centerY - rangeY);
        const maxY = Math.min(100 - yMargin, centerY + rangeY);
        randomY = minY + Math.random() * (maxY - minY);
    }
    
    // Ensure positions are within bounds (extra safety check)
    randomX = Math.max(margin, Math.min(100 - margin, randomX));
    randomY = Math.max(yMargin, Math.min(100 - yMargin, randomY));
    
    // Set as target
    gameState.targetPosition = { 
        x: randomX, 
        y: randomY 
    };
    
    // Calculate direction vector
    const dx = randomX - gameState.position.x;
    const dy = randomY - gameState.position.y;
    
    // Set initial direction
    gameState.direction = { 
        x: dx, 
        y: dy 
    };
    
    // Start walking
    startWalking();
}

// Update UI based on game state
function updateUI() {
    // Update progress bars
    hungerBar.style.width = `${gameState.hunger}%`;
    happinessBar.style.width = `${gameState.happiness}%`;
    sleepinessBar.style.width = `${gameState.sleepiness}%`;
    
    // Determine sprite filename based on status and walking state
    let spriteFilename;
    if (gameState.isWalking) {
        // Fix for slumber state which has different naming convention
        if (gameState.status === 'slumber') {
            spriteFilename = `sprite/slumber_walking${gameState.walkStep}.png`;
        } else {
            spriteFilename = `sprite/${gameState.status}_walk${gameState.walkStep}.png`;
        }
    } else {
        // Fix for normal state which doesn't have the _normal suffix
        if (gameState.status === 'normal') {
            spriteFilename = 'sprite/normal.png';
        } else {
            spriteFilename = `sprite/${gameState.status}_normal.png`;
        }
    }
    
    // Log the sprite being used
    if (gameState.debugMode || petSprite.src.split('/').pop() !== spriteFilename.split('/').pop()) {
        logMessage(`Debug: Using sprite ${spriteFilename}`, 'client');
    }
    
    // Set the sprite with error handling
    petSprite.onerror = () => {
        logMessage(`Error: Failed to load sprite ${spriteFilename}`, 'error');
        // Try to fall back to normal sprite
        if (spriteFilename !== 'sprite/normal.png') {
            petSprite.src = 'sprite/normal.png';
            logMessage('Debug: Falling back to normal.png', 'client');
        }
    };
    
    petSprite.src = spriteFilename;
    
    // Update pet position
    petContainer.style.left = `${gameState.position.x}%`;
    petContainer.style.top = `${gameState.position.y}%`;
    
    // Apply flip based on movement direction
    if (gameState.isWalking && gameState.direction.x > 0) {
        // Moving right - flip the sprite
        petContainer.style.transform = 'translate(-50%, -50%) scaleX(-1)';
    } else if (gameState.isWalking) {
        // Moving left - normal orientation
        petContainer.style.transform = 'translate(-50%, -50%)';
    } else {
        // Not walking - use last direction for orientation
        petContainer.style.transform = gameState.direction.x >= 0 ? 
            'translate(-50%, -50%) scaleX(-1)' : 'translate(-50%, -50%)';
    }
    
    // Update hungry indicator
    if (gameState.hunger < 70) {
        petContainer.classList.add('hungry');
    } else {
        petContainer.classList.remove('hungry');
    }
    
    // Update sleepy indicator
    if (gameState.sleepiness > 70 && !gameState.isSleeping) {
        petContainer.classList.add('sleepy');
    } else {
        petContainer.classList.remove('sleepy');
    }
    
    // Update feed button state
    feedButton.disabled = !gameState.connected && gameState.hunger >= 100;
    
    // Update sleep button text
    sleepButton.textContent = gameState.isSleeping ? 'Wake Up' : 'Sleep';
    
    // Update explore button state
    if (gameState.isExploring) {
        exploreButton.classList.remove('inactive');
        exploreButton.classList.add('active');
    } else {
        exploreButton.classList.remove('active');
        exploreButton.classList.add('inactive');
    }
    
    // Log status changes for debugging
    if (gameState.hunger < 30 && petSprite.dataset.lastStatus !== 'slumber') {
        logMessage('Viscunam is getting hungry and tired...', 'client');
        petSprite.dataset.lastStatus = 'slumber';
    } else if (gameState.happiness > 70 && petSprite.dataset.lastStatus !== 'happi') {
        logMessage('Viscunam is happy!', 'client');
        petSprite.dataset.lastStatus = 'happi';
    } else if (gameState.hunger >= 30 && gameState.happiness <= 70 && petSprite.dataset.lastStatus !== 'normal') {
        logMessage('Viscunam is feeling normal', 'client');
        petSprite.dataset.lastStatus = 'normal';
    }
}

// Log message to the message container
function logMessage(message, type = 'info') {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', type);
    
    // Add timestamp
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    // Create timestamp span with bold styling
    const timestampSpan = document.createElement('span');
    timestampSpan.classList.add('timestamp');
    timestampSpan.textContent = `[${timestamp}] `;
    timestampSpan.style.fontWeight = 'bold';
    
    // Add timestamp and message
    messageElement.appendChild(timestampSpan);
    messageElement.appendChild(document.createTextNode(message));
    
    messageContainer.appendChild(messageElement);
    messageContainer.scrollTop = messageContainer.scrollHeight;
    
    // Limit the number of messages (keep last 100)
    while (messageContainer.children.length > 100) {
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

// Event listeners with prevention of default behavior
feedButton.addEventListener('click', (event) => {
    event.preventDefault();
    feedPet();
});

// Add a click event for the cake container as a fallback
cakeContainer.addEventListener('click', (event) => {
    event.preventDefault();
    if (gameState.debugMode) {
        logMessage('Debug: Cake container clicked', 'client');
    }
    // If clicking doesn't work for dragging, at least allow clicking to feed
    if (!isDragging) {
        animateCakeFeeding();
    }
});

exploreButton.addEventListener('click', (event) => {
    event.preventDefault();
    toggleExploration();
});

sleepButton.addEventListener('click', (event) => {
    event.preventDefault();
    toggleSleep();
});

petContainer.addEventListener('click', (event) => {
    event.preventDefault();
    petTheViscunam();
});

// Debug menu event listeners
hungerDecreaseButton.addEventListener('click', (event) => {
    event.preventDefault();
    modifyHunger(-20);
});

hungerIncreaseButton.addEventListener('click', (event) => {
    event.preventDefault();
    modifyHunger(20);
});

hungerZeroButton.addEventListener('click', (event) => {
    event.preventDefault();
    setHunger(0);
});

hungerFullButton.addEventListener('click', (event) => {
    event.preventDefault();
    setHunger(100);
});

happinessDecreaseButton.addEventListener('click', (event) => {
    event.preventDefault();
    modifyHappiness(-20);
});

happinessIncreaseButton.addEventListener('click', (event) => {
    event.preventDefault();
    modifyHappiness(20);
});

happinessZeroButton.addEventListener('click', (event) => {
    event.preventDefault();
    setHappiness(0);
});

happinessFullButton.addEventListener('click', (event) => {
    event.preventDefault();
    setHappiness(100);
});

sleepinessDecreaseButton.addEventListener('click', (event) => {
    event.preventDefault();
    modifySleepiness(-20);
});

sleepinessIncreaseButton.addEventListener('click', (event) => {
    event.preventDefault();
    modifySleepiness(20);
});

sleepinessZeroButton.addEventListener('click', (event) => {
    event.preventDefault();
    setSleepiness(0);
});

sleepinessFullButton.addEventListener('click', (event) => {
    event.preventDefault();
    setSleepiness(100);
});

// Double click on pet to toggle walking
petContainer.addEventListener('dblclick', (event) => {
    // Prevent default behavior (text selection)
    event.preventDefault();
    event.stopPropagation();
    toggleWalking();
});

// Click on game container to make Viscunam walk to that point
gameContainer.addEventListener('click', (event) => {
    event.preventDefault();
    
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
    
    // Set initial orientation based on direction
    petContainer.style.transform = gameState.direction.x >= 0 ? 
        'translate(-50%, -50%) scaleX(-1)' : 'translate(-50%, -50%)';
    
    // Set initial button states
    if (gameState.isExploring) {
        exploreButton.classList.add('active');
        exploreButton.classList.remove('inactive');
    } else {
        exploreButton.classList.add('inactive');
        exploreButton.classList.remove('active');
    }
    
    // Fix initial sprite if it's using the wrong naming convention
    if (petSprite.src.endsWith('normal_normal.png')) {
        petSprite.src = 'sprite/normal.png';
        logMessage('Debug: Fixed initial sprite to normal.png', 'client');
    }
    
    // Make sure coffee sprite is draggable
    coffeeSprite.draggable = true;
    coffeeSprite.style.pointerEvents = 'auto';
    
    // Setup drag-and-drop for feeding
    setupDragAndDrop();
    
    // Disable context menu on the entire document
    document.addEventListener('contextmenu', event => {
        event.preventDefault();
        return false;
    });
    
    // Disable selection on mousedown
    document.addEventListener('mousedown', event => {
        if (event.detail > 1) { // Check if it's a double-click or more
            event.preventDefault();
        }
    });
    
    // Disable drag start on images except for cake sprite
    document.addEventListener('dragstart', event => {
        console.log('Dragstart on', event.target.id);
        
        // Allow cake to be dragged
        if (event.target.id === 'cake-sprite') {
            console.log('Allowing cake to be dragged');
            return true;
        } else {
            // Prevent dragging for other elements
            event.preventDefault();
            return false;
        }
    });
    
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
    
    // Add direct click handlers for items
    cakeContainer.addEventListener('click', () => {
        console.log('Cake container clicked');
        animateCakeFeeding();
    });
    
    coffeeContainer.addEventListener('click', () => {
        console.log('Coffee container clicked');
        animateCoffeeFeeding();
    });
}

// Global variables for intervals
let walkingInterval;
let walkAnimationInterval;

// Start the game when the page loads
window.addEventListener('load', init);

// Function to check all sprite files
function checkAllSprites() {
    logMessage('Debug: Checking all sprite files...', 'client');
    
    const statuses = ['normal', 'happi', 'slumber'];
    const types = ['normal', 'walk1', 'walk2', 'walking1', 'walking2'];
    
    // Create a temporary image to test loading
    const testImage = new Image();
    
    // Counter for tracking loaded sprites
    let loadedCount = 0;
    let failedCount = 0;
    let totalCount = 0;
    
    // Function to test loading a sprite
    function testSprite(filename) {
        totalCount++;
        
        testImage.onload = () => {
            logMessage(`Sprite loaded: ${filename}`, 'client');
            loadedCount++;
            checkComplete();
        };
        
        testImage.onerror = () => {
            logMessage(`ERROR: Failed to load sprite: ${filename}`, 'error');
            failedCount++;
            checkComplete();
        };
        
        testImage.src = filename;
    }
    
    // Check if all sprites have been tested
    function checkComplete() {
        if (loadedCount + failedCount === totalCount) {
            logMessage(`Debug: Sprite check complete. ${loadedCount} loaded, ${failedCount} failed.`, 'client');
        }
    }
    
    // Test all combinations
    for (const status of statuses) {
        for (const type of types) {
            const filename = `sprite/${status}_${type}.png`;
            testSprite(filename);
        }
    }
    
    // Also test the legacy normal.png
    testSprite('sprite/normal.png');
}

// Function to log the current sprite
function logCurrentSprite() {
    const currentSrc = petSprite.src;
    const filename = currentSrc.split('/').pop();
    
    logMessage(`Current sprite: ${filename}`, 'client');
    logMessage(`Full path: ${currentSrc}`, 'client');
    logMessage(`Current status: ${gameState.status}`, 'client');
    logMessage(`Walking: ${gameState.isWalking ? 'Yes' : 'No'}`, 'client');
    logMessage(`Walk step: ${gameState.walkStep}`, 'client');
    logMessage(`Hunger: ${gameState.hunger}`, 'client');
    logMessage(`Happiness: ${gameState.happiness}`, 'client');
}

// Event listeners for debug sprite buttons
checkSpritesButton.addEventListener('click', (event) => {
    event.preventDefault();
    checkAllSprites();
});

logCurrentSpriteButton.addEventListener('click', (event) => {
    event.preventDefault();
    logCurrentSprite();
});

toggleDebugButton.addEventListener('click', (event) => {
    event.preventDefault();
    toggleDebugMenu();
});

// Pick a random target within exploration range
function pickRandomTarget() {
    if (!gameState.isExploring || gameState.isSleeping) return;
    
    const margin = 5; // percentage from edge
    const yMargin = 10; // percentage from top/bottom
    
    // Calculate random position within exploration range
    let randomX = Math.max(0, Math.min(100, 
        gameState.position.x + (Math.random() * 2 - 1) * gameState.explorationRange.x
    ));
    
    let randomY = Math.max(0, Math.min(100, 
        gameState.position.y + (Math.random() * 2 - 1) * gameState.explorationRange.y
    ));
    
    // Ensure positions are within bounds
    randomX = Math.max(margin, Math.min(100 - margin, randomX));
    randomY = Math.max(yMargin, Math.min(100 - yMargin, randomY));
    
    // Set as target
    gameState.targetPosition = { 
        x: randomX, 
        y: randomY 
    };
    
    // Calculate direction vector
    const dx = randomX - gameState.position.x;
    const dy = randomY - gameState.position.y;
    
    // Set initial direction
    gameState.direction = { 
        x: dx, 
        y: dy 
    };
    
    // Start walking
    startWalking();
    
    if (gameState.debugMode) {
        console.log(`Picked random target: (${randomX.toFixed(1)}, ${randomY.toFixed(1)})`);
    }
}

// Modify sleepiness by a certain amount
function modifySleepiness(amount) {
    gameState.sleepiness = Math.max(0, Math.min(100, gameState.sleepiness + amount));
    updateUI();
}

// Set sleepiness to a specific value
function setSleepiness(value) {
    gameState.sleepiness = Math.max(0, Math.min(100, value));
    updateUI();
}

// Put Viscunam to sleep or wake him up
function toggleSleep() {
    if (gameState.isSleeping) {
        // Wake up
        gameState.isSleeping = false;
        gameState.status = 'normal';
        setSleepiness(0);
        gameState.lastSlept = Date.now();
        logMessage('Viscunam woke up and feels refreshed!', 'client');
        sleepButton.textContent = 'Sleep';
        
        // Resume exploration if it was active
        if (gameState.isExploring) {
            setTimeout(() => {
                startWandering();
            }, 1000);
        }
    } else {
        // Go to sleep
        stopWalking();
        gameState.isSleeping = true;
        gameState.status = 'slumber';
        logMessage('Viscunam is now sleeping...', 'client');
        sleepButton.textContent = 'Wake Up';
    }
    
    updateUI();
}

// Give coffee to Viscunam to reduce sleepiness
function giveCoffee() {
    if (gameState.connected) {
        // Send coffee action to server
        sendMessage(ACTIONS.COFFEE);
    } else {
        // Local mode
        // Reduce sleepiness
        modifySleepiness(-30);
        
        // Increase happiness slightly
        modifyHappiness(5);
        
        // Update status
        updatePetStatus();
        updateUI();
        
        // Log message
        logMessage('Viscunam drank coffee and feels energized! (-30 sleepiness)', 'client');
    }
    
    // Mark as user interaction
    gameState.userInteracted = true;
    gameState.userInteractionTimer = 0;
}

// Animate coffee being given to Viscunam
function animateCoffeeFeeding() {
    // Create a clone of the coffee
    const coffeeClone = coffeeSprite.cloneNode(true);
    document.body.appendChild(coffeeClone);
    
    // Position the clone at the original coffee's position
    const coffeeRect = coffeeSprite.getBoundingClientRect();
    const petRect = petSprite.getBoundingClientRect();
    
    coffeeClone.style.position = 'fixed';
    coffeeClone.style.left = `${coffeeRect.left}px`;
    coffeeClone.style.top = `${coffeeRect.top}px`;
    coffeeClone.style.width = `${coffeeRect.width}px`;
    coffeeClone.style.height = `${coffeeRect.height}px`;
    coffeeClone.style.zIndex = '1000';
    
    // Calculate the target position (center of the pet)
    const targetX = petRect.left + petRect.width / 2 - coffeeRect.left;
    const targetY = petRect.top + petRect.height / 2 - coffeeRect.top;
    
    // Set the CSS variables for the animation
    coffeeClone.style.setProperty('--target-x', `${targetX}px`);
    coffeeClone.style.setProperty('--target-y', `${targetY}px`);
    
    // Add the animation class
    coffeeClone.classList.add('float-to-pet');
    
    // Remove the clone after animation completes and give coffee
    setTimeout(() => {
        document.body.removeChild(coffeeClone);
        giveCoffee();
    }, 800);
}

// Setup drag-and-drop functionality for all items
function setupDragAndDrop() {
    // Variables for drag and drop
    let isDragging = false;
    let offsetX, offsetY;
    let draggedCake = null;
    let isDraggingCoffee = false;
    let draggedCoffee = null;
    let coffeeOffsetX = 0;
    let coffeeOffsetY = 0;
    
    // Make sure the sprites are draggable
    cakeSprite.draggable = true;
    cakeSprite.style.pointerEvents = 'auto';
    coffeeSprite.draggable = true;
    coffeeSprite.style.pointerEvents = 'auto';
    
    // Log to confirm setup
    console.log('Setting up drag-and-drop for cake and coffee');
    
    // Add a simple click handler as fallback for cake
    cakeContainer.addEventListener('click', (e) => {
        console.log('Cake clicked');
        animateCakeFeeding();
    });
    
    // Add a simple click handler as fallback for coffee
    coffeeContainer.addEventListener('click', (e) => {
        console.log('Coffee clicked');
        animateCoffeeFeeding();
    });
    
    // Cake drag start
    cakeSprite.addEventListener('dragstart', (e) => {
        console.log('Cake drag start');
        // Required for Firefox
        e.dataTransfer.setData('text/plain', 'cake');
        e.dataTransfer.effectAllowed = 'move';
        
        // Mark as dragging
        cakeContainer.classList.add('dragging');
        isDragging = true;
    });
    
    // Cake drag end
    cakeSprite.addEventListener('dragend', (e) => {
        console.log('Cake drag end');
        cakeContainer.classList.remove('dragging');
        petContainer.classList.remove('can-feed');
        isDragging = false;
    });
    
    // Coffee drag start
    coffeeSprite.addEventListener('dragstart', (e) => {
        console.log('Coffee drag start');
        e.dataTransfer.setData('text/plain', 'coffee');
        e.dataTransfer.effectAllowed = 'move';
        
        // Mark as dragging
        coffeeContainer.classList.add('dragging');
        isDraggingCoffee = true;
    });
    
    // Coffee drag end
    coffeeSprite.addEventListener('dragend', (e) => {
        console.log('Coffee drag end');
        coffeeContainer.classList.remove('dragging');
        petContainer.classList.remove('can-feed');
        isDraggingCoffee = false;
    });
    
    // Drag over pet
    petContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        console.log('Drag over pet');
        e.dataTransfer.dropEffect = 'move';
        petContainer.classList.add('can-feed');
    });
    
    // Drag leave pet
    petContainer.addEventListener('dragleave', (e) => {
        console.log('Drag leave pet');
        petContainer.classList.remove('can-feed');
    });
    
    // Drop on pet
    petContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        console.log('Drop on pet');
        petContainer.classList.remove('can-feed');
        
        // Check what was dropped
        const data = e.dataTransfer.getData('text/plain');
        if (data === 'cake') {
            // Feed the pet with cake
            animateCakeFeeding();
        } else if (data === 'coffee') {
            // Give coffee to the pet
            animateCoffeeFeeding();
        }
    });
    
    // Mouse down for cake
    cakeSprite.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Only left mouse button
        
        e.preventDefault();
        
        // Create a clone for dragging
        draggedCake = cakeSprite.cloneNode(true);
        document.body.appendChild(draggedCake);
        
        // Style the clone
        draggedCake.style.position = 'fixed';
        draggedCake.style.zIndex = '1000';
        draggedCake.style.opacity = '0.7';
        draggedCake.style.pointerEvents = 'none';
        
        // Calculate offset
        const rect = cakeSprite.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        
        // Position the clone
        draggedCake.style.left = `${e.clientX - offsetX}px`;
        draggedCake.style.top = `${e.clientY - offsetY}px`;
        
        isDragging = true;
    });
    
    // Mouse down for coffee
    coffeeSprite.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Only left mouse button
        
        e.preventDefault();
        
        // Create a clone for dragging
        draggedCoffee = coffeeSprite.cloneNode(true);
        document.body.appendChild(draggedCoffee);
        
        // Style the clone
        draggedCoffee.style.position = 'fixed';
        draggedCoffee.style.zIndex = '1000';
        draggedCoffee.style.opacity = '0.7';
        draggedCoffee.style.pointerEvents = 'none';
        draggedCoffee.style.width = '30px'; // Smaller size
        draggedCoffee.style.height = '30px'; // Smaller size
        
        // Calculate offset
        const rect = coffeeSprite.getBoundingClientRect();
        coffeeOffsetX = e.clientX - rect.left;
        coffeeOffsetY = e.clientY - rect.top;
        
        // Position the clone
        draggedCoffee.style.left = `${e.clientX - coffeeOffsetX}px`;
        draggedCoffee.style.top = `${e.clientY - coffeeOffsetY}px`;
        
        isDraggingCoffee = true;
    });
    
    // Mouse move event
    document.addEventListener('mousemove', (e) => {
        // Handle cake dragging
        if (isDragging && draggedCake) {
            // Move the clone
            draggedCake.style.left = `${e.clientX - offsetX}px`;
            draggedCake.style.top = `${e.clientY - offsetY}px`;
            
            // Check if over pet
            const petRect = petContainer.getBoundingClientRect();
            if (
                e.clientX >= petRect.left && 
                e.clientX <= petRect.right && 
                e.clientY >= petRect.top && 
                e.clientY <= petRect.bottom
            ) {
                petContainer.classList.add('can-feed');
            } else {
                petContainer.classList.remove('can-feed');
            }
        }
        
        // Handle coffee dragging
        if (isDraggingCoffee && draggedCoffee) {
            // Move the clone
            draggedCoffee.style.left = `${e.clientX - coffeeOffsetX}px`;
            draggedCoffee.style.top = `${e.clientY - coffeeOffsetY}px`;
            
            // Check if over pet
            const petRect = petContainer.getBoundingClientRect();
            if (
                e.clientX >= petRect.left && 
                e.clientX <= petRect.right && 
                e.clientY >= petRect.top && 
                e.clientY <= petRect.bottom
            ) {
                petContainer.classList.add('can-feed');
            } else {
                petContainer.classList.remove('can-feed');
            }
        }
    });
    
    // Mouse up event
    document.addEventListener('mouseup', (e) => {
        // Handle cake drop
        if (isDragging && draggedCake) {
            // Check if dropped on pet
            const petRect = petContainer.getBoundingClientRect();
            if (
                e.clientX >= petRect.left && 
                e.clientX <= petRect.right && 
                e.clientY >= petRect.top && 
                e.clientY <= petRect.bottom
            ) {
                // Remove the dragged clone
                document.body.removeChild(draggedCake);
                draggedCake = null;
                
                // Feed the pet with animation
                animateCakeFeeding();
            } else if (draggedCake) {
                // Remove the dragged clone
                document.body.removeChild(draggedCake);
                draggedCake = null;
            }
            
            petContainer.classList.remove('can-feed');
            isDragging = false;
        }
        
        // Handle coffee drop
        if (isDraggingCoffee && draggedCoffee) {
            // Check if dropped on pet
            const petRect = petContainer.getBoundingClientRect();
            if (
                e.clientX >= petRect.left && 
                e.clientX <= petRect.right && 
                e.clientY >= petRect.top && 
                e.clientY <= petRect.bottom
            ) {
                // Remove the dragged clone
                document.body.removeChild(draggedCoffee);
                draggedCoffee = null;
                
                // Give coffee to the pet with animation
                animateCoffeeFeeding();
            } else if (draggedCoffee) {
                // Remove the dragged clone
                document.body.removeChild(draggedCoffee);
                draggedCoffee = null;
            }
            
            petContainer.classList.remove('can-feed');
            isDraggingCoffee = false;
        }
    });
    
    // Touch events for cake
    cakeSprite.addEventListener('touchstart', (e) => {
        e.preventDefault();
        
        // Create a clone for dragging
        draggedCake = cakeSprite.cloneNode(true);
        document.body.appendChild(draggedCake);
        
        // Style the clone
        draggedCake.style.position = 'fixed';
        draggedCake.style.zIndex = '1000';
        draggedCake.style.opacity = '0.7';
        draggedCake.style.pointerEvents = 'none';
        
        // Calculate offset
        const touch = e.touches[0];
        const rect = cakeSprite.getBoundingClientRect();
        offsetX = touch.clientX - rect.left;
        offsetY = touch.clientY - rect.top;
        
        // Position the clone
        draggedCake.style.left = `${touch.clientX - offsetX}px`;
        draggedCake.style.top = `${touch.clientY - offsetY}px`;
        
        isDragging = true;
    });
    
    // Touch events for coffee
    coffeeSprite.addEventListener('touchstart', (e) => {
        e.preventDefault();
        
        // Create a clone for dragging
        draggedCoffee = coffeeSprite.cloneNode(true);
        document.body.appendChild(draggedCoffee);
        
        // Style the clone
        draggedCoffee.style.position = 'fixed';
        draggedCoffee.style.zIndex = '1000';
        draggedCoffee.style.opacity = '0.7';
        draggedCoffee.style.pointerEvents = 'none';
        draggedCoffee.style.width = '30px'; // Smaller size
        draggedCoffee.style.height = '30px'; // Smaller size
        
        // Calculate offset
        const touch = e.touches[0];
        const rect = coffeeSprite.getBoundingClientRect();
        coffeeOffsetX = touch.clientX - rect.left;
        coffeeOffsetY = touch.clientY - rect.top;
        
        // Position the clone
        draggedCoffee.style.left = `${touch.clientX - coffeeOffsetX}px`;
        draggedCoffee.style.top = `${touch.clientY - coffeeOffsetY}px`;
        
        isDraggingCoffee = true;
    });
    
    // Touch move event
    document.addEventListener('touchmove', (e) => {
        // Handle cake dragging
        if (isDragging && draggedCake) {
            const touch = e.touches[0];
            
            // Move the clone
            draggedCake.style.left = `${touch.clientX - offsetX}px`;
            draggedCake.style.top = `${touch.clientY - offsetY}px`;
            
            // Check if over pet
            const petRect = petContainer.getBoundingClientRect();
            if (
                touch.clientX >= petRect.left && 
                touch.clientX <= petRect.right && 
                touch.clientY >= petRect.top && 
                touch.clientY <= petRect.bottom
            ) {
                petContainer.classList.add('can-feed');
            } else {
                petContainer.classList.remove('can-feed');
            }
            
            // Prevent scrolling
            e.preventDefault();
        }
        
        // Handle coffee dragging
        if (isDraggingCoffee && draggedCoffee) {
            const touch = e.touches[0];
            
            // Move the clone
            draggedCoffee.style.left = `${touch.clientX - coffeeOffsetX}px`;
            draggedCoffee.style.top = `${touch.clientY - coffeeOffsetY}px`;
            
            // Check if over pet
            const petRect = petContainer.getBoundingClientRect();
            if (
                touch.clientX >= petRect.left && 
                touch.clientX <= petRect.right && 
                touch.clientY >= petRect.top && 
                touch.clientY <= petRect.bottom
            ) {
                petContainer.classList.add('can-feed');
            } else {
                petContainer.classList.remove('can-feed');
            }
            
            // Prevent scrolling
            e.preventDefault();
        }
    });
    
    // Touch end event
    document.addEventListener('touchend', (e) => {
        // Handle cake drop
        if (isDragging && draggedCake) {
            // Get the last touch position
            const lastTouch = e.changedTouches[0];
            
            // Check if dropped on pet
            const petRect = petContainer.getBoundingClientRect();
            if (
                lastTouch.clientX >= petRect.left && 
                lastTouch.clientX <= petRect.right && 
                lastTouch.clientY >= petRect.top && 
                lastTouch.clientY <= petRect.bottom
            ) {
                // Remove the dragged clone
                document.body.removeChild(draggedCake);
                draggedCake = null;
                
                // Feed the pet with animation
                animateCakeFeeding();
            } else if (draggedCake) {
                // Remove the dragged clone
                document.body.removeChild(draggedCake);
                draggedCake = null;
            }
            
            petContainer.classList.remove('can-feed');
            isDragging = false;
        }
        
        // Handle coffee drop
        if (isDraggingCoffee && draggedCoffee) {
            // Get the last touch position
            const lastTouch = e.changedTouches[0];
            
            // Check if dropped on pet
            const petRect = petContainer.getBoundingClientRect();
            if (
                lastTouch.clientX >= petRect.left && 
                lastTouch.clientX <= petRect.right && 
                lastTouch.clientY >= petRect.top && 
                lastTouch.clientY <= petRect.bottom
            ) {
                // Remove the dragged clone
                document.body.removeChild(draggedCoffee);
                draggedCoffee = null;
                
                // Give coffee to the pet with animation
                animateCoffeeFeeding();
            } else if (draggedCoffee) {
                // Remove the dragged clone
                document.body.removeChild(draggedCoffee);
                draggedCoffee = null;
            }
            
            petContainer.classList.remove('can-feed');
            isDraggingCoffee = false;
        }
    });
}

// Clear messages button
clearMessagesBtn.addEventListener('click', () => {
    // Clear all messages
    while (messageContainer.firstChild) {
        messageContainer.removeChild(messageContainer.firstChild);
    }
    // Add a confirmation message
    logMessage('Messages cleared', 'client');
}); 