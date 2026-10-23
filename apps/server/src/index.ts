import express from 'express';
import http from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import { RoomManager } from './roomManager.js';
import { DealerBot } from './dealerBot.js';
import { setupSocketHandlers } from './socketHandler.js';
import { getPlayerOverallStats, getRoomHands } from './db.js';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDistPath = path.resolve(__dirname, '../../web/dist');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

if (fs.existsSync(webDistPath)) {
  app.use(express.static(webDistPath));
}

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 10000,
  pingInterval: 5000,
});

export const roomManager = new RoomManager();
export const dealerBot = new DealerBot(io);

setupSocketHandlers(io, roomManager, dealerBot);

// 30 minute idle room cleanup task
setInterval(() => {
  roomManager.cleanupInactiveRooms();
}, 60 * 1000);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/api/stats/:playerId', (req, res) => {
  const stats = getPlayerOverallStats(req.params.playerId);
  if (!stats) {
    return res.status(404).json({ error: 'Player stats not found' });
  }
  res.json(stats);
});

app.get('/api/history/:roomCode', (req, res) => {
  const hands = getRoomHands(req.params.roomCode);
  res.json(hands);
});

if (fs.existsSync(webDistPath)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(webDistPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`[Poker Night Server] running on http://localhost:${PORT}`);
  });
}

export { app, server, io };
