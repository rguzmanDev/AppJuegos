export type GameId = "ppt" | "ahorcado" | "stop" | "dibuja";

export interface Player {
  id: string;       // socket id
  nickname: string;
  isHost: boolean;
}

export interface Room {
  code: string;
  gameId: GameId;
  players: Player[];
  state: "waiting" | "playing" | "finished";
  gameState: unknown;
}

export interface ScoreEntry {
  id?: number;
  game: GameId;
  nickname: string;
  score: number;
  created_at?: string;
}

// Socket events
export interface ServerToClientEvents {
  "room:updated": (room: Room) => void;
  "game:state": (state: unknown) => void;
  "game:event": (event: GameEvent) => void;
  error: (msg: string) => void;
}

export interface ClientToServerEvents {
  "room:join": (payload: { code: string; nickname: string }) => void;
  "room:create": (payload: { gameId: GameId; nickname: string }) => void;
  "room:restore": (payload: { code: string; nickname: string; isHost: boolean }) => void;
  "game:action": (action: GameAction) => void;
}

export interface GameEvent {
  type: string;
  payload: unknown;
  _from: string; // server-set sender socket id
}

export interface GameAction {
  type: string;
  payload: unknown;
}
