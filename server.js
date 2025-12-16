const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static('public'));
app.use(express.json());

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'client.html'));
});

// MongoDB 연결
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://15thgghsdorm:15thgghsdorm@cluster0.mnrdrnj.mongodb.net/?appName=Cluster0';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// MongoDB 스키마 정의
const GameStateSchema = new mongoose.Schema({
  stateId: { type: String, default: 'main' },
  rooms: {
    type: Map,
    of: {
      password: String,
      digits: Number,
      teamName: String,
      startTime: Number,
      completed: Boolean,
      isActive: Boolean,
      penalties: Number,
      screamEnabled: Boolean
    }
  },
  completedTeams: [{
    teamName: String,
    roomNumber: Number,
    time: Number,
    penalties: Number,
    completedAt: Date
  }],
  updatedAt: { type: Date, default: Date.now }
});

const GameState = mongoose.model('GameState', GameStateSchema);

// 초기 게임 상태
const defaultGameState = {
  stateId: 'main',
  rooms: new Map([
    [1, { password: '1234', digits: 4, teamName: '', startTime: null, completed: false, isActive: false, penalties: 0, screamEnabled: true }],
    [2, { password: '5678', digits: 4, teamName: '', startTime: null, completed: false, isActive: false, penalties: 0, screamEnabled: true }],
    [3, { password: '9012', digits: 4, teamName: '', startTime: null, completed: false, isActive: false, penalties: 0, screamEnabled: true }],
    [4, { password: '3456', digits: 4, teamName: '', startTime: null, completed: false, isActive: false, penalties: 0, screamEnabled: true }]
  ]),
  completedTeams: []
};

// 게임 상태 로드
async function loadGameState() {
  try {
    let state = await GameState.findOne({ stateId: 'main' });
    if (!state) {
      state = new GameState(defaultGameState);
      await state.save();
      console.log('Created new game state in MongoDB');
    } else {
      console.log('Loaded existing game state from MongoDB');
    }
    return state;
  } catch (error) {
    console.error('Error loading game state:', error);
    return defaultGameState;
  }
}

// 게임 상태 저장
async function saveGameState(state) {
  try {
    state.updatedAt = new Date();
    await GameState.findOneAndUpdate(
      { stateId: 'main' },
      state,
      { upsert: true, new: true }
    );
    console.log('Game state saved to MongoDB');
  } catch (error) {
    console.error('Error saving game state:', error);
  }
}

let gameState = null;
let clientRooms = {};

// 서버 시작 시 게임 상태 로드
loadGameState().then(state => {
  gameState = state;
});

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('admin-connect', async () => {
    socket.join('admin');
    if (!gameState) {
      gameState = await loadGameState();
    }
    const stateObj = {
      rooms: Object.fromEntries(gameState.rooms),
      completedTeams: gameState.completedTeams
    };
    socket.emit('game-state', stateObj);
    console.log('Admin connected, sent game state');
  });

  socket.on('select-room', (roomNumber) => {
    socket.join(`room-${roomNumber}`);
    clientRooms[socket.id] = roomNumber;
    const room = gameState.rooms.get(roomNumber);
    socket.emit('room-config', {
      roomNumber: roomNumber,
      digits: room.digits,
      screamEnabled: room.screamEnabled
    });
    console.log(`Client ${socket.id} joined room ${roomNumber}`);
  });

  socket.on('set-team-name', async (data) => {
    const { roomNumber, teamName } = data;
    const room = gameState.rooms.get(roomNumber);
    room.teamName = teamName;
    room.startTime = Date.now();
    room.isActive = true;
    room.completed = false;
    room.penalties = 0;
    
    await saveGameState(gameState);
    
    io.to(`room-${roomNumber}`).emit('game-started', { teamName });
    const stateObj = {
      rooms: Object.fromEntries(gameState.rooms),
      completedTeams: gameState.completedTeams
    };
    io.to('admin').emit('game-state', stateObj);
  });

  socket.on('check-password', async (data) => {
    const { roomNumber, password } = data;
    const room = gameState.rooms.get(roomNumber);
    
    console.log(`Room ${roomNumber} password check:`, password, 'vs', room.password);
    
    if (password === room.password) {
      const elapsedTime = Date.now() - room.startTime;
      const penaltyTime = room.penalties * 30000;
      const totalTime = elapsedTime + penaltyTime;
      
      room.completed = true;
      room.isActive = false;
      
      gameState.completedTeams.push({
        teamName: room.teamName,
        roomNumber: roomNumber,
        time: totalTime,
        penalties: room.penalties,
        completedAt: new Date()
      });
      
      gameState.completedTeams.sort((a, b) => a.time - b.time);
      
      await saveGameState(gameState);
      
      io.to(`room-${roomNumber}`).emit('password-correct', { time: elapsedTime });
      const stateObj = {
        rooms: Object.fromEntries(gameState.rooms),
        completedTeams: gameState.completedTeams
      };
      io.to('admin').emit('game-state', stateObj);
    } else {
      room.penalties += 1;
      await saveGameState(gameState);
      
      io.to(`room-${roomNumber}`).emit('password-wrong', { screamEnabled: room.screamEnabled });
      io.to('admin').emit('password-wrong-admin', { roomNumber, penalties: room.penalties });
      const stateObj = {
        rooms: Object.fromEntries(gameState.rooms),
        completedTeams: gameState.completedTeams
      };
      io.to('admin').emit('game-state', stateObj);
    }
  });

  socket.on('admin-set-password', async (data) => {
    const { roomNumber, password, digits } = data;
    console.log('Setting password for room', roomNumber, ':', password, 'digits:', digits);
    
    const room = gameState.rooms.get(roomNumber);
    room.password = password;
    room.digits = digits;
    
    await saveGameState(gameState);
    
    io.to(`room-${roomNumber}`).emit('room-config', {
      roomNumber: roomNumber,
      digits: digits,
      screamEnabled: room.screamEnabled
    });
    
    const stateObj = {
      rooms: Object.fromEntries(gameState.rooms),
      completedTeams: gameState.completedTeams
    };
    io.to('admin').emit('game-state', stateObj);
    console.log('Password updated successfully');
  });

  socket.on('toggle-scream', async (data) => {
    const { roomNumber, enabled } = data;
    const room = gameState.rooms.get(roomNumber);
    room.screamEnabled = enabled;
    
    await saveGameState(gameState);
    
    io.to(`room-${roomNumber}`).emit('scream-toggle', { enabled });
    const stateObj = {
      rooms: Object.fromEntries(gameState.rooms),
      completedTeams: gameState.completedTeams
    };
    io.to('admin').emit('game-state', stateObj);
  });

  socket.on('play-announcement', (data) => {
    const { roomNumber, announcement } = data;
    console.log(`Playing announcement to room ${roomNumber}:`, announcement);
    io.to(`room-${roomNumber}`).emit('play-announcement', { announcement });
  });

  socket.on('admin-reset-room', async (roomNumber) => {
    const room = gameState.rooms.get(roomNumber);
    room.teamName = '';
    room.startTime = null;
    room.completed = false;
    room.isActive = false;
    room.penalties = 0;
    
    await saveGameState(gameState);
    
    io.to(`room-${roomNumber}`).emit('game-reset');
    const stateObj = {
      rooms: Object.fromEntries(gameState.rooms),
      completedTeams: gameState.completedTeams
    };
    io.to('admin').emit('game-state', stateObj);
    
    console.log(`Room ${roomNumber} has been reset`);
  });

  socket.on('request-hint', (data) => {
    const { roomNumber, message } = data;
    io.to('admin').emit('hint-requested', { roomNumber, message });
  });

  socket.on('send-hint', (data) => {
    const { roomNumber, hint } = data;
    io.to(`room-${roomNumber}`).emit('hint-received', hint);
  });

  socket.on('send-effect', (data) => {
    const { roomNumber, effect } = data;
    io.to(`room-${roomNumber}`).emit('effect-trigger', effect);
  });

  socket.on('admin-reset-rankings', async () => {
    gameState.completedTeams = [];
    await saveGameState(gameState);
    const stateObj = {
      rooms: Object.fromEntries(gameState.rooms),
      completedTeams: gameState.completedTeams
    };
    io.to('admin').emit('game-state', stateObj);
  });

  socket.on('client-leave-room', async (data) => {
    const { roomNumber } = data;
    console.log(`Client ${socket.id} leaving room ${roomNumber}`);
    
    const roomClients = io.sockets.adapter.rooms.get(`room-${roomNumber}`);
    const clientCount = roomClients ? roomClients.size : 0;
    
    console.log(`Room ${roomNumber} has ${clientCount} clients`);
    
    if (clientCount <= 1) {
      const room = gameState.rooms.get(roomNumber);
      if (room.isActive && !room.completed) {
        room.teamName = '';
        room.startTime = null;
        room.isActive = false;
        room.penalties = 0;
        
        await saveGameState(gameState);
        const stateObj = {
          rooms: Object.fromEntries(gameState.rooms),
          completedTeams: gameState.completedTeams
        };
        io.to('admin').emit('game-state', stateObj);
        
        console.log(`Room ${roomNumber} auto-reset due to client disconnect`);
      }
    }
  });

  socket.on('disconnect', async () => {
    console.log('Client disconnected:', socket.id);
    
    const roomNumber = clientRooms[socket.id];
    if (roomNumber) {
      console.log(`Disconnected client was in room ${roomNumber}`);
      
      setTimeout(async () => {
        const roomClients = io.sockets.adapter.rooms.get(`room-${roomNumber}`);
        const clientCount = roomClients ? roomClients.size : 0;
        
        console.log(`After disconnect, room ${roomNumber} has ${clientCount} clients`);
        
        const room = gameState.rooms.get(roomNumber);
        if (clientCount === 0 && room.isActive && !room.completed) {
          room.teamName = '';
          room.startTime = null;
          room.isActive = false;
          room.penalties = 0;
          
          await saveGameState(gameState);
          const stateObj = {
            rooms: Object.fromEntries(gameState.rooms),
            completedTeams: gameState.completedTeams
          };
          io.to('admin').emit('game-state', stateObj);
          
          console.log(`Room ${roomNumber} auto-reset due to no clients`);
        }
      }, 1000);
      
      delete clientRooms[socket.id];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Client: http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin`);
});
