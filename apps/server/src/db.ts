import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HandHistoryItem, HandWinner, PlayerGameStats, RoomSettings } from '@poker-night/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../../poker-night.db');

export const db = new Database(dbPath);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    code TEXT PRIMARY KEY,
    host_player_id TEXT NOT NULL,
    settings_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    closed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS hands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_code TEXT NOT NULL,
    hand_number INTEGER NOT NULL,
    pot INTEGER NOT NULL,
    community_cards_json TEXT NOT NULL,
    winners_json TEXT NOT NULL,
    summary TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS player_stats (
    player_id TEXT PRIMARY KEY,
    nick TEXT NOT NULL,
    hands_played INTEGER NOT NULL DEFAULT 0,
    hands_won INTEGER NOT NULL DEFAULT 0,
    fold_count INTEGER NOT NULL DEFAULT 0,
    net_profit INTEGER NOT NULL DEFAULT 0,
    chips INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );
`);

export function saveRoom(code: string, hostPlayerId: string, settings: RoomSettings): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO rooms (code, host_player_id, settings_json, created_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(code, hostPlayerId, JSON.stringify(settings), Date.now());
}

export function closeRoom(code: string): void {
  const stmt = db.prepare(`
    UPDATE rooms SET closed_at = ? WHERE code = ?
  `);
  stmt.run(Date.now(), code);
}

export function saveHandRecord(
  roomCode: string,
  handNumber: number,
  pot: number,
  communityCards: unknown[],
  winners: HandWinner[],
  summary: string
): void {
  const stmt = db.prepare(`
    INSERT INTO hands (room_code, hand_number, pot, community_cards_json, winners_json, summary, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    roomCode,
    handNumber,
    pot,
    JSON.stringify(communityCards),
    JSON.stringify(winners),
    summary,
    Date.now()
  );
}

export function getRoomHands(roomCode: string): HandHistoryItem[] {
  const stmt = db.prepare(`
    SELECT hand_number as handNumber, pot, community_cards_json, winners_json, summary, created_at as timestamp
    FROM hands
    WHERE room_code = ?
    ORDER BY hand_number ASC
  `);
  const rows = stmt.all(roomCode) as any[];
  return rows.map((r) => ({
    handNumber: r.handNumber,
    pot: r.pot,
    communityCards: JSON.parse(r.community_cards_json),
    winners: JSON.parse(r.winners_json),
    summary: r.summary,
    timestamp: r.timestamp,
  }));
}

export function updatePlayerStats(
  playerId: string,
  nick: string,
  handWon: boolean,
  folded: boolean,
  netDelta: number,
  currentChips: number
): void {
  const existing = db.prepare(`SELECT * FROM player_stats WHERE player_id = ?`).get(playerId) as any;

  if (existing) {
    const stmt = db.prepare(`
      UPDATE player_stats
      SET nick = ?,
          hands_played = hands_played + 1,
          hands_won = hands_won + ?,
          fold_count = fold_count + ?,
          net_profit = net_profit + ?,
          chips = ?,
          updated_at = ?
      WHERE player_id = ?
    `);
    stmt.run(
      nick,
      handWon ? 1 : 0,
      folded ? 1 : 0,
      netDelta,
      currentChips,
      Date.now(),
      playerId
    );
  } else {
    const stmt = db.prepare(`
      INSERT INTO player_stats (player_id, nick, hands_played, hands_won, fold_count, net_profit, chips, updated_at)
      VALUES (?, ?, 1, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      playerId,
      nick,
      handWon ? 1 : 0,
      folded ? 1 : 0,
      netDelta,
      currentChips,
      Date.now()
    );
  }
}

export function getPlayerOverallStats(playerId: string): PlayerGameStats | null {
  const stmt = db.prepare(`SELECT * FROM player_stats WHERE player_id = ?`);
  const row = stmt.get(playerId) as any;
  if (!row) return null;
  return {
    playerId: row.player_id,
    nick: row.nick,
    chips: row.chips,
    handsPlayed: row.hands_played,
    handsWon: row.hands_won,
    foldCount: row.fold_count,
    netProfit: row.net_profit,
    chipHistory: [],
  };
}
