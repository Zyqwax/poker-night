import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import express from 'express';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { RoomStatePayload, SOCKET_EVENTS } from '@poker-night/shared';
import { RoomManager } from '../roomManager.js';
import { DealerBot } from '../dealerBot.js';
import { setupSocketHandlers } from '../socketHandler.js';

describe('End-to-End Socket Multi-Client Hand Simulation', () => {
  let server: http.Server;
  let serverIo: Server;
  let port: number;
  let client1: ClientSocket;
  let client2: ClientSocket;

  beforeAll(async () => {
    const app = express();
    server = http.createServer(app);
    serverIo = new Server(server, { cors: { origin: '*' } });
    const roomManager = new RoomManager();
    const dealerBot = new DealerBot(serverIo);
    setupSocketHandlers(serverIo, roomManager, dealerBot);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(() => {
    client1?.disconnect();
    client2?.disconnect();
    serverIo?.close();
    server?.close();
  });

  it('runs a complete hand between two players over real websockets', async () => {
    client1 = Client(`http://localhost:${port}`);
    client2 = Client(`http://localhost:${port}`);

    await Promise.all([
      new Promise<void>((res) => client1.on('connect', () => res())),
      new Promise<void>((res) => client2.on('connect', () => res())),
    ]);

    let roomCode = '';
    const createPromise = new Promise<void>((resolve) => {
      client1.once(SOCKET_EVENTS.ROOM_STATE, (state: RoomStatePayload) => {
        roomCode = state.code;
        resolve();
      });
    });

    client1.emit(SOCKET_EVENTS.ROOM_CREATE, {
      nick: 'Enes',
      playerId: 'user_1',
    });
    await createPromise;

    const joinPromise = new Promise<void>((resolve) => {
      client2.on(SOCKET_EVENTS.ROOM_STATE, (state: RoomStatePayload) => {
        if (state.players.length === 2) resolve();
      });
    });

    client2.emit(SOCKET_EVENTS.ROOM_JOIN, {
      code: roomCode,
      nick: 'Ayşe',
      playerId: 'user_2',
    });
    await joinPromise;

    let latestState: RoomStatePayload | null = null;
    let p1Cards: any[] = [];
    let p2Cards: any[] = [];

    const p1HoleCardsPromise = new Promise<void>((resolve) => {
      client1.on(SOCKET_EVENTS.GAME_HOLE_CARDS, (data) => {
        p1Cards = data.cards;
        resolve();
      });
    });

    const p2HoleCardsPromise = new Promise<void>((resolve) => {
      client2.on(SOCKET_EVENTS.GAME_HOLE_CARDS, (data) => {
        p2Cards = data.cards;
        resolve();
      });
    });

    const handStartedPromise = new Promise<void>((resolve) => {
      client1.on(SOCKET_EVENTS.ROOM_STATE, (state: RoomStatePayload) => {
        latestState = state;
        if (state.isGameActive && state.game?.stage === 'preflop') {
          resolve();
        }
      });
    });

    const handEndPromise = new Promise<void>((resolve) => {
      client1.on(SOCKET_EVENTS.GAME_SHOWDOWN, (data) => {
        expect(data.winners.length).toBeGreaterThan(0);
        resolve();
      });
    });

    // Start game
    client1.emit(SOCKET_EVENTS.GAME_START);
    await Promise.all([handStartedPromise, p1HoleCardsPromise, p2HoleCardsPromise]);

    expect(p1Cards.length).toBe(2);
    expect(p2Cards.length).toBe(2);

    // Send fold from whichever player's turn it is
    const curState = latestState as RoomStatePayload | null;
    const turnSeat = curState?.game?.currentTurnSeat;
    const playerToAct = curState?.players.find((p) => p.seatIndex === turnSeat);

    if (playerToAct?.id === 'user_1') {
      client1.emit(SOCKET_EVENTS.GAME_ACTION, { action: 'fold' });
    } else {
      client2.emit(SOCKET_EVENTS.GAME_ACTION, { action: 'fold' });
    }

    await handEndPromise;
  }, 10000);
});
