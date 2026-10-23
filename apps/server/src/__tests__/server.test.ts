import { describe, expect, it } from 'vitest';
import { RoomManager } from '../roomManager.js';
import { getRoomHands, saveHandRecord } from '../db.js';

describe('Server Room Management & DB Integration', () => {
  it('creates room with 6-digit code and assigns host to seat 0', () => {
    const rm = new RoomManager();
    const room = rm.createRoom('p1', 'Enes', 'sock1', '127.0.0.1');

    expect(room.code).toMatch(/^\d{6}$/);
    expect(room.hostPlayerId).toBe('p1');
    expect(room.players.length).toBe(1);
    expect(room.players[0].nick).toBe('Enes');
    expect(room.players[0].seatIndex).toBe(0);
    expect(room.players[0].isHost).toBe(true);
  });

  it('allows second player to join and prevents duplicate nicks', () => {
    const rm = new RoomManager();
    const room = rm.createRoom('p1', 'Enes', 'sock1', '127.0.0.1');

    // Join second player
    const updated = rm.joinRoom(room.code, 'p2', 'Ayşe', 'sock2', '127.0.0.1');
    expect(updated.players.length).toBe(2);
    expect(updated.players[1].nick).toBe('Ayşe');
    expect(updated.players[1].seatIndex).toBe(1);

    // Duplicate nick attempt
    expect(() => {
      rm.joinRoom(room.code, 'p3', 'enes', 'sock3', '127.0.0.1');
    }).toThrow('bu odada zaten kullanılıyor');
  });

  it('transfers host status to next player when host leaves', () => {
    const rm = new RoomManager();
    const room = rm.createRoom('p1', 'Enes', 'sock1', '127.0.0.1');
    rm.joinRoom(room.code, 'p2', 'Ayşe', 'sock2', '127.0.0.1');

    rm.leaveRoom(room, 'p1');
    expect(room.players.length).toBe(1);
    expect(room.hostPlayerId).toBe('p2');
    expect(room.players[0].isHost).toBe(true);
  });

  it('saves hand history to SQLite and retrieves it correctly', () => {
    const testCode = '999888';
    saveHandRecord(
      testCode,
      1,
      240,
      [{ rank: 14, suit: 's' }],
      [{ playerId: 'p1', nick: 'Enes', amount: 240 }],
      'El #1: Enes kazandı'
    );

    const hands = getRoomHands(testCode);
    expect(hands.length).toBeGreaterThanOrEqual(1);
    const last = hands[hands.length - 1];
    expect(last.pot).toBe(240);
    expect(last.winners[0].nick).toBe('Enes');
  });
});
