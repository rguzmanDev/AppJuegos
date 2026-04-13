"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useRoom } from "@/lib/useRoom";
import type { GameEvent } from "@/lib/types";

type DrawPoint = { x: number; y: number; drawing: boolean };
type DrawPayload = { points: DrawPoint[]; color: string };

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
  const [iRequested, setIRequested] = useState(false);
  const [theyRequested, setTheyRequested] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  useEffect(() => { colorRef.current = color; }, [color]);

  function calcIsDrawer(r: number): boolean {
    const drawerIsHost = firstDrawerIsHostRef.current === (r % 2 === 1);
    return amHostRef.current === drawerIsHost;
  }

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
        clearCanvas();
        setPhase("wordentry");
      }

      if (type === "dibuja:word") {
        const p = payload as { word: string; timeLimit: number };
        setWord(p.word);
        setGuess("");
        setGuesses([]);
        setRoundWinner("");
        clearCanvas();
        setPhase("drawing");
        setTimeLeft(p.timeLimit);

        if (tickRef.current) clearInterval(tickRef.current);
        tickRef.current = setInterval(() => {
          setTimeLeft(t => {
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
        ctx.strokeStyle = dp.color;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        dp.points.forEach((pt, i) => {
          const px = pt.x * canvas.width;
          const py = pt.y * canvas.height;
          if (!pt.drawing || i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      }

      if (type === "dibuja:guess") {
        const p = payload as { nickname: string; text: string; correct: boolean };
        setGuesses(g => [...g, p]);
        if (p.correct) {
          if (tickRef.current) clearInterval(tickRef.current);
          if (timerRef.current) clearTimeout(timerRef.current);
          if (_from === socket.id) setMyScore(s => s + 1);
          else setOppScore(s => s + 1);
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
        clearCanvas();
        setPhase("wordentry");
      }

      if (type === "game:end") router.push("/");

      if (type === "game:rematch") {
        const p = payload as { action: string };
        if (p.action === "request" && _from !== socket.id) setTheyRequested(true);
        if (p.action === "accept") {
          setIRequested(false); setTheyRequested(false);
          setMyScore(0); setOppScore(0);
          setRound(1); roundRef.current = 1;
          setWordInput(""); setWord("");
          clearCanvas();
          setPhase("config");
        }
      }

      if (type === "dibuja:clear") clearCanvas();
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
    const w = wordInput.trim().toUpperCase();
    if (!w) return;
    socket.emit("game:action", { type: "dibuja:word", payload: { word: w, timeLimit: 60 } });
  }

  function sendGuess() {
    if (!guess.trim() || phase !== "drawing" || isDrawer) return;
    const text = guess.trim();
    const correct = text.toLowerCase() === word.toLowerCase();
    const nickname = me?.nickname ?? "Yo";
    socket.emit("game:action", { type: "dibuja:guess", payload: { nickname, text, correct } });
    setGuess("");
  }

  function nextRound() {
    socket.emit("game:action", { type: "dibuja:next", payload: {} });
  }

  function endGame() {
    socket.emit("game:action", { type: "game:end", payload: {} });
    router.push("/");
  }

  function requestRematch() {
    setIRequested(true);
    socket.emit("game:action", { type: "game:rematch", payload: { action: "request" } });
  }

  function acceptRematch() {
    socket.emit("game:action", { type: "game:rematch", payload: { action: "accept" } });
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
    pointsBuffer.current = [{ ...getPos(e), drawing: false }];
  }

  function onPointerMove(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawerRef.current || !drawing.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e);
    const prev = pointsBuffer.current[pointsBuffer.current.length - 1];
    ctx.strokeStyle = colorRef.current;
    ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(prev.x * canvas.width, prev.y * canvas.height);
    ctx.lineTo(pos.x * canvas.width, pos.y * canvas.height);
    ctx.stroke();
    pointsBuffer.current.push({ ...pos, drawing: true });
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
    if (pointsBuffer.current.length > 1) {
      socket.emit("game:action", {
        type: "dibuja:draw",
        payload: { points: [...pointsBuffer.current], color: colorRef.current } as DrawPayload,
      });
    }
    pointsBuffer.current = [];
  }

  function onClear() {
    clearCanvas();
    socket.emit("game:action", { type: "dibuja:clear", payload: {} });
  }

  const myName = me?.nickname ?? "Yo";
  const oppName = opponent?.nickname ?? "Ellos";
  const gameOver = round > maxRounds;

  const HeaderBar = () => (
    <div className="flex w-full max-w-lg justify-between items-center mb-3">
      <Link href="/" className="text-sm opacity-40 hover:opacity-70">{"<-"} Inicio</Link>
      <span className="text-sm font-medium opacity-60">{"🎨"} Dibuja {"·"} R {round}/{maxRounds}</span>
      <button onClick={endGame} className="text-sm opacity-40 hover:opacity-70">Salir</button>
    </div>
  );

  const ScoreBar = () => (
    <div className="flex gap-12 text-2xl font-bold mb-4">
      <div className="flex flex-col items-center gap-1">
        <span className="text-pink-500">{myScore}</span>
        <span className="text-xs opacity-50">{myName}</span>
      </div>
      <span className="opacity-30 self-center">{"–"}</span>
      <div className="flex flex-col items-center gap-1">
        <span className="text-blue-500">{oppScore}</span>
        <span className="text-xs opacity-50">{oppName}</span>
      </div>
    </div>
  );

  if (phase === "config") {
    if (!isHost) return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-1">{"🎨"} Dibuja y Adivina</h2>
        <p className="text-sm opacity-50 mb-4">Partida: {code}</p>
        <p className="animate-pulse opacity-60">Esperando configuracion del anfitri&oacute;n...</p>
        <Link href="/" className="mt-8 text-sm opacity-40 hover:opacity-70 underline">{"<-"} Salir</Link>
      </main>
    );
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-1">{"🎨"} Dibuja y Adivina</h2>
        <p className="text-sm opacity-50 mb-6">Partida: {code}</p>
        <DibujaConfigPicker oppName={oppName} onStart={startGame} />
        <Link href="/" className="mt-8 text-sm opacity-40 hover:opacity-70 underline">{"<-"} Salir</Link>
      </main>
    );
  }

  if (gameOver) {
    const winner = myScore > oppScore ? myName : myScore < oppScore ? oppName : null;
    const iWon = myScore > oppScore;
    const isTie = myScore === oppScore;
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-4">{"🎨"} Fin del juego</h2>
        <p className="text-3xl font-bold mb-2">{winner ? `${winner} gana!` : "Empate!"}</p>
        <ScoreBar />
        <div className="flex flex-col items-center gap-3 mt-2">
          {theyRequested && !iRequested ? (
            <button onClick={acceptRematch} className="bg-green-400 text-white font-bold py-3 px-8 rounded-xl hover:bg-green-500">
              {oppName} quiere revancha! Aceptar
            </button>
          ) : iRequested ? (
            <p className="text-sm animate-pulse opacity-50">Esperando respuesta de {oppName}...</p>
          ) : (!iWon || isTie) ? (
            <button onClick={requestRematch} className="bg-pink-400 text-white font-bold py-3 px-8 rounded-xl hover:bg-pink-500">
              Pedir revancha
            </button>
          ) : (
            <p className="text-sm opacity-40">Espera a que {oppName} pida revancha...</p>
          )}
          <Link href="/" className="bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-xl hover:bg-gray-300">Inicio</Link>
        </div>
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
        <p className="text-lg font-medium mb-1">Ronda {round} &mdash; Tu turno de dibujar</p>
        <p className="text-sm opacity-50 mb-5">{oppName} va a adivinar tu dibujo</p>
        <input
          type="text"
          value={wordInput}
          onChange={e => setWordInput(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && submitWord()}
          placeholder="Que vas a dibujar?"
          maxLength={20}
          className="border-2 border-pink-300 rounded-xl px-4 py-3 text-center text-xl font-mono tracking-widest outline-none focus:border-pink-500 uppercase mb-4 w-full max-w-xs"
          autoFocus
        />
        <button
          onClick={submitWord}
          disabled={!wordInput.trim()}
          className="bg-pink-400 hover:bg-pink-500 disabled:opacity-40 text-white font-bold py-3 px-8 rounded-xl"
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
          <div className="bg-pink-100 border border-pink-300 rounded-xl px-4 py-1 font-bold">
            Dibuja: <span className="text-pink-600">{word}</span>
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
        className="border-2 border-pink-200 rounded-2xl bg-white mb-2 touch-none"
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
            {COLORS.map(c => (
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
          <button onClick={onClear} className="text-xs opacity-50 hover:opacity-70 underline">Borrar</button>
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
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendGuess()}
            placeholder="Tu respuesta..."
            className="flex-1 border-2 border-pink-200 rounded-xl px-4 py-2 outline-none focus:border-pink-400"
          />
          <button onClick={sendGuess} className="bg-pink-400 hover:bg-pink-500 text-white font-bold px-4 py-2 rounded-xl">
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
            <button onClick={nextRound} className="bg-pink-400 hover:bg-pink-500 text-white font-bold py-3 px-8 rounded-xl mt-2">
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
        <p className="font-medium">Cuantas rondas?</p>
        <div className="flex gap-3">
          {[4, 6, 8].map(n => (
            <button key={n} onClick={() => setRounds(n)}
              className="bg-pink-400 hover:bg-pink-500 text-white font-bold py-3 px-6 rounded-xl text-lg">
              {n}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="font-medium">Quien dibuja primero?</p>
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
"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useRoom } from "@/lib/useRoom";
import type { GameEvent } from "@/lib/types";

type DrawPoint = { x: number; y: number; drawing: boolean };
type DrawPayload = { points: DrawPoint[]; color: string };

const WORDS = [
  "GATO", "PERRO", "CASA", "SOL", "LUNA", "�RBOL", "BARCO", "COHETE",
  "PING�INO", "POLLITO", "OSITO", "PIZZA", "CORAZ�N", "PLAYA", "MONTA�A",
  "BICICLETA", "HELADO", "CASTILLO", "MARIPOSA", "DRAG�N",
  "AVI�N", "PELOTA", "GUITARRA", "BANANA", "SOMBRERO",
];

const COLORS = [
  "#1f1f1f", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899",
  "#ffffff",
];

function randomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

export default function DibujaPage() {
  const params = useSearchParams();
  const router = useRouter();
  const code = params.get("code") ?? "";
  const { me, opponent, socket, amHostRef } = useRoom();
  const isHost = me?.isHost ?? false;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const pointsBuffer = useRef<DrawPoint[]>([]);
  const isDrawerRef = useRef(false);
  const colorRef = useRef("#1f1f1f");
  const autoStartedRoundRef = useRef(0);

  const [color, setColor] = useState("#1f1f1f");
  const [isDrawer, setIsDrawer] = useState(false);
  const [word, setWord] = useState("");
  const [guess, setGuess] = useState("");
  const [guesses, setGuesses] = useState<{ nickname: string; text: string; correct: boolean }[]>([]);
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [round, setRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(4);
  const [phase, setPhase] = useState<"config" | "role" | "drawing" | "roundover">("config");
  const [roundWinner, setRoundWinner] = useState("");
  const [iRequested, setIRequested] = useState(false);
  const [theyRequested, setTheyRequested] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Keep colorRef in sync
  useEffect(() => { colorRef.current = color; }, [color]);

  // Auto-start round when phase=role and isHost
  useEffect(() => {
    if (phase !== "role" || !isHost) return;
    if (autoStartedRoundRef.current === round) return; // already emitted for this round
    autoStartedRoundRef.current = round;

    // Host draws on odd rounds, guest on even rounds
    const hostDraws = round % 2 === 1;
    const w = randomWord();
    socket.emit("game:action", {
      type: "dibuja:start",
      payload: { drawerIsHost: hostDraws, word: w, timeLimit: 60 },
    });
  }, [phase, isHost, round, socket]);

  useEffect(() => {
    const handler = (event: GameEvent & { _from?: string }) => {
      const { type, payload, _from } = event;

      if (type === "dibuja:config") {
        const p = payload as { maxRounds: number };
        setMaxRounds(p.maxRounds);
        setPhase("role");
      }

      if (type === "dibuja:start") {
        const p = payload as { drawerIsHost: boolean; word: string; timeLimit: number };
        const amDrawer = amHostRef.current === p.drawerIsHost;
        isDrawerRef.current = amDrawer;
        setIsDrawer(amDrawer);
        setWord(p.word);
        setGuess("");
        setGuesses([]);
        setRoundWinner("");
        clearCanvas();
        setPhase("drawing");
        setTimeLeft(p.timeLimit);

        if (tickRef.current) clearInterval(tickRef.current);
        tickRef.current = setInterval(() => {
          setTimeLeft(t => {
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
        ctx.strokeStyle = dp.color;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        dp.points.forEach((pt, i) => {
          const px = pt.x * canvas.width;
          const py = pt.y * canvas.height;
          if (!pt.drawing || i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      }

      if (type === "dibuja:guess") {
        const p = payload as { nickname: string; text: string; correct: boolean };
        setGuesses(g => [...g, p]);
        if (p.correct) {
          if (tickRef.current) clearInterval(tickRef.current);
          if (timerRef.current) clearTimeout(timerRef.current);
          // Only the guesser gets a point
          const iWasGuesser = !isDrawerRef.current;
          if (iWasGuesser && _from === socket.id) setMyScore(s => s + 1);
          if (!iWasGuesser && _from !== socket.id) setOppScore(s => s + 1);
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
        setPhase(prev => {
          if (prev !== "roundover") return prev;
          setRound(r => r + 1);
          return "role";
        });
      }

      if (type === "game:end") {
        router.push("/");
      }

      if (type === "game:rematch") {
        const p = payload as { action: string };
        if (p.action === "request" && _from !== socket.id) {
          setTheyRequested(true);
        }
        if (p.action === "accept") {
          setIRequested(false); setTheyRequested(false);
          setMyScore(0); setOppScore(0); setRound(1);
          autoStartedRoundRef.current = 0;
          clearCanvas();
          setPhase("config");
        }
      }

      if (type === "dibuja:clear") {
        clearCanvas();
      }
    };

    socket.on("game:event", handler);
    return () => {
      socket.off("game:event", handler);
      if (tickRef.current) clearInterval(tickRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [socket, router, amHostRef]);

  function configGame(rounds: number) {
    setMaxRounds(rounds);
    socket.emit("game:action", { type: "dibuja:config", payload: { maxRounds: rounds } });
    setPhase("role");
  }

  function sendGuess() {
    if (!guess.trim() || phase !== "drawing" || isDrawer) return;
    const text = guess.trim();
    const correct = text.toLowerCase() === word.toLowerCase();
    const nickname = me?.nickname ?? "Yo";
    socket.emit("game:action", {
      type: "dibuja:guess",
      payload: { nickname, text, correct },
    });
    setGuess("");
  }

  function nextRound() {
    socket.emit("game:action", { type: "dibuja:next", payload: {} });
  }

  function endGame() {
    socket.emit("game:action", { type: "game:end", payload: {} });
    router.push("/");
  }

  function requestRematch() {
    setIRequested(true);
    socket.emit("game:action", { type: "game:rematch", payload: { action: "request" } });
  }

  function acceptRematch() {
    socket.emit("game:action", { type: "game:rematch", payload: { action: "accept" } });
  }

  function getCanvas() { return canvasRef.current!; }

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const rect = getCanvas().getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  }

  function onPointerDown(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawerRef.current) return;
    drawing.current = true;
    const pos = getPos(e);
    pointsBuffer.current = [{ ...pos, drawing: false }];
  }

  function onPointerMove(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawerRef.current || !drawing.current) return;
    const canvas = getCanvas();
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
    pointsBuffer.current.push({ ...pos, drawing: true });

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
    if (pointsBuffer.current.length > 1) {
      socket.emit("game:action", {
        type: "dibuja:draw",
        payload: { points: [...pointsBuffer.current], color: colorRef.current } as DrawPayload,
      });
    }
    pointsBuffer.current = [];
  }

  function onClear() {
    clearCanvas();
    socket.emit("game:action", { type: "dibuja:clear", payload: {} });
  }

  const myName = me?.nickname ?? "Yo";
  const oppName = opponent?.nickname ?? "Ellos";
  const gameOver = round > maxRounds;

  const HeaderBar = () => (
    <div className="flex w-full max-w-lg justify-between items-center mb-3">
      <Link href="/" className="text-sm opacity-40 hover:opacity-70">? Inicio</Link>
      <span className="text-sm font-medium opacity-60">?? Dibuja � R {round}/{maxRounds}</span>
      <button onClick={endGame} className="text-sm opacity-40 hover:opacity-70">Salir</button>
    </div>
  );

  const ScoreBar = () => (
    <div className="flex gap-12 text-2xl font-bold mb-4">
      <div className="flex flex-col items-center gap-1">
        <span className="text-pink-500">{myScore}</span>
        <span className="text-xs opacity-50">{myName}</span>
      </div>
      <span className="opacity-30 self-center">�</span>
      <div className="flex flex-col items-center gap-1">
        <span className="text-blue-500">{oppScore}</span>
        <span className="text-xs opacity-50">{oppName}</span>
      </div>
    </div>
  );

  if (phase === "config") {
    if (!isHost) return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-1">?? Dibuja y Adivina</h2>
        <p className="text-sm opacity-50 mb-4">Partida: {code}</p>
        <p className="animate-pulse opacity-60">Esperando configuraci�n del anfitri�n...</p>
        <Link href="/" className="mt-8 text-sm opacity-40 hover:opacity-70 underline">? Salir</Link>
      </main>
    );
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-1">?? Dibuja y Adivina</h2>
        <p className="text-sm opacity-50 mb-8">Partida: {code}</p>
        <p className="font-medium mb-4">�Cu�ntas rondas?</p>
        <div className="flex gap-3 mb-8">
          {[4, 6, 8].map(n => (
            <button key={n} onClick={() => configGame(n)}
              className="bg-pink-400 hover:bg-pink-500 text-white font-bold py-3 px-6 rounded-xl text-lg">
              {n}
            </button>
          ))}
        </div>
        <p className="text-xs opacity-40">Los roles se alternan autom�ticamente cada ronda.</p>
        <Link href="/" className="mt-6 text-sm opacity-40 hover:opacity-70 underline">? Salir</Link>
      </main>
    );
  }

  if (gameOver) {
    const winner = myScore > oppScore ? myName : myScore < oppScore ? oppName : null;
    const iWon = myScore > oppScore;
    const isTie = myScore === oppScore;
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-4">?? Fin del juego</h2>
        <p className="text-3xl font-bold mb-2">
          {winner ? `?? ${winner} gana!` : "�Empate! ??"}
        </p>
        <ScoreBar />
        <div className="flex flex-col items-center gap-3 mt-2">
          {theyRequested && !iRequested ? (
            <button onClick={acceptRematch}
              className="bg-green-400 text-white font-bold py-3 px-8 rounded-xl hover:bg-green-500">
              ?? �{oppName} quiere revancha! Aceptar
            </button>
          ) : iRequested ? (
            <p className="text-sm animate-pulse opacity-50">Esperando respuesta de {oppName}...</p>
          ) : (!iWon || isTie) ? (
            <button onClick={requestRematch}
              className="bg-pink-400 text-white font-bold py-3 px-8 rounded-xl hover:bg-pink-500">
              Pedir revancha
            </button>
          ) : (
            <p className="text-sm opacity-40">Espera a que {oppName} pida revancha...</p>
          )}
          <Link href="/" className="bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-xl hover:bg-gray-300">Inicio</Link>
        </div>
      </main>
    );
  }

  // role phase: show "starting..." while host auto-emits dibuja:start
  if (phase === "role") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <HeaderBar />
        <ScoreBar />
        <p className="animate-pulse opacity-60">Iniciando ronda...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center p-4">
      <HeaderBar />
      <ScoreBar />

      {isDrawer && (
        <div className="flex items-center gap-4 mb-2">
          <div className="bg-pink-100 border border-pink-300 rounded-xl px-4 py-1 font-bold">
            Dibuja: <span className="text-pink-600">{word}</span>
          </div>
          <span className={`font-bold ${timeLeft <= 10 ? "text-red-500 animate-pulse" : "opacity-60"}`}>
            {timeLeft}s
          </span>
        </div>
      )}
      {!isDrawer && (
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm opacity-60">{oppName} est� dibujando�</span>
          <span className={`font-bold ${timeLeft <= 10 ? "text-red-500 animate-pulse" : "opacity-60"}`}>
            {timeLeft}s
          </span>
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={500}
        height={350}
        className="border-2 border-pink-200 rounded-2xl bg-white mb-2 touch-none"
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
            {COLORS.map(c => (
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
          <button onClick={onClear} className="text-xs opacity-50 hover:opacity-70 underline">
            Borrar
          </button>
        </div>
      )}

      {/* Guesses feed */}
      <div className="w-full max-w-md bg-pink-50 rounded-xl p-3 text-sm max-h-24 overflow-y-auto mb-3">
        {guesses.length === 0
          ? <p className="opacity-40 text-center text-xs">Sin respuestas a�n...</p>
          : guesses.map((g, i) => (
            <p key={i} className={`mb-0.5 ${g.correct ? "text-green-600 font-bold" : ""}`}>
              <span className="font-medium">{g.nickname}:</span> {g.text} {g.correct ? "?" : ""}
            </p>
          ))
        }
      </div>

      {!isDrawer && phase === "drawing" && (
        <div className="flex gap-2 w-full max-w-md">
          <input
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendGuess()}
            placeholder="Tu respuesta..."
            className="flex-1 border-2 border-pink-200 rounded-xl px-4 py-2 outline-none focus:border-pink-400"
          />
          <button onClick={sendGuess}
            className="bg-pink-400 hover:bg-pink-500 text-white font-bold px-4 py-2 rounded-xl">
            Enviar
          </button>
        </div>
      )}

      {phase === "roundover" && (
        <div className="text-center mt-2">
          <p className="text-xl font-bold mb-1">
            {roundWinner ? `?? ${roundWinner} adivin�!` : `? Tiempo agotado. Era: ${word}`}
          </p>
          {isHost ? (
            <button onClick={nextRound}
              className="bg-pink-400 hover:bg-pink-500 text-white font-bold py-3 px-8 rounded-xl mt-2">
              Siguiente ronda ?
            </button>
          ) : (
            <p className="text-sm animate-pulse opacity-50 mt-2">Esperando al anfitri�n...</p>
          )}
        </div>
      )}
    </main>
  );
}
