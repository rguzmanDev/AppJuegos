"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useRoom } from "@/lib/useRoom";
import type { GameEvent } from "@/lib/types";

type DrawPoint = { x: number; y: number; drawing: boolean };

const WORDS = [
  "GATO", "PERRO", "CASA", "SOL", "LUNA", "ÃRBOL", "BARCO", "COHETE",
  "PINGÃœINO", "POLLITO", "OSITO", "PIZZA", "CORAZÃ“N", "PLAYA", "MONTAÃ‘A",
  "BICICLETA", "HELADO", "CASTILLO", "MARIPOSA", "DRAGÃ“N",
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

  // Use refs for values needed in event handlers (avoid stale closures)
  const isDrawerRef = useRef(false);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) {
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1f1f1f";
    }
  }, []);

  useEffect(() => {
    const handler = (event: GameEvent) => {
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
          // Time's up - end round with no winner
          socket.emit("game:action", { type: "dibuja:timeout", payload: {} });
        }, p.timeLimit * 1000);
      }

      if (type === "dibuja:draw" && !isDrawerRef.current && _from !== socket.id) {
        const pts = payload as DrawPoint[];
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        ctx.beginPath();
        pts.forEach((pt, i) => {
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
          // Guesser gets point; drawer also gets point for good drawing
          const iWasGuesser = !isDrawerRef.current;
          if (iWasGuesser && _from === socket.id) setMyScore(s => s + 1);
          else if (!iWasGuesser && _from !== socket.id) setMyScore(s => s + 1);
          if (iWasGuesser && _from !== socket.id) setOppScore(s => s + 1);
          else if (!iWasGuesser && _from === socket.id) setOppScore(s => s + 1);
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

  function startRound(iAmDrawer: boolean, timeSecs: number) {
    const myIsHost = amHostRef.current;
    const drawerIsHost = iAmDrawer ? myIsHost : !myIsHost;
    const w = randomWord();
    socket.emit("game:action", {
      type: "dibuja:start",
      payload: { drawerIsHost, word: w, timeLimit: timeSecs },
    });
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

  // Send draw points to opponent
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
    ctx.beginPath();
    ctx.moveTo(prev.x * canvas.width, prev.y * canvas.height);
    ctx.lineTo(pos.x * canvas.width, pos.y * canvas.height);
    ctx.stroke();
    pointsBuffer.current.push({ ...pos, drawing: true });

    if (pointsBuffer.current.length >= 5) {
      socket.emit("game:action", { type: "dibuja:draw", payload: [...pointsBuffer.current] });
      pointsBuffer.current = [{ ...pos, drawing: false }];
    }
  }

  function onPointerUp(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    drawing.current = false;
    if (pointsBuffer.current.length > 1) {
      socket.emit("game:action", { type: "dibuja:draw", payload: [...pointsBuffer.current] });
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
      <Link href="/" className="text-sm opacity-40 hover:opacity-70">â† Inicio</Link>
      <span className="text-sm font-medium opacity-60">ðŸ¥ Dibuja Â· R {round}/{maxRounds}</span>
      <button onClick={endGame} className="text-sm opacity-40 hover:opacity-70">Salir</button>
    </div>
  );

  const ScoreBar = () => (
    <div className="flex gap-12 text-2xl font-bold mb-4">
      <div className="flex flex-col items-center gap-1">
        <span className="text-pink-500">{myScore}</span>
        <span className="text-xs opacity-50">{myName}</span>
      </div>
      <span className="opacity-30 self-center">â€“</span>
      <div className="flex flex-col items-center gap-1">
        <span className="text-blue-500">{oppScore}</span>
        <span className="text-xs opacity-50">{oppName}</span>
      </div>
    </div>
  );

  if (phase === "config") {
    if (!isHost) return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-1">🥚 Dibuja y Adivina</h2>
        <p className="text-sm opacity-50 mb-4">Partida: {code}</p>
        <p className="animate-pulse opacity-60">Esperando configuración del anfitrión...</p>
        <Link href="/" className="mt-8 text-sm opacity-40 hover:opacity-70 underline">← Salir</Link>
      </main>
    );
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-1">ðŸ¥ Dibuja y Adivina</h2>
        <p className="text-sm opacity-50 mb-8">Partida: {code}</p>
        <p className="font-medium mb-4">Â¿CuÃ¡ntas rondas?</p>
        <div className="flex gap-3 mb-8">
          {[4, 6, 8].map(n => (
            <button key={n} onClick={() => configGame(n)}
              className="bg-pink-400 hover:bg-pink-500 text-white font-bold py-3 px-6 rounded-xl text-lg">
              {n}
            </button>
          ))}
        </div>
        <Link href="/" className="text-sm opacity-40 hover:opacity-70 underline">← Salir</Link>
      </main>
    );
  }

  if (gameOver) {
    const winner = myScore > oppScore ? myName : myScore < oppScore ? oppName : null;
    const iWon = myScore > oppScore;
    const isTie = myScore === oppScore;
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-4">🥚 Fin del juego</h2>
        <p className="text-3xl font-bold mb-2">
          {winner ? `🎉 ${winner} gana!` : "¡Empate! 🤝"}
        </p>
        <ScoreBar />
        <div className="flex flex-col items-center gap-3 mt-2">
          {theyRequested && (iWon || isTie) ? (
            <button onClick={acceptRematch}
              className="bg-green-400 text-white font-bold py-3 px-8 rounded-xl hover:bg-green-500">
              🔥 ¡{oppName} quiere revancha! Aceptar
            </button>
          ) : !iRequested && (!iWon || isTie) ? (
            <button onClick={requestRematch}
              className="bg-pink-400 text-white font-bold py-3 px-8 rounded-xl hover:bg-pink-500">
              Pedir revancha
            </button>
          ) : iRequested ? (
            <p className="text-sm animate-pulse opacity-50">Esperando respuesta de {oppName}...</p>
          ) : (
            <p className="text-sm opacity-40">Espera a que {oppName} pida revancha...</p>
          )}
          <Link href="/" className="bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-xl hover:bg-gray-300">Inicio</Link>
        </div>
      </main>
    );
  }

  if (phase === "role") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        {!isHost ? (
          <>
            <HeaderBar />
            <ScoreBar />
            <p className="animate-pulse opacity-60">El anfitrión está eligiendo quién dibuja...</p>
          </>
        ) : (<>
        <HeaderBar />
        <ScoreBar />
        <p className="font-medium mb-5">Â¿QuiÃ©n dibuja esta ronda?</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {[60, 90].map(s => (
            <div key={s} className="flex gap-3 justify-center">
              <button onClick={() => startRound(true, s)}
                className="bg-pink-400 text-white font-bold py-3 px-5 rounded-xl hover:bg-pink-500 text-sm">
                Yo dibujo ðŸ–Šï¸ ({s}s)
              </button>
              <button onClick={() => startRound(false, s)}
                className="bg-blue-400 text-white font-bold py-3 px-5 rounded-xl hover:bg-blue-500 text-sm">
                {oppName} dibuja ({s}s)
              </button>
            </div>
          ))}
        </div>
        </>)}
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
          <span className="text-sm opacity-60">{oppName} estÃ¡ dibujandoâ€¦</span>
          <span className={`font-bold ${timeLeft <= 10 ? "text-red-500 animate-pulse" : "opacity-60"}`}>
            {timeLeft}s
          </span>
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={500}
        height={350}
        className="border-2 border-pink-200 rounded-2xl bg-white mb-3 touch-none"
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
        <button onClick={onClear} className="text-xs opacity-50 hover:opacity-70 underline mb-2">
          Borrar canvas
        </button>
      )}

      {/* Guesses feed */}
      <div className="w-full max-w-md bg-pink-50 rounded-xl p-3 text-sm max-h-24 overflow-y-auto mb-3">
        {guesses.length === 0
          ? <p className="opacity-40 text-center text-xs">Sin respuestas aÃºn...</p>
          : guesses.map((g, i) => (
            <p key={i} className={`mb-0.5 ${g.correct ? "text-green-600 font-bold" : ""}`}>
              <span className="font-medium">{g.nickname}:</span> {g.text} {g.correct ? "âœ…" : ""}
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
            {roundWinner ? `ðŸŽ‰ ${roundWinner} adivinÃ³!` : `â° Tiempo agotado. Era: ${word}`}
          </p>
          {isHost ? (
            <button onClick={nextRound}
              className="bg-pink-400 hover:bg-pink-500 text-white font-bold py-3 px-8 rounded-xl mt-2">
              Siguiente ronda →
            </button>
          ) : (
            <p className="text-sm animate-pulse opacity-50 mt-2">Esperando al anfitrión...</p>
          )}
        </div>
      )}
    </main>
  );
}

