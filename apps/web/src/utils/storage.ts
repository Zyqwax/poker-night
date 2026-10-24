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
  return localStorage.getItem(ACTIVE_ROOM_KEY);
}

export function saveActiveRoom(code: string): void {
  localStorage.setItem(ACTIVE_ROOM_KEY, code.replace(/\D/g, ''));
}

export function clearActiveRoom(): void {
  localStorage.removeItem(ACTIVE_ROOM_KEY);
}
