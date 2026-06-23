"use client";

import { useEffect, useRef, useState } from "react";
import { getSocket } from "./socket";
import type { Player, Room } from "./types";

const ROOM_KEY = "cuddle_room";
const PLAYER_KEY = "cuddle_player";

export interface SavedPlayerIdentity {
  nickname: string;
  isHost: boolean;
}

export function saveRoomToSession(room: Room) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(ROOM_KEY, JSON.stringify(room));
  }
}

export function savePlayerIdentity(identity: SavedPlayerIdentity) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(PLAYER_KEY, JSON.stringify(identity));
  }
}

function loadRoomFromSession(): Room | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(ROOM_KEY);
  return raw ? (JSON.parse(raw) as Room) : null;
}

function loadPlayerIdentity(): SavedPlayerIdentity | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(PLAYER_KEY);
  return raw ? (JSON.parse(raw) as SavedPlayerIdentity) : null;
}

function isOpponent(a: Player, b: Player): boolean {
  return a.nickname !== b.nickname || a.isHost !== b.isHost;
}

export function resolvePlayers(room: Room | null, socketId: string) {
  const saved = loadPlayerIdentity();

  if (!room || room.players.length === 0) {
    if (saved) {
      return {
        me: { id: socketId, nickname: saved.nickname, isHost: saved.isHost },
        opponent: undefined,
      };
    }
    return { me: undefined, opponent: undefined };
  }

  let me: Player | undefined;

  if (saved) {
    me = room.players.find(
      (p) => p.nickname === saved.nickname && p.isHost === saved.isHost,
    );
  }

  if (!me && socketId) {
    me = room.players.find((p) => p.id === socketId);
  }

  if (!me && saved) {
    me = { id: socketId, nickname: saved.nickname, isHost: saved.isHost };
  }

  const opponent = me
    ? room.players.find((p) => isOpponent(p, me!))
    : room.players.find((p) => p.id !== socketId);

  return { me, opponent };
}

export function useRoom() {
  const [room, setRoom] = useState<Room | null>(() => loadRoomFromSession());
  const socket = getSocket();
  const [socketId, setSocketId] = useState(socket.id ?? "");

  useEffect(() => {
    const restoreSession = () => {
      const id = socket.id ?? "";
      setSocketId(id);

      const saved = loadPlayerIdentity();
      const storedRoom = loadRoomFromSession();
      if (!saved || !storedRoom?.code) return;

      socket.emit("room:restore", {
        code: storedRoom.code,
        nickname: saved.nickname,
        isHost: saved.isHost,
      });
    };

    const onRoom = (r: Room) => {
      setRoom(r);
      saveRoomToSession(r);
      const me = resolvePlayers(r, socket.id ?? "").me;
      if (me) {
        savePlayerIdentity({ nickname: me.nickname, isHost: me.isHost });
      }
    };

    socket.connect();
    socket.on("connect", restoreSession);
    socket.on("room:updated", onRoom);
    if (socket.connected) restoreSession();

    return () => {
      socket.off("connect", restoreSession);
      socket.off("room:updated", onRoom);
    };
  }, [socket]);

  const { me, opponent } = resolvePlayers(room, socketId);
  const amHostRef = useRef(me?.isHost ?? false);

  useEffect(() => {
    amHostRef.current = me?.isHost ?? false;
  }, [me?.isHost]);

  return { room, me, opponent, myId: socketId, socket, amHostRef };
}
