const PLAYER_ID_KEY = 'poker_night_player_id';
const PLAYER_NICK_KEY = 'poker_night_player_nick';
const RECENT_ROOMS_KEY = 'poker_night_recent_rooms';

export function getOrCreatePlayerId(): string {
  let id = localStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'player_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

export function getSavedNick(): string {
  return localStorage.getItem(PLAYER_NICK_KEY) || '';
}

export function saveNick(nick: string): void {
  localStorage.setItem(PLAYER_NICK_KEY, nick.trim());
}

export interface RecentRoom {
  code: string;
  joinedAt: number;
}

export function getRecentRooms(): RecentRoom[] {
  try {
    const raw = localStorage.getItem(RECENT_ROOMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRecentRoom(code: string): void {
  const rooms = getRecentRooms().filter((r) => r.code !== code);
  rooms.unshift({ code, joinedAt: Date.now() });
  localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(rooms.slice(0, 5)));
}

const ACTIVE_ROOM_KEY = 'poker_night_active_room';

export function getActiveRoom(): string | null {
  try {
    const raw = localStorage.getItem(ACTIVE_ROOM_KEY);
    if (!raw) return null;

    // Check JSON format with savedAt timestamp
    if (raw.startsWith('{')) {
      const data = JSON.parse(raw);
      // Expire after 30 minutes (rooms do not stay active overnight)
      if (Date.now() - data.savedAt > 30 * 60 * 1000) {
        clearActiveRoom();
        return null;
      }
      return data.code;
    }

    // Wipe legacy plain string room keys from previous sessions
    clearActiveRoom();
    return null;
  } catch {
    clearActiveRoom();
    return null;
  }
}

export function saveActiveRoom(code: string): void {
  const clean = code.replace(/\D/g, '');
  if (!clean) return;
  localStorage.setItem(
    ACTIVE_ROOM_KEY,
    JSON.stringify({ code: clean, savedAt: Date.now() })
  );
}

export function clearActiveRoom(): void {
  localStorage.removeItem(ACTIVE_ROOM_KEY);
}
