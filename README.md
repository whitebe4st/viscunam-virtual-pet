# Viscunam - Virtual Pet Game

A Tamagotchi-like virtual pet game where you can feed and take care of your pet "Viscunam". This project demonstrates socket programming using WebSockets for real-time communication between client and server.

## Project Overview

### Objective
The objective of this project is to create a simple virtual pet game where users can interact with their pet by feeding it. The game uses a custom application-layer protocol over WebSockets for communication between the client and server.

### Game Features
- Feed your virtual pet "Viscunam"
- Watch your pet's hunger and happiness levels change over time
- See your pet's mood change based on its stats (normal, happy, or tired)
- Real-time updates between client and server

## Application Characteristics

### Client-Side
- Browser-based interface using HTML5, CSS, and JavaScript
- Displays the pet sprite and status bars
- Allows user interaction through buttons
- Handles WebSocket communication with the server
- Can operate in local mode if server connection fails

### Server-Side
- Node.js server using the 'ws' WebSocket library
- Manages pet state for each connected client
- Processes client actions and sends updates
- Implements the custom application-layer protocol

## Transport Layer Service Model

This application uses **TCP (Transmission Control Protocol)** through WebSockets because:

1. **Reliability**: We need guaranteed delivery of messages to ensure pet state is accurately synchronized between client and server.
2. **Order Preservation**: Messages need to be processed in the correct order (e.g., feed actions followed by updates).
3. **Connection-Oriented**: The game benefits from maintaining a persistent connection for real-time updates.
4. **Error Detection**: TCP's error detection ensures data integrity for game state.

WebSockets provide a full-duplex communication channel over a single TCP connection, making it ideal for this real-time application.

## ViscunamProtocol - Custom Application-Layer Protocol

### Protocol Design

The ViscunamProtocol is a simple text-based protocol with the following format:
```
ACTION|PARAM1:VALUE1|PARAM2:VALUE2|...
```

### Message Types

1. **Client to Server:**
   - `CONNECT` - Establish connection with the server
   - `FEED` - Feed the pet
   - `DISCONNECT` - Notify server of disconnection

2. **Server to Client:**
   - `UPDATE|hunger:VALUE|happiness:VALUE|status:VALUE` - Update pet state
   - `STATUS|code:CODE|message:MESSAGE` - Status response

### Status Codes
- `200`: OK - Request successful
- `400`: Bad Request - Invalid action or parameters
- `500`: Server Error - Internal server error

### Example Messages

Client to Server:
```
CONNECT
FEED
```

Server to Client:
```
UPDATE|hunger:80|happiness:90|status:happi
STATUS|code:200|message:Fed Viscunam successfully
```

## Setup and Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the server:
   ```
   npm start
   ```
4. Open your browser and navigate to `http://localhost:8080`

## Technical Implementation

The project consists of:
- `index.html` - Main HTML structure
- `style.css` - Styling for the game
- `script.js` - Client-side game logic and WebSocket handling
- `server.js` - Server-side logic and WebSocket implementation
- `sprite/` - Directory containing pet sprite images

## Future Enhancements

- Add more interactions (play, sleep, etc.)
- Implement walking animations
- Add persistence to save pet state between sessions
- Add multiplayer features to interact with other pets 