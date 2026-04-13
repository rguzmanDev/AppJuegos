"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useRoom } from "@/lib/useRoom";
import type { GameEvent } from "@/lib/types";

const CATEGORIES = ["Nombre", "Animal", "Fruta/Verdura", "País", "Color", "Cosa"];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomLetter() {
  return LETTERS[Math.floor(Math.random() * LETTERS.length)];
}

type Answers = Record<string, string>;
type BothAnswers = { mine: Answers; theirs: Answers };

/**
 * Scoring rules:
 * - Both marked opp's answer invalid  → opp gets 0
 * - Only one marked it invalid        → disputed → both get 50 (benefit of the doubt)
 * - Neither marked it invalid         → normal scoring (100 unique / 50 tied)
 * myInvalid = categories I flagged as invalid in OPP's answers
 * theirInvalid = categories OPP flagged as invalid in MY answers
 */
function calcScore(
  mine: Answers,
  theirs: Answers,
  myInvalidOpp: string[],   // I voted opp's cat invalid
  theirInvalidMe: string[]  // Opp voted my cat invalid
): { myPts: number; oppPts: number; disputed: string[] } {
  let myPts = 0, oppPts = 0;
  const disputed: string[] = [];

  for (const cat of CATEGORIES) {
    const m = (mine[cat] ?? "").trim().toLowerCase();
    const t = (theirs[cat] ?? "").trim().toLowerCase();

    const myAnswerDisputed = theirInvalidMe.includes(cat) && !myInvalidOpp.includes(cat);
    const oppAnswerInvalid = myInvalidOpp.includes(cat) && theirInvalidMe.includes(cat);
    const oppAnswerDisputed = myInvalidOpp.includes(cat) && !theirInvalidMe.includes(cat);

    // My answer
    if (m) {
      if (oppAnswerInvalid) {
        // both agreed my answer is invalid — wait, theirInvalidMe means opp flagged MY answer
        // oppAnswerInvalid above is about OPP's answer. Let me redo:
      }
    }

    // Effective validity of each answer
    const meInvalidMine = theirInvalidMe.includes(cat);    // opp says my answer is bad
    const meInvalidTheirs = myInvalidOpp.includes(cat);    // I say opp's answer is bad

    // My answer validity
    let myAnsValid = true;
    if (meInvalidMine && myInvalidOpp.includes(cat)) {
      // both flagged each other — both invalid
      myAnsValid = false;
    } else if (meInvalidMine) {
      // only opp flagged mine — disputed
      disputed.push(`mine:${cat}`);
      myAnsValid = false; // will add 50 below
    }

    // Opp answer validity
    let oppAnsValid = true;
    if (meInvalidTheirs && theirInvalidMe.includes(cat)) {
      oppAnsValid = false;
    } else if (meInvalidTheirs) {
      // only I flagged theirs — disputed
      if (!disputed.includes(`theirs:${cat}`)) disputed.push(`theirs:${cat}`);
      oppAnsValid = false;
    }

    const mEff = myAnsValid ? m : "";
    const tEff = oppAnsValid ? t : "";

    if (mEff && tEff && mEff === tEff) { myPts += 50; oppPts += 50; }
    else if (mEff) myPts += 100;
    else if (tEff) oppPts += 100;

    // Add 50 for disputed (benefit of the doubt)
    if (disputed.includes(`mine:${cat}`) && m) myPts += 50;
    if (disputed.includes(`theirs:${cat}`) && t) oppPts += 50;
  }
  return { myPts, oppPts, disputed };
}

export default function StopPage() {
  const params = useSearchParams();
  const router = useRouter();
  const code = params.get("code") ?? "";
  const { me, opponent, socket } = useRoom();
  const isHost = me?.isHost ?? false;

  const [phase, setPhase] = useState<"config" | "waiting" | "playing" | "validating" | "scoring">("config");
  const [letter, setLetter] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [bothAnswers, setBothAnswers] = useState<BothAnswers | null>(null);

  // What I flag as invalid in OPP's answers
  const [myInvalidOpp, setMyInvalidOpp] = useState<string[]>([]);
  // What OPP flags as invalid in MY answers
  const [theirInvalidMe, setTheirInvalidMe] = useState<string[]>([]);
  const [myValidationSent, setMyValidationSent] = useState(false);
  const [theirValidationReceived, setTheirValidationReceived] = useState(false);

  const [roundScore, setRoundScore] = useState<{ myPts: number; oppPts: number; disputed: string[] } | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [round, setRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(4);
  const [timeLimit, setTimeLimit] = useState(60);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [stopCountdown, setStopCountdown] = useState<number | null>(null);
  const [iRequested, setIRequested] = useState(false);
  const [theyRequested, setTheyRequested] = useState(false);

  const answersRef = useRef<Answers>({});
  const submittedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { answersRef.current = answers; }, [answers]);

  // When both validations are in, reconcile scores
  useEffect(() => {
    if (myValidationSent && theirValidationReceived && bothAnswers && phase === "validating") {
      const score = calcScore(bothAnswers.mine, bothAnswers.theirs, myInvalidOpp, theirInvalidMe);
      setMyScore(s => s + score.myPts);
      setOppScore(s => s + score.oppPts);
      setRoundScore(score);
      setPhase("scoring");
    }
  }, [myValidationSent, theirValidationReceived, bothAnswers, phase, myInvalidOpp, theirInvalidMe]);

  useEffect(() => {
    const handler = (event: GameEvent) => {
      const { type, payload, _from } = event;

      if (type === "stop:config") {
        const p = payload as { maxRounds: number; timeLimit: number };
        setMaxRounds(p.maxRounds);
        setTimeLimit(p.timeLimit);
        setPhase("waiting");
      }

      if (type === "stop:start") {
        const p = payload as { letter: string; timeLimit: number };
        setLetter(p.letter);
        setAnswers({});
        answersRef.current = {};
        setBothAnswers(null);
        setMyInvalidOpp([]);
        setTheirInvalidMe([]);
        setMyValidationSent(false);
        setTheirValidationReceived(false);
        setRoundScore(null);
        setSubmitted(false);
        submittedRef.current = false;
        setStopCountdown(null);
        setPhase("playing");
        setTimeLeft(p.timeLimit);

        if (tickRef.current) clearInterval(tickRef.current);
        tickRef.current = setInterval(() => {
          setTimeLeft(t => {
            if (t <= 1) { if (tickRef.current) clearInterval(tickRef.current); return 0; }
            return t - 1;
          });
        }, 1000);

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => { doSubmit(); }, p.timeLimit * 1000);
      }

      if (type === "stop:submit") {
        const p = payload as { answers: Answers };
        if (_from !== socket.id) {
          setBothAnswers(prev => ({ mine: prev?.mine ?? {}, theirs: p.answers }));
          if (!submittedRef.current) {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (tickRef.current) clearInterval(tickRef.current);
            setStopCountdown(10);
            if (stopTickRef.current) clearInterval(stopTickRef.current);
            stopTickRef.current = setInterval(() => {
              setStopCountdown(c => {
                if (c === null || c <= 1) {
                  if (stopTickRef.current) clearInterval(stopTickRef.current);
                  doSubmit();
                  return null;
                }
                return c - 1;
              });
            }, 1000);
          }
        }
      }

      // Each player sends stop:validate with categories they deem invalid in the OTHER player's answers
      if (type === "stop:validate") {
        const p = payload as { invalid: string[] };
        if (_from !== socket.id) {
          // Opp flagged what they think is invalid in MY answers
          setTheirInvalidMe(p.invalid);
          setTheirValidationReceived(true);
        }
      }

      if (type === "stop:next") {
        setPhase("waiting");
        setRound(r => r + 1);
        setBothAnswers(null);
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
          setPhase("config");
        }
      }
    };

    socket.on("game:event", handler);
    return () => {
      socket.off("game:event", handler);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      if (stopTickRef.current) clearInterval(stopTickRef.current);
    };
  }, [socket, router]);

  // When both answers arrive during playing → go to validating
  useEffect(() => {
    if (bothAnswers && phase === "playing" && submittedRef.current) {
      if (tickRef.current) clearInterval(tickRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (stopTickRef.current) clearInterval(stopTickRef.current);
      setStopCountdown(null);
      setPhase("validating");
    }
  }, [bothAnswers, phase]);

  function configGame(rounds: number, time: number) {
    setMaxRounds(rounds);
    setTimeLimit(time);
    socket.emit("game:action", { type: "stop:config", payload: { maxRounds: rounds, timeLimit: time } });
    setPhase("waiting");
  }

  function startRound() {
    const l = randomLetter();
    socket.emit("game:action", { type: "stop:start", payload: { letter: l, timeLimit: timeLimit } });
  }

  function doSubmit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    if (tickRef.current) clearInterval(tickRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (stopTickRef.current) clearInterval(stopTickRef.current);
    setStopCountdown(null);
    const myAnswers = answersRef.current;
    setBothAnswers(prev => ({ mine: myAnswers, theirs: prev?.theirs ?? {} }));
    socket.emit("game:action", { type: "stop:submit", payload: { answers: myAnswers } });
  }

  function updateAnswer(cat: string, val: string) {
    const next = { ...answersRef.current, [cat]: val };
    answersRef.current = next;
    setAnswers(next);
  }

  function toggleInvalidOpp(cat: string) {
    setMyInvalidOpp(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  }

  function confirmValidation() {
    socket.emit("game:action", { type: "stop:validate", payload: { invalid: myInvalidOpp } });
    setMyValidationSent(true);
  }

  function nextRound() {
    socket.emit("game:action", { type: "stop:next", payload: {} });
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

  const myName = me?.nickname ?? "Yo";
  const oppName = opponent?.nickname ?? "Ellos";
  const gameOver = round > maxRounds;

  const HeaderBar = () => (
    <div className="flex w-full max-w-md justify-between items-center mb-4">
      <Link href="/" className="text-sm opacity-40 hover:opacity-70">← Inicio</Link>
      <span className="text-sm font-medium opacity-60">🐣 Stop · R {round}/{maxRounds}</span>
      <button onClick={endGame} className="text-sm opacity-40 hover:opacity-70">Salir</button>
    </div>
  );

  const ScoreBar = () => (
    <div className="flex gap-12 text-3xl font-bold mb-6">
      <div className="flex flex-col items-center gap-1">
        <span className="text-pink-500">{myScore}</span>
        <span className="text-xs opacity-50">{myName}</span>
      </div>
      <span className="opacity-30 self-center">–</span>
      <div className="flex flex-col items-center gap-1">
        <span className="text-blue-500">{oppScore}</span>
        <span className="text-xs opacity-50">{oppName}</span>
      </div>
    </div>
  );

  // ── CONFIG ──
  if (phase === "config") {
    if (!isHost) return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-1">🐣 Bachillerato / Stop</h2>
        <p className="text-sm opacity-50 mb-4">Partida: {code}</p>
        <p className="animate-pulse opacity-60">Esperando configuración del anfitrión...</p>
        <Link href="/" className="mt-8 text-sm opacity-40 hover:opacity-70 underline">← Salir</Link>
      </main>
    );
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-1">🐣 Bachillerato / Stop</h2>
        <p className="text-sm opacity-50 mb-8">Partida: {code}</p>
        <p className="font-medium mb-4">¿Cuántas rondas?</p>
        <div className="flex gap-3 mb-6">
          {[4, 6, 8].map(n => (
            <button key={n} onClick={() => setMaxRounds(n)}
              className={`font-bold py-3 px-6 rounded-xl text-lg border-2 transition-all ${
                maxRounds === n ? "bg-pink-400 text-white border-pink-400" : "border-gray-200 hover:border-pink-300"
              }`}>{n}</button>
          ))}
        </div>
        <p className="font-medium mb-4">Tiempo por ronda:</p>
        <div className="flex gap-3 mb-8">
          {[30, 60, 90].map(s => (
            <button key={s} onClick={() => setTimeLimit(s)}
              className={`font-bold py-3 px-6 rounded-xl text-lg border-2 transition-all ${
                timeLimit === s ? "bg-pink-400 text-white border-pink-400" : "border-gray-200 hover:border-pink-300"
              }`}>{s}s</button>
          ))}
        </div>
        <button onClick={() => configGame(maxRounds, timeLimit)}
          className="bg-pink-400 hover:bg-pink-500 text-white font-bold py-3 px-8 rounded-xl">
          ¡Listo!
        </button>
        <Link href="/" className="mt-6 text-sm opacity-40 hover:opacity-70 underline">← Salir</Link>
      </main>
    );
  }

  // ── GAME OVER ──
  if (gameOver) {
    const winner = myScore > oppScore ? myName : myScore < oppScore ? oppName : null;
    const iWon = myScore > oppScore;
    const isTie = myScore === oppScore;
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-4">🐣 Fin del juego</h2>
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

  // ── WAITING ──
  if (phase === "waiting") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <HeaderBar />
        <ScoreBar />
        {isHost ? (
          <button onClick={startRound}
            className="bg-pink-400 hover:bg-pink-500 text-white font-bold py-4 px-10 rounded-xl text-xl">
            🎲 Iniciar ronda
          </button>
        ) : (
          <p className="animate-pulse opacity-60">Esperando al anfitrión...</p>
        )}
      </main>
    );
  }

  // ── PLAYING ──
  if (phase === "playing") {
    return (
      <main className="min-h-screen flex flex-col items-center p-6">
        <HeaderBar />
        <div className="flex items-center gap-4 mb-4">
          <div className="text-6xl font-bold text-pink-500">{letter}</div>
          <div className={`text-2xl font-bold ${timeLeft <= 10 ? "text-red-500 animate-pulse" : "opacity-60"}`}>
            {timeLeft}s
          </div>
        </div>

        {stopCountdown !== null && (
          <div className="bg-orange-100 border-2 border-orange-400 rounded-xl px-6 py-3 mb-4 text-center">
            <p className="font-bold text-orange-600">🛑 {oppName} dijo ¡STOP!</p>
            <p className={`text-2xl font-bold text-orange-500 ${stopCountdown <= 5 ? "animate-pulse" : ""}`}>
              {stopCountdown}s para terminar
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 w-full max-w-sm mb-6">
          {CATEGORIES.map((cat) => (
            <div key={cat} className="flex items-center gap-2">
              <label className="w-32 text-sm font-medium opacity-70">{cat}</label>
              <input
                type="text"
                value={answers[cat] ?? ""}
                onChange={(e) => updateAnswer(cat, e.target.value)}
                disabled={submitted}
                className="flex-1 border-2 border-pink-200 rounded-lg px-3 py-2 outline-none focus:border-pink-400 disabled:opacity-50"
                placeholder={`Con ${letter}...`}
              />
            </div>
          ))}
        </div>

        {!submitted ? (
          <button onClick={doSubmit}
            className="bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-10 rounded-xl text-lg">
            ¡STOP! 🛑
          </button>
        ) : (
          <p className="opacity-50 animate-pulse">Esperando a {oppName}...</p>
        )}
      </main>
    );
  }

  // ── VALIDATING ──
  if (phase === "validating") {
    return (
      <main className="min-h-screen flex flex-col items-center p-6">
        <HeaderBar />
        <p className="text-lg font-bold mb-1">Letra: {letter} — Revisión</p>
        <p className="text-sm opacity-50 mb-1 text-center">
          Marca ❌ las respuestas de {oppName} que creas inválidas
        </p>
        <p className="text-xs opacity-40 mb-4 text-center">
          Si los dos la marcan → 0pts · Si solo uno la marca → 50pts (duda) · Si ninguno → puntos normales
        </p>
        <div className="w-full max-w-md overflow-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-pink-200">
                <th className="pb-2 opacity-60">Categoría</th>
                <th className="pb-2 text-pink-500">{myName}</th>
                <th className="pb-2 text-blue-500">{oppName}</th>
                <th className="pb-2 text-center">¿Vale?</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => {
                const m = (bothAnswers?.mine[cat] ?? "").trim();
                const t = (bothAnswers?.theirs[cat] ?? "").trim();
                const flagged = myInvalidOpp.includes(cat);
                return (
                  <tr key={cat} className="border-b border-gray-100">
                    <td className="py-2 opacity-60">{cat}</td>
                    <td className="py-2 font-medium">{m || "—"}</td>
                    <td className={`py-2 font-medium ${flagged ? "line-through opacity-40 text-red-400" : ""}`}>
                      {t || "—"}
                    </td>
                    <td className="py-2 text-center">
                      {t ? (
                        <button onClick={() => !myValidationSent && toggleInvalidOpp(cat)}
                          className={`text-xl ${myValidationSent ? "opacity-40 cursor-default" : ""}`}>
                          {flagged ? "❌" : "✅"}
                        </button>
                      ) : (
                        <span className="opacity-30">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!myValidationSent ? (
          <button onClick={confirmValidation}
            className="bg-pink-400 hover:bg-pink-500 text-white font-bold py-3 px-8 rounded-xl">
            Confirmar ✓
          </button>
        ) : !theirValidationReceived ? (
          <p className="text-sm animate-pulse opacity-50">Esperando a {oppName}...</p>
        ) : null}
      </main>
    );
  }

  // ── SCORING ──
  return (
    <main className="min-h-screen flex flex-col items-center p-6">
      <HeaderBar />
      <p className="text-lg font-bold mb-1">Letra: {letter}</p>
      <ScoreBar />

      {roundScore && (
        <p className="text-sm mb-3 font-medium">
          Esta ronda: <span className="text-pink-500">+{roundScore.myPts} pts</span> vs <span className="text-blue-500">+{roundScore.oppPts} pts</span>
          {roundScore.disputed.length > 0 && (
            <span className="text-yellow-600 ml-2">· {roundScore.disputed.length} en disputa (50pts c/u)</span>
          )}
        </p>
      )}

      <div className="w-full max-w-md overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-pink-200">
              <th className="pb-2 opacity-60">Categoría</th>
              <th className="pb-2 text-pink-500">{myName}</th>
              <th className="pb-2 text-blue-500">{oppName}</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((cat) => {
              const m = (bothAnswers?.mine[cat] ?? "").trim();
              const t = (bothAnswers?.theirs[cat] ?? "").trim();
              const myFlagged = theirInvalidMe.includes(cat);
              const oppFlagged = myInvalidOpp.includes(cat);
              const bothFlagged = myFlagged && oppFlagged;
              const disputed = (myFlagged && !oppFlagged) || (oppFlagged && !myFlagged);
              const tie = m && t && !bothFlagged && m.toLowerCase() === t.toLowerCase();

              return (
                <tr key={cat} className="border-b border-gray-100">
                  <td className="py-2 opacity-60">{cat}</td>
                  <td className={`py-2 font-medium ${
                    myFlagged && !oppFlagged ? "text-yellow-600" :
                    bothFlagged ? "line-through text-red-400" :
                    tie ? "text-yellow-600" :
                    m ? "text-green-600" : "text-gray-400"
                  }`}>
                    {m || "—"}{myFlagged && !oppFlagged ? " ⚠️" : ""}
                  </td>
                  <td className={`py-2 font-medium ${
                    oppFlagged && !myFlagged ? "text-yellow-600" :
                    bothFlagged ? "line-through text-red-400" :
                    tie ? "text-yellow-600" :
                    t ? "text-green-600" : "text-gray-400"
                  }`}>
                    {t || "—"}{oppFlagged && !myFlagged ? " ⚠️" : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="text-xs opacity-40 mt-2 space-y-0.5">
          <p>✅ Verde = válida · ⚠️ Amarillo = en disputa (50pts) · ~~Tachado~~ = inválida por ambos (0pts)</p>
          <p>Única = 100pts · Igual = 50pts c/u</p>
        </div>
      </div>

      {isHost ? (
        <button onClick={nextRound}
          className="mt-6 bg-pink-400 hover:bg-pink-500 text-white font-bold py-3 px-8 rounded-xl">
          Siguiente ronda →
        </button>
      ) : (
        <p className="mt-6 text-sm animate-pulse opacity-50">Esperando al anfitrión...</p>
      )}
    </main>
  );
}
"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useRoom } from "@/lib/useRoom";
import type { GameEvent } from "@/lib/types";

const CATEGORIES = ["Nombre", "Animal", "Fruta/Verdura", "País", "Color", "Cosa"];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomLetter() {
  return LETTERS[Math.floor(Math.random() * LETTERS.length)];
}

type Answers = Record<string, string>;
type BothAnswers = { mine: Answers; theirs: Answers };

function calcScore(mine: Answers, theirs: Answers, invalidCats: string[] = []): { myPts: number; oppPts: number } {
  let myPts = 0, oppPts = 0;
  for (const cat of CATEGORIES) {
    const m = (mine[cat] ?? "").trim().toLowerCase();
    const t = invalidCats.includes(cat) ? "" : (theirs[cat] ?? "").trim().toLowerCase();
    if (m && t && m === t) { myPts += 50; oppPts += 50; }
    else if (m) myPts += 100;
    else if (t) oppPts += 100;
  }
  return { myPts, oppPts };
}

export default function StopPage() {
  const params = useSearchParams();
  const router = useRouter();
  const code = params.get("code") ?? "";
  const { me, opponent, socket } = useRoom();
  const isHost = me?.isHost ?? false;

  const [phase, setPhase] = useState<"config" | "waiting" | "playing" | "validating" | "scoring">("config");
  const [letter, setLetter] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [bothAnswers, setBothAnswers] = useState<BothAnswers | null>(null);
  const [invalidCats, setInvalidCats] = useState<string[]>([]);
  const [roundScore, setRoundScore] = useState<{ myPts: number; oppPts: number } | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [round, setRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(4);
  const [timeLimit, setTimeLimit] = useState(60);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [stopCountdown, setStopCountdown] = useState<number | null>(null);
  const [iRequested, setIRequested] = useState(false);
  const [theyRequested, setTheyRequested] = useState(false);

  const answersRef = useRef<Answers>({});
  const submittedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { answersRef.current = answers; }, [answers]);

  useEffect(() => {
    const handler = (event: GameEvent) => {
      const { type, payload, _from } = event;

      if (type === "stop:config") {
        const p = payload as { maxRounds: number; timeLimit: number };
        setMaxRounds(p.maxRounds);
        setTimeLimit(p.timeLimit);
        setPhase("waiting");
      }

      if (type === "stop:start") {
        const p = payload as { letter: string; timeLimit: number };
        setLetter(p.letter);
        setAnswers({});
        answersRef.current = {};
        setBothAnswers(null);
        setInvalidCats([]);
        setRoundScore(null);
        setSubmitted(false);
        submittedRef.current = false;
        setStopCountdown(null);
        setPhase("playing");
        setTimeLeft(p.timeLimit);

        if (tickRef.current) clearInterval(tickRef.current);
        tickRef.current = setInterval(() => {
          setTimeLeft(t => {
            if (t <= 1) { if (tickRef.current) clearInterval(tickRef.current); return 0; }
            return t - 1;
          });
        }, 1000);

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => { doSubmit(); }, p.timeLimit * 1000);
      }

      if (type === "stop:submit") {
        const p = payload as { answers: Answers };
        if (_from !== socket.id) {
          setBothAnswers(prev => ({ mine: prev?.mine ?? {}, theirs: p.answers }));

          if (!submittedRef.current) {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (tickRef.current) clearInterval(tickRef.current);

            setStopCountdown(10);
            if (stopTickRef.current) clearInterval(stopTickRef.current);
            stopTickRef.current = setInterval(() => {
              setStopCountdown(c => {
                if (c === null || c <= 1) {
                  if (stopTickRef.current) clearInterval(stopTickRef.current);
                  doSubmit();
                  return null;
                }
                return c - 1;
              });
            }, 1000);
          }
        }
      }

      if (type === "stop:validate") {
        const p = payload as { invalid: string[] };
        setInvalidCats(p.invalid);
        setBothAnswers(prev => {
          if (!prev) return prev;
          const score = calcScore(prev.mine, prev.theirs, p.invalid);
          setMyScore(s => s + score.myPts);
          setOppScore(s => s + score.oppPts);
          setRoundScore(score);
          return prev;
        });
        setPhase("scoring");
      }

      if (type === "stop:next") {
        setPhase("waiting");
        setRound(r => r + 1);
        setBothAnswers(null);
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
          setPhase("config");
        }
      }
    };

    socket.on("game:event", handler);
    return () => {
      socket.off("game:event", handler);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      if (stopTickRef.current) clearInterval(stopTickRef.current);
    };
  }, [socket, router]);

  // When both answers arrive during playing → go to validating
  useEffect(() => {
    if (bothAnswers?.mine !== undefined && bothAnswers?.theirs !== undefined &&
        Object.keys(bothAnswers.mine).length + Object.keys(bothAnswers.theirs).length >= 0 &&
        phase === "playing" && submittedRef.current) {
      if (tickRef.current) clearInterval(tickRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (stopTickRef.current) clearInterval(stopTickRef.current);
      setStopCountdown(null);
      setPhase("validating");
    }
  }, [bothAnswers, phase]);

  function configGame(rounds: number, time: number) {
    setMaxRounds(rounds);
    setTimeLimit(time);
    socket.emit("game:action", { type: "stop:config", payload: { maxRounds: rounds, timeLimit: time } });
    setPhase("waiting");
  }

  function startRound() {
    const l = randomLetter();
    socket.emit("game:action", { type: "stop:start", payload: { letter: l, timeLimit: timeLimit } });
  }

  function doSubmit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    if (tickRef.current) clearInterval(tickRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (stopTickRef.current) clearInterval(stopTickRef.current);
    setStopCountdown(null);
    const myAnswers = answersRef.current;
    setBothAnswers(prev => ({ mine: myAnswers, theirs: prev?.theirs ?? {} }));
    socket.emit("game:action", { type: "stop:submit", payload: { answers: myAnswers } });
  }

  function updateAnswer(cat: string, val: string) {
    const next = { ...answersRef.current, [cat]: val };
    answersRef.current = next;
    setAnswers(next);
  }

  function toggleInvalid(cat: string) {
    setInvalidCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  }

  function confirmValidation() {
    socket.emit("game:action", { type: "stop:validate", payload: { invalid: invalidCats } });
  }

  function nextRound() {
    socket.emit("game:action", { type: "stop:next", payload: {} });
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

  const myName = me?.nickname ?? "Yo";
  const oppName = opponent?.nickname ?? "Ellos";
  const gameOver = round > maxRounds;

  const HeaderBar = () => (
    <div className="flex w-full max-w-md justify-between items-center mb-4">
      <Link href="/" className="text-sm opacity-40 hover:opacity-70">← Inicio</Link>
      <span className="text-sm font-medium opacity-60">🐣 Stop · R {round}/{maxRounds}</span>
      <button onClick={endGame} className="text-sm opacity-40 hover:opacity-70">Salir</button>
    </div>
  );

  const ScoreBar = () => (
    <div className="flex gap-12 text-3xl font-bold mb-6">
      <div className="flex flex-col items-center gap-1">
        <span className="text-pink-500">{myScore}</span>
        <span className="text-xs opacity-50">{myName}</span>
      </div>
      <span className="opacity-30 self-center">–</span>
      <div className="flex flex-col items-center gap-1">
        <span className="text-blue-500">{oppScore}</span>
        <span className="text-xs opacity-50">{oppName}</span>
      </div>
    </div>
  );

  // ── CONFIG ──
  if (phase === "config") {
    if (!isHost) return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-1">🐣 Bachillerato / Stop</h2>
        <p className="text-sm opacity-50 mb-4">Partida: {code}</p>
        <p className="animate-pulse opacity-60">Esperando configuración del anfitrión...</p>
        <Link href="/" className="mt-8 text-sm opacity-40 hover:opacity-70 underline">← Salir</Link>
      </main>
    );
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-1">🐣 Bachillerato / Stop</h2>
        <p className="text-sm opacity-50 mb-8">Partida: {code}</p>
        <p className="font-medium mb-4">¿Cuántas rondas?</p>
        <div className="flex gap-3 mb-6">
          {[4, 6, 8].map(n => (
            <button key={n} onClick={() => setMaxRounds(n)}
              className={`font-bold py-3 px-6 rounded-xl text-lg border-2 transition-all ${
                maxRounds === n ? "bg-pink-400 text-white border-pink-400" : "border-gray-200 hover:border-pink-300"
              }`}>{n}</button>
          ))}
        </div>
        <p className="font-medium mb-4">Tiempo por ronda:</p>
        <div className="flex gap-3 mb-8">
          {[30, 60, 90].map(s => (
            <button key={s} onClick={() => setTimeLimit(s)}
              className={`font-bold py-3 px-6 rounded-xl text-lg border-2 transition-all ${
                timeLimit === s ? "bg-pink-400 text-white border-pink-400" : "border-gray-200 hover:border-pink-300"
              }`}>{s}s</button>
          ))}
        </div>
        <button onClick={() => configGame(maxRounds, timeLimit)}
          className="bg-pink-400 hover:bg-pink-500 text-white font-bold py-3 px-8 rounded-xl">
          ¡Listo!
        </button>
        <Link href="/" className="mt-6 text-sm opacity-40 hover:opacity-70 underline">← Salir</Link>
      </main>
    );
  }

  // ── GAME OVER ──
  if (gameOver) {
    const winner = myScore > oppScore ? myName : myScore < oppScore ? oppName : null;
    const iWon = myScore > oppScore;
    const isTie = myScore === oppScore;
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-4">🐣 Fin del juego</h2>
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

  // ── WAITING ──
  if (phase === "waiting") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <HeaderBar />
        <ScoreBar />
        {isHost ? (
          <button onClick={startRound}
            className="bg-pink-400 hover:bg-pink-500 text-white font-bold py-4 px-10 rounded-xl text-xl">
            🎲 Iniciar ronda
          </button>
        ) : (
          <p className="animate-pulse opacity-60">Esperando al anfitrión...</p>
        )}
      </main>
    );
  }

  // ── PLAYING ──
  if (phase === "playing") {
    return (
      <main className="min-h-screen flex flex-col items-center p-6">
        <HeaderBar />
        <div className="flex items-center gap-4 mb-4">
          <div className="text-6xl font-bold text-pink-500">{letter}</div>
          <div className={`text-2xl font-bold ${timeLeft <= 10 ? "text-red-500 animate-pulse" : "opacity-60"}`}>
            {timeLeft}s
          </div>
        </div>

        {stopCountdown !== null && (
          <div className="bg-orange-100 border-2 border-orange-400 rounded-xl px-6 py-3 mb-4 text-center">
            <p className="font-bold text-orange-600">🛑 {oppName} dijo ¡STOP!</p>
            <p className={`text-2xl font-bold text-orange-500 ${stopCountdown <= 5 ? "animate-pulse" : ""}`}>
              {stopCountdown}s para terminar
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 w-full max-w-sm mb-6">
          {CATEGORIES.map((cat) => (
            <div key={cat} className="flex items-center gap-2">
              <label className="w-32 text-sm font-medium opacity-70">{cat}</label>
              <input
                type="text"
                value={answers[cat] ?? ""}
                onChange={(e) => updateAnswer(cat, e.target.value)}
                disabled={submitted}
                className="flex-1 border-2 border-pink-200 rounded-lg px-3 py-2 outline-none focus:border-pink-400 disabled:opacity-50"
                placeholder={`Con ${letter}...`}
              />
            </div>
          ))}
        </div>

        {!submitted ? (
          <button onClick={doSubmit}
            className="bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-10 rounded-xl text-lg">
            ¡STOP! 🛑
          </button>
        ) : (
          <p className="opacity-50 animate-pulse">Esperando a {oppName}...</p>
        )}
      </main>
    );
  }

  // ── VALIDATING (host only) ──
  if (phase === "validating") {
    if (!isHost) return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <HeaderBar />
        <p className="text-lg font-bold mb-4">Letra: {letter}</p>
        <p className="animate-pulse opacity-60">El anfitrión está revisando las respuestas...</p>
      </main>
    );
    return (
      <main className="min-h-screen flex flex-col items-center p-6">
        <HeaderBar />
        <p className="text-lg font-bold mb-1">Letra: {letter} — Revisión</p>
        <p className="text-sm opacity-50 mb-4">Toca ✅/❌ para validar las respuestas de {oppName}</p>
        <div className="w-full max-w-md overflow-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-pink-200">
                <th className="pb-2 opacity-60">Categoría</th>
                <th className="pb-2 text-pink-500">{myName}</th>
                <th className="pb-2 text-blue-500">{oppName}</th>
                <th className="pb-2 text-center">¿Vale?</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => {
                const m = (bothAnswers?.mine[cat] ?? "").trim();
                const t = (bothAnswers?.theirs[cat] ?? "").trim();
                const isInvalid = invalidCats.includes(cat);
                return (
                  <tr key={cat} className="border-b border-gray-100">
                    <td className="py-2 opacity-60">{cat}</td>
                    <td className="py-2 font-medium">{m || "—"}</td>
                    <td className={`py-2 font-medium ${isInvalid ? "line-through opacity-40 text-red-400" : ""}`}>
                      {t || "—"}
                    </td>
                    <td className="py-2 text-center">
                      {t ? (
                        <button onClick={() => toggleInvalid(cat)} className="text-xl">
                          {isInvalid ? "❌" : "✅"}
                        </button>
                      ) : (
                        <span className="opacity-30">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button onClick={confirmValidation}
          className="bg-pink-400 hover:bg-pink-500 text-white font-bold py-3 px-8 rounded-xl">
          Confirmar puntos ✓
        </button>
      </main>
    );
  }

  // ── SCORING ──
  return (
    <main className="min-h-screen flex flex-col items-center p-6">
      <HeaderBar />
      <p className="text-lg font-bold mb-1">Letra: {letter}</p>
      <ScoreBar />

      {roundScore && (
        <p className="text-sm mb-3 font-medium">
          Esta ronda: <span className="text-pink-500">+{roundScore.myPts} pts</span> vs <span className="text-blue-500">+{roundScore.oppPts} pts</span>
        </p>
      )}

      <div className="w-full max-w-md overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-pink-200">
              <th className="pb-2 opacity-60">Categoría</th>
              <th className="pb-2 text-pink-500">{myName}</th>
              <th className="pb-2 text-blue-500">{oppName}</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((cat) => {
              const m = (bothAnswers?.mine[cat] ?? "").trim();
              const t = (bothAnswers?.theirs[cat] ?? "").trim();
              const tInvalid = invalidCats.includes(cat);
              const tie = m && t && !tInvalid && m.toLowerCase() === t.toLowerCase();
              return (
                <tr key={cat} className="border-b border-gray-100">
                  <td className="py-2 opacity-60">{cat}</td>
                  <td className={`py-2 font-medium ${tie ? "text-yellow-600" : m ? "text-green-600" : "text-gray-400"}`}>
                    {m || "—"}
                  </td>
                  <td className={`py-2 font-medium ${tInvalid ? "line-through text-red-400" : tie ? "text-yellow-600" : t ? "text-green-600" : "text-gray-400"}`}>
                    {t || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs opacity-40 mt-2">Misma = 50pts c/u · Única = 100pts · Tachado = inválida (0pts)</p>
      </div>

      {isHost ? (
        <button onClick={nextRound}
          className="mt-6 bg-pink-400 hover:bg-pink-500 text-white font-bold py-3 px-8 rounded-xl">
          Siguiente ronda →
        </button>
      ) : (
        <p className="mt-6 text-sm animate-pulse opacity-50">Esperando al anfitrión...</p>
      )}
    </main>
  );
}
"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useRoom } from "@/lib/useRoom";
import type { GameEvent } from "@/lib/types";

const CATEGORIES = ["Nombre", "Animal", "Fruta/Verdura", "País", "Color", "Cosa"];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomLetter() {
  return LETTERS[Math.floor(Math.random() * LETTERS.length)];
}

type Answers = Record<string, string>;
type BothAnswers = { mine: Answers; theirs: Answers };

function calcScore(mine: Answers, theirs: Answers): { myPts: number; oppPts: number } {
  let myPts = 0, oppPts = 0;
  for (const cat of CATEGORIES) {
    const m = (mine[cat] ?? "").trim().toLowerCase();
    const t = (theirs[cat] ?? "").trim().toLowerCase();
    if (m && t && m === t) { myPts += 50; oppPts += 50; }
    else if (m) myPts += 100;
    else if (t) oppPts += 100;
  }
  return { myPts, oppPts };
}

export default function StopPage() {
  const params = useSearchParams();
  const router = useRouter();
  const code = params.get("code") ?? "";
  const { me, opponent, socket } = useRoom();
  const isHost = me?.isHost ?? false;

  const [phase, setPhase] = useState<"config" | "waiting" | "playing" | "scoring">("config");
  const [letter, setLetter] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [bothAnswers, setBothAnswers] = useState<BothAnswers | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [round, setRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(4);
  const [timeLimit, setTimeLimit] = useState(60);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [iRequested, setIRequested] = useState(false);
  const [theyRequested, setTheyRequested] = useState(false);

  // Refs to avoid stale closures in timer callbacks and event handlers
  const answersRef = useRef<Answers>({});
  const submittedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep answersRef in sync with state
  useEffect(() => { answersRef.current = answers; }, [answers]);

  useEffect(() => {
    const handler = (event: GameEvent) => {
      const { type, payload, _from } = event;

      if (type === "stop:config") {
        const p = payload as { maxRounds: number; timeLimit: number };
        setMaxRounds(p.maxRounds);
        setTimeLimit(p.timeLimit);
        setPhase("waiting");
      }

      if (type === "stop:start") {
        const p = payload as { letter: string; timeLimit: number };
        setLetter(p.letter);
        setAnswers({});
        answersRef.current = {};
        setBothAnswers(null);
        setSubmitted(false);
        submittedRef.current = false;
        setPhase("playing");
        setTimeLeft(p.timeLimit);

        // Start countdown
        if (tickRef.current) clearInterval(tickRef.current);
        tickRef.current = setInterval(() => {
          setTimeLeft(t => {
            if (t <= 1) {
              if (tickRef.current) clearInterval(tickRef.current);
              return 0;
            }
            return t - 1;
          });
        }, 1000);

        // Auto-submit on timer expiry
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          doSubmit();
        }, p.timeLimit * 1000);
      }

      if (type === "stop:submit") {
        // Receive opponent's answers (or my own confirmed submission)
        const p = payload as { answers: Answers };
        if (_from !== socket.id) {
          // Opponent submitted
          setBothAnswers(prev => ({
            mine: prev?.mine ?? {},
            theirs: p.answers,
          }));
        }
      }

      if (type === "stop:reveal") {
        // Both submitted - show scoring
        const p = payload as { submitter1: Answers; submitter2Answers: Answers; _from1: string };
        // just use bothAnswers state
        if (tickRef.current) clearInterval(tickRef.current);
        if (timerRef.current) clearTimeout(timerRef.current);
        setPhase("scoring");
      }

      if (type === "stop:next") {
        setPhase("waiting");
        setRound(r => r + 1);
        setBothAnswers(null);
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
          setPhase("config");
        }
      }
    };

    socket.on("game:event", handler);
    return () => {
      socket.off("game:event", handler);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [socket, router]);

  // Watch bothAnswers to trigger scoring when opponent's arrives
  useEffect(() => {
    if (bothAnswers?.mine && bothAnswers?.theirs && phase === "playing") {
      if (tickRef.current) clearInterval(tickRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
      const { myPts, oppPts } = calcScore(bothAnswers.mine, bothAnswers.theirs);
      setMyScore(s => s + myPts);
      setOppScore(s => s + oppPts);
      setPhase("scoring");
    }
  }, [bothAnswers, phase]);

  function configGame(rounds: number, time: number) {
    setMaxRounds(rounds);
    setTimeLimit(time);
    socket.emit("game:action", { type: "stop:config", payload: { maxRounds: rounds, timeLimit: time } });
    setPhase("waiting");
  }

  function startRound() {
    const l = randomLetter();
    socket.emit("game:action", {
      type: "stop:start",
      payload: { letter: l, timeLimit: timeLimit },
    });
  }

  function doSubmit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    if (tickRef.current) clearInterval(tickRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    const myAnswers = answersRef.current; // always fresh via ref!
    // Store my answers locally
    setBothAnswers(prev => ({ mine: myAnswers, theirs: prev?.theirs ?? {} }));
    socket.emit("game:action", { type: "stop:submit", payload: { answers: myAnswers } });
  }

  function updateAnswer(cat: string, val: string) {
    const next = { ...answersRef.current, [cat]: val };
    answersRef.current = next;
    setAnswers(next);
  }

  function nextRound() {
    socket.emit("game:action", { type: "stop:next", payload: {} });
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

  const myName = me?.nickname ?? "Yo";
  const oppName = opponent?.nickname ?? "Ellos";
  const gameOver = round > maxRounds;

  const HeaderBar = () => (
    <div className="flex w-full max-w-md justify-between items-center mb-4">
      <Link href="/" className="text-sm opacity-40 hover:opacity-70">← Inicio</Link>
      <span className="text-sm font-medium opacity-60">🐣 Stop · R {round}/{maxRounds}</span>
      <button onClick={endGame} className="text-sm opacity-40 hover:opacity-70">Salir</button>
    </div>
  );

  const ScoreBar = () => (
    <div className="flex gap-12 text-3xl font-bold mb-6">
      <div className="flex flex-col items-center gap-1">
        <span className="text-pink-500">{myScore}</span>
        <span className="text-xs opacity-50">{myName}</span>
      </div>
      <span className="opacity-30 self-center">–</span>
      <div className="flex flex-col items-center gap-1">
        <span className="text-blue-500">{oppScore}</span>
        <span className="text-xs opacity-50">{oppName}</span>
      </div>
    </div>
  );

  if (phase === "config") {
    if (!isHost) return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-1">🐣 Bachillerato / Stop</h2>
        <p className="text-sm opacity-50 mb-4">Partida: {code}</p>
        <p className="animate-pulse opacity-60">Esperando configuración del anfitrión...</p>
        <Link href="/" className="mt-8 text-sm opacity-40 hover:opacity-70 underline">← Salir</Link>
      </main>
    );
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-1">🐣 Bachillerato / Stop</h2>
        <p className="text-sm opacity-50 mb-8">Partida: {code}</p>
        <p className="font-medium mb-4">¿Cuántas rondas?</p>
        <div className="flex gap-3 mb-6">
          {[4, 6, 8].map(n => (
            <button key={n} onClick={() => setMaxRounds(n)}
              className={`font-bold py-3 px-6 rounded-xl text-lg border-2 transition-all ${
                maxRounds === n ? "bg-pink-400 text-white border-pink-400" : "border-gray-200 hover:border-pink-300"
              }`}>{n}</button>
          ))}
        </div>
        <p className="font-medium mb-4">Tiempo por ronda:</p>
        <div className="flex gap-3 mb-8">
          {[30, 60, 90].map(s => (
            <button key={s} onClick={() => setTimeLimit(s)}
              className={`font-bold py-3 px-6 rounded-xl text-lg border-2 transition-all ${
                timeLimit === s ? "bg-pink-400 text-white border-pink-400" : "border-gray-200 hover:border-pink-300"
              }`}>{s}s</button>
          ))}
        </div>
        <button onClick={() => configGame(maxRounds, timeLimit)}
          className="bg-pink-400 hover:bg-pink-500 text-white font-bold py-3 px-8 rounded-xl">
          ¡Listo!
        </button>
        <Link href="/" className="mt-6 text-sm opacity-40 hover:opacity-70 underline">← Salir</Link>
      </main>
    );
  }

  if (gameOver) {
    const winner = myScore > oppScore ? myName : myScore < oppScore ? oppName : null;
    const iWon = myScore > oppScore;
    const isTie = myScore === oppScore;
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-4">🐣 Fin del juego</h2>
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

  if (phase === "waiting") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <HeaderBar />
        <ScoreBar />
        <button onClick={startRound}
          className="bg-pink-400 hover:bg-pink-500 text-white font-bold py-4 px-10 rounded-xl text-xl">
          🎲 Iniciar ronda
        </button>
      </main>
    );
  }

  if (phase === "playing") {
    return (
      <main className="min-h-screen flex flex-col items-center p-6">
        <HeaderBar />
        <div className="flex items-center gap-4 mb-4">
          <div className="text-6xl font-bold text-pink-500">{letter}</div>
          <div className={`text-2xl font-bold ${timeLeft <= 10 ? "text-red-500 animate-pulse" : "opacity-60"}`}>
            {timeLeft}s
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-sm mb-6">
          {CATEGORIES.map((cat) => (
            <div key={cat} className="flex items-center gap-2">
              <label className="w-32 text-sm font-medium opacity-70">{cat}</label>
              <input
                type="text"
                value={answers[cat] ?? ""}
                onChange={(e) => updateAnswer(cat, e.target.value)}
                disabled={submitted}
                className="flex-1 border-2 border-pink-200 rounded-lg px-3 py-2 outline-none focus:border-pink-400 disabled:opacity-50"
                placeholder={`Con ${letter}...`}
              />
            </div>
          ))}
        </div>

        {!submitted ? (
          <button onClick={doSubmit}
            className="bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-10 rounded-xl text-lg">
            ¡STOP! 🛑
          </button>
        ) : (
          <p className="opacity-50 animate-pulse">Esperando a {oppName}...</p>
        )}
      </main>
    );
  }

  // Scoring phase
  const score = bothAnswers ? calcScore(bothAnswers.mine, bothAnswers.theirs) : null;
  return (
    <main className="min-h-screen flex flex-col items-center p-6">
      <HeaderBar />
      <p className="text-lg font-bold mb-1">Letra: {letter}</p>
      <ScoreBar />

      {score && (
        <p className="text-sm mb-3 font-medium">
          Esta ronda: <span className="text-pink-500">+{score.myPts} pts</span> vs <span className="text-blue-500">+{score.oppPts} pts</span>
        </p>
      )}

      <div className="w-full max-w-md overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-pink-200">
              <th className="pb-2 opacity-60">Categoría</th>
              <th className="pb-2 text-pink-500">{myName}</th>
              <th className="pb-2 text-blue-500">{oppName}</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((cat) => {
              const m = (bothAnswers?.mine[cat] ?? "").trim();
              const t = (bothAnswers?.theirs[cat] ?? "").trim();
              const tie = m && t && m.toLowerCase() === t.toLowerCase();
              return (
                <tr key={cat} className="border-b border-gray-100">
                  <td className="py-2 opacity-60">{cat}</td>
                  <td className={`py-2 font-medium ${tie ? "text-yellow-600" : m ? "text-green-600" : "text-gray-400"}`}>
                    {m || "—"}
                  </td>
                  <td className={`py-2 font-medium ${tie ? "text-yellow-600" : t ? "text-green-600" : "text-gray-400"}`}>
                    {t || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs opacity-40 mt-2">Misma respuesta = 50pts. Única = 100pts.</p>
      </div>

      {isHost ? (
        <button onClick={nextRound}
          className="mt-6 bg-pink-400 hover:bg-pink-500 text-white font-bold py-3 px-8 rounded-xl">
          Siguiente ronda →
        </button>
      ) : (
        <p className="mt-6 text-sm animate-pulse opacity-50">Esperando al anfitrión...</p>
      )}
    </main>
  );
}
