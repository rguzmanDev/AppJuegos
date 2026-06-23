import { Server } from "socket.io";
import { createServer } from "http";
import { customAlphabet } from "nanoid";
import type {
  Room,
  GameId,
  ServerToClientEvents,
  ClientToServerEvents,
} from "../src/lib/types";

const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

const defaultOrigins = [
  "http://localhost:3000",
  "https://appjuegos.fly.dev",
  "https://cuddle.rgcore.dev",
];
const allowedOrigins = (process.env.CORS_ORIGIN ?? defaultOrigins.join(","))
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const httpServer = createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error("CORS not allowed"));
    },
  },
});

const rooms = new Map<string, Room>();

io.on("connection", (socket) => {
  let currentRoomCode: string | null = null;

  socket.on("room:create", ({ gameId, nickname }) => {
    const code = nanoid();
    const room: Room = {
      code,
      gameId: gameId as GameId,
      players: [{ id: socket.id, nickname, isHost: true }],
      state: "waiting",
      gameState: null,
    };
    rooms.set(code, room);
    currentRoomCode = code;
    socket.join(code);
    io.to(code).emit("room:updated", room);
  });

  socket.on("room:join", ({ code, nickname }) => {
    const room = rooms.get(code.toUpperCase());
    if (!room) {
      socket.emit("error", "Código de partida no encontrado.");
      return;
    }
    if (room.players.length >= 2) {
      socket.emit("error", "La partida ya está llena.");
      return;
    }
    room.players.push({ id: socket.id, nickname, isHost: false });
    currentRoomCode = code.toUpperCase();
    socket.join(code.toUpperCase());
    io.to(code.toUpperCase()).emit("room:updated", room);
  });

  socket.on("game:action", (action) => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    // Tag with sender socket id so clients can filter their own events
    io.to(currentRoomCode).emit("game:event", { ...action, _from: socket.id });
  });

  socket.on("disconnect", () => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    room.players = room.players.filter((p) => p.id !== socket.id);
    if (room.players.length === 0) {
      rooms.delete(currentRoomCode);
    } else {
      io.to(currentRoomCode).emit("room:updated", room);
    }
  });
});

const PORT = parseInt(process.env.PORT ?? process.env.WS_PORT ?? "3001", 10);
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`🐥 WebSocket server running on port ${PORT}`);
});
