"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Eraser, Undo2 } from "lucide-react";
import { GameNavLink, LobbyExitLink } from "@/components/GameNavLink";
import { GameIcon } from "@/components/GameIcon";
import { RematchPanel, useRematch } from "@/components/RematchPanel";
import {
  clearCanvasElement,
  drawStroke,
  redrawCanvas,
  type DrawPoint,
  type DrawStroke,
} from "@/lib/canvas";
import { useRoom } from "@/lib/useRoom";
import { filterPlainText, filterWordText, isWordValid } from "@/lib/validation";
import type { GameEvent } from "@/lib/types";

type DrawPayload = { points: DrawPoint[]; color: string; done?: boolean };

const COLORS = [
  "#1f1f1f", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899",
  "#ffffff",
];

export default function DibujaPage() {
  const params = useSearchParams();
  const router = useRouter();
  const code = params.get("code") ?? "";
  const { me, opponent, socket, amHostRef } = useRoom();
  const isHost = me?.isHost ?? false;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const pointsBuffer = useRef<DrawPoint[]>([]);
  const currentStrokeRef = useRef<DrawPoint[]>([]);
  const strokesRef = useRef<DrawStroke[]>([]);
  const isDrawerRef = useRef(false);
  const colorRef = useRef("#1f1f1f");
  const firstDrawerIsHostRef = useRef(false);
  const roundRef = useRef(1);

  const [color, setColor] = useState("#1f1f1f");
  const [isDrawer, setIsDrawer] = useState(false);
  const [wordInput, setWordInput] = useState("");
  const [word, setWord] = useState("");
  const [guess, setGuess] = useState("");
  const [guesses, setGuesses] = useState<{ nickname: string; text: string; correct: boolean }[]>([]);
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [round, setRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(4);
  const [phase, setPhase] = useState<"config" | "wordentry" | "drawing" | "roundover">("config");
  const [roundWinner, setRoundWinner] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [strokeCount, setStrokeCount] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function resetStrokes() {
    strokesRef.current = [];
    currentStrokeRef.current = [];
    setStrokeCount(0);
    const canvas = canvasRef.current;
    if (canvas) clearCanvasElement(canvas);
  }

  function renderStrokes() {
    const canvas = canvasRef.current;
    if (canvas) redrawCanvas(canvas, strokesRef.current);
  }

  useEffect(() => { colorRef.current = color; }, [color]);

  function calcIsDrawer(r: number): boolean {
    const drawerIsHost = firstDrawerIsHostRef.current === (r % 2 === 1);
    return amHostRef.current === drawerIsHost;
  }

  const resetRematch = useCallback(() => {
    setMyScore(0);
    setOppScore(0);
    setRound(1);
    roundRef.current = 1;
    setWordInput("");
    setWord("");
    resetStrokes();
    setPhase("config");
  }, []);

  useEffect(() => {
    const errorHandler = () => router.push("/");
    socket.on("error", errorHandler);
    return () => { socket.off("error", errorHandler); };
  }, [socket, router]);

  useEffect(() => {
    const handler = (event: GameEvent & { _from?: string }) => {
      const { type, payload, _from } = event;

      if (type === "dibuja:config") {
        const p = payload as { maxRounds: number; firstDrawerIsHost: boolean };
        setMaxRounds(p.maxRounds);
        firstDrawerIsHostRef.current = p.firstDrawerIsHost;
        roundRef.current = 1;
        setRound(1);
        const amDrawer = calcIsDrawer(1);
        isDrawerRef.current = amDrawer;
        setIsDrawer(amDrawer);
        setWordInput("");
        setGuesses([]);
        resetStrokes();
        setPhase("wordentry");
      }

      if (type === "dibuja:word") {
        const p = payload as { word: string; timeLimit: number };
        setWord(p.word);
        setGuess("");
        setGuesses([]);
        setRoundWinner("");
        resetStrokes();
        setPhase("drawing");
        setTimeLeft(p.timeLimit);

        if (tickRef.current) clearInterval(tickRef.current);
        tickRef.current = setInterval(() => {
          setTimeLeft((t) => {
            if (t <= 1) { clearInterval(tickRef.current!); return 0; }
            return t - 1;
          });
        }, 1000);

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          socket.emit("game:action", { type: "dibuja:timeout", payload: {} });
        }, p.timeLimit * 1000);
      }

      if (type === "dibuja:draw" && !isDrawerRef.current) {
        const dp = payload as DrawPayload;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        drawStroke(ctx, canvas, { points: dp.points, color: dp.color });
        if (dp.done) {
          strokesRef.current.push({ points: dp.points, color: dp.color });
          setStrokeCount(strokesRef.current.length);
        }
      }

      if (type === "dibuja:guess") {
        const p = payload as { nickname: string; text: string; correct: boolean };
        setGuesses((g) => [...g, p]);
        if (p.correct) {
          if (tickRef.current) clearInterval(tickRef.current);
          if (timerRef.current) clearTimeout(timerRef.current);
          if (_from === socket.id) setMyScore((s) => s + 1);
          else setOppScore((s) => s + 1);
          setRoundWinner(p.nickname);
          setPhase("roundover");
        }
      }

      if (type === "dibuja:timeout") {
        if (tickRef.current) clearInterval(tickRef.current);
        if (timerRef.current) clearTimeout(timerRef.current);
        setRoundWinner("");
        setPhase("roundover");
      }

      if (type === "dibuja:next") {
        const newRound = roundRef.current + 1;
        roundRef.current = newRound;
        setRound(newRound);
        const amDrawer = calcIsDrawer(newRound);
        isDrawerRef.current = amDrawer;
        setIsDrawer(amDrawer);
        setWordInput("");
        setWord("");
        resetStrokes();
        setPhase("wordentry");
      }

      if (type === "game:end") router.push("/");

      if (type === "dibuja:clear") resetStrokes();

      if (type === "dibuja:undo" && _from !== socket.id) {
        strokesRef.current.pop();
        setStrokeCount(strokesRef.current.length);
        renderStrokes();
      }
    };

    socket.on("game:event", handler);
    return () => {
      socket.off("game:event", handler);
      if (tickRef.current) clearInterval(tickRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [socket, router, amHostRef]);

  function startGame(rounds: number, firstDrawerIsHost: boolean) {
    firstDrawerIsHostRef.current = firstDrawerIsHost;
    socket.emit("game:action", {
      type: "dibuja:config",
      payload: { maxRounds: rounds, firstDrawerIsHost },
    });
  }

  function submitWord() {
    const w = filterWordText(wordInput);
    if (!isWordValid(w)) return;
    socket.emit("game:action", { type: "dibuja:word", payload: { word: w, timeLimit: 60 } });
  }

  function sendGuess() {
    if (!guess.trim() || phase !== "drawing" || isDrawer) return;
    const text = filterPlainText(guess).trim();
    if (!text) return;
    const correct = text.toLowerCase() === word.toLowerCase();
    const nickname = me?.nickname ?? "Yo";
    socket.emit("game:action", { type: "dibuja:guess", payload: { nickname, text, correct } });
    setGuess("");
  }

  function nextRound() {
    socket.emit("game:action", { type: "dibuja:next", payload: {} });
  }

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
  }

  function onPointerDown(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawerRef.current) return;
    drawing.current = true;
    const pos = { ...getPos(e), drawing: false };
    pointsBuffer.current = [pos];
    currentStrokeRef.current = [pos];
  }

  function onPointerMove(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawerRef.current || !drawing.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e);
    const prev = pointsBuffer.current[pointsBuffer.current.length - 1];
    ctx.strokeStyle = colorRef.current;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(prev.x * canvas.width, prev.y * canvas.height);
    ctx.lineTo(pos.x * canvas.width, pos.y * canvas.height);
    ctx.stroke();
    const point = { ...pos, drawing: true };
    pointsBuffer.current.push(point);
    currentStrokeRef.current.push(point);
    if (pointsBuffer.current.length >= 5) {
      socket.emit("game:action", {
        type: "dibuja:draw",
        payload: { points: [...pointsBuffer.current], color: colorRef.current } as DrawPayload,
      });
      pointsBuffer.current = [{ ...pos, drawing: false }];
    }
  }

  function onPointerUp() {
    if (!drawing.current) return;
    drawing.current = false;
    if (currentStrokeRef.current.length > 1) {
      const stroke: DrawStroke = {
        points: [...currentStrokeRef.current],
        color: colorRef.current,
      };
      strokesRef.current.push(stroke);
      setStrokeCount(strokesRef.current.length);
      socket.emit("game:action", {
        type: "dibuja:draw",
        payload: { points: stroke.points, color: stroke.color, done: true } as DrawPayload,
      });
    }
    pointsBuffer.current = [];
    currentStrokeRef.current = [];
  }

  function onClear() {
    resetStrokes();
    socket.emit("game:action", { type: "dibuja:clear", payload: {} });
  }

  function onUndo() {
    if (strokesRef.current.length === 0) return;
    strokesRef.current.pop();
    setStrokeCount(strokesRef.current.length);
    renderStrokes();
    socket.emit("game:action", { type: "dibuja:undo", payload: {} });
  }

  const myName = me?.nickname ?? "Yo";
  const oppName = opponent?.nickname ?? "Ellos";
  const gameOver = round > maxRounds;
  const iWon = myScore > oppScore;
  const isTie = myScore === oppScore;

  const rematch = useRematch({
    socket,
    isLoser: !iWon && !isTie,
    isWinner: iWon,
    isTie,
    enabled: gameOver,
    onAccept: resetRematch,
  });

  const HeaderBar = () => (
    <div className="flex w-full max-w-lg justify-between items-center mb-3">
      <GameNavLink className="text-sm opacity-40 hover:opacity-70">← Inicio</GameNavLink>
      <span className="text-sm font-medium opacity-60 flex items-center gap-1">
        <GameIcon gameId="dibuja" size={14} className="text-[var(--color-accent)]" />
        Dibuja · R {round}/{maxRounds}
      </span>
      <GameNavLink className="text-sm opacity-40 hover:opacity-70">Salir</GameNavLink>
    </div>
  );

  const ScoreBar = () => (
    <div className="flex gap-12 text-2xl font-bold mb-4">
      <div className="flex flex-col items-center gap-1">
        <span className="text-[var(--color-accent)]">{myScore}</span>
        <span className="text-xs opacity-50">{myName}</span>
      </div>
      <span className="opacity-30 self-center">–</span>
      <div className="flex flex-col items-center gap-1">
        <span className="text-[var(--color-secondary)]">{oppScore}</span>
        <span className="text-xs opacity-50">{oppName}</span>
      </div>
    </div>
  );

  if (phase === "config") {
    if (!isHost) return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-1 flex items-center justify-center gap-2">
          <GameIcon gameId="dibuja" size={24} className="text-[var(--color-accent)]" />
          Dibuja y Adivina
        </h2>
        <p className="text-sm opacity-50 mb-4">Partida: {code}</p>
        <p className="animate-pulse opacity-60">Esperando configuración del anfitrión...</p>
        <LobbyExitLink className="mt-8 text-sm opacity-40 hover:opacity-70 underline">← Salir</LobbyExitLink>
      </main>
    );
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-1 flex items-center justify-center gap-2">
          <GameIcon gameId="dibuja" size={24} className="text-[var(--color-accent)]" />
          Dibuja y Adivina
        </h2>
        <p className="text-sm opacity-50 mb-6">Partida: {code}</p>
        <DibujaConfigPicker oppName={oppName} onStart={startGame} />
        <LobbyExitLink className="mt-8 text-sm opacity-40 hover:opacity-70 underline">← Salir</LobbyExitLink>
      </main>
    );
  }

  if (gameOver) {
    const winner = myScore > oppScore ? myName : myScore < oppScore ? oppName : null;
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-4">Fin del juego</h2>
        <p className="text-3xl font-bold mb-2">{winner ? `${winner} gana!` : "Empate!"}</p>
        <ScoreBar />
        <RematchPanel
          oppName={oppName}
          isWinner={iWon}
          isLoser={!iWon && !isTie}
          isTie={isTie}
          rematch={rematch}
        />
      </main>
    );
  }

  if (phase === "wordentry") {
    if (!isDrawer) return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <HeaderBar />
        <ScoreBar />
        <p className="text-lg font-medium mb-2">Ronda {round}</p>
        <p className="animate-pulse opacity-60 text-sm">{oppName} esta eligiendo que dibujar...</p>
      </main>
    );
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <HeaderBar />
        <ScoreBar />
        <p className="text-lg font-medium mb-1">Ronda {round} — Tu turno de dibujar</p>
        <p className="text-sm opacity-50 mb-5">{oppName} va a adivinar tu dibujo</p>
        <input
          type="text"
          value={wordInput}
          onChange={(e) => setWordInput(filterWordText(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && submitWord()}
          placeholder="Que vas a dibujar?"
          maxLength={20}
          className="input-field text-xl font-mono tracking-widest uppercase mb-4 w-full max-w-xs"
          autoFocus
        />
        <button
          onClick={submitWord}
          disabled={!isWordValid(wordInput)}
          className="btn-primary disabled:opacity-40"
        >
          A dibujar!
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center p-4">
      <HeaderBar />
      <ScoreBar />

      {isDrawer ? (
        <div className="flex items-center gap-4 mb-2">
          <div className="bg-[var(--color-accent-light)] border border-[var(--color-border)] rounded-xl px-4 py-1 font-bold">
            Dibuja: <span className="text-[var(--color-accent)]">{word}</span>
          </div>
          <span className={`font-bold ${timeLeft <= 10 ? "text-red-500 animate-pulse" : "opacity-60"}`}>{timeLeft}s</span>
        </div>
      ) : (
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm opacity-60">{oppName} esta dibujando...</span>
          <span className={`font-bold ${timeLeft <= 10 ? "text-red-500 animate-pulse" : "opacity-60"}`}>{timeLeft}s</span>
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={500}
        height={350}
        className="border-2 border-[var(--color-border)] rounded-2xl bg-white mb-2 touch-none"
        style={{ maxWidth: "100%", cursor: isDrawer ? "crosshair" : "default" }}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
      />

      {isDrawer && phase === "drawing" && (
        <div className="flex items-center gap-3 mb-3 flex-wrap justify-center">
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${
                  color === c ? "border-gray-700 scale-125" : "border-gray-300"
                } ${c === "#ffffff" ? "border-gray-400" : ""}`}
              />
            ))}
          </div>
          <button
            onClick={onUndo}
            disabled={strokeCount === 0}
            className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100 disabled:opacity-30"
          >
            <Undo2 size={14} aria-hidden />
            Deshacer
          </button>
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-xs opacity-50 hover:opacity-70"
          >
            <Eraser size={14} aria-hidden />
            Limpiar
          </button>
        </div>
      )}

      <div className="w-full max-w-md bg-pink-50 rounded-xl p-3 text-sm max-h-24 overflow-y-auto mb-3">
        {guesses.length === 0
          ? <p className="opacity-40 text-center text-xs">Sin respuestas aun...</p>
          : guesses.map((g, i) => (
            <p key={i} className={`mb-0.5 ${g.correct ? "text-green-600 font-bold" : ""}`}>
              <span className="font-medium">{g.nickname}:</span> {g.text} {g.correct ? "OK!" : ""}
            </p>
          ))
        }
      </div>

      {!isDrawer && phase === "drawing" && (
        <div className="flex gap-2 w-full max-w-md">
          <input
            type="text"
            value={guess}
            onChange={(e) => setGuess(filterPlainText(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && sendGuess()}
            placeholder="Tu respuesta..."
            className="flex-1 border-2 border-[var(--color-border)] rounded-xl px-4 py-2 outline-none focus:border-pink-400"
          />
          <button onClick={sendGuess} className="btn-primary px-4 py-2">
            Enviar
          </button>
        </div>
      )}

      {phase === "roundover" && (
        <div className="text-center mt-2">
          <p className="text-xl font-bold mb-1">
            {roundWinner ? `${roundWinner} adivino!` : `Tiempo agotado. Era: ${word}`}
          </p>
          {isHost ? (
            <button onClick={nextRound} className="btn-primary mt-2">
              Siguiente ronda
            </button>
          ) : (
            <p className="text-sm animate-pulse opacity-50 mt-2">Esperando al anfitrion...</p>
          )}
        </div>
      )}
    </main>
  );
}

function DibujaConfigPicker({
  oppName,
  onStart,
}: {
  oppName: string;
  onStart: (rounds: number, firstDrawerIsHost: boolean) => void;
}) {
  const [rounds, setRounds] = useState<number | null>(null);

  if (!rounds) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="font-medium">¿Cuántas rondas?</p>
        <div className="flex gap-3">
          {[4, 6, 8].map((n) => (
            <button key={n} onClick={() => setRounds(n)}
              className="btn-primary py-3 px-6 text-lg">
              {n}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="font-medium">¿Quién dibuja primero?</p>
      <div className="flex gap-3">
        <button
          onClick={() => onStart(rounds, true)}
          className="bg-pink-400 hover:bg-pink-500 text-white font-bold py-3 px-6 rounded-xl"
        >
          Yo dibujo
        </button>
        <button
          onClick={() => onStart(rounds, false)}
          className="bg-blue-400 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl"
        >
          {oppName} dibuja
        </button>
      </div>
      <button onClick={() => setRounds(null)} className="text-xs opacity-40 hover:opacity-60 underline">
        Cambiar rondas
      </button>
    </div>
  );
}
