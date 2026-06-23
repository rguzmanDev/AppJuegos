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
    const errorHandler = () => router.push("/");
    socket.on("error", errorHandler);
    return () => { socket.off("error", errorHandler); };
  }, [socket, router]);

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
          {theyRequested && !iRequested ? (
            <button onClick={acceptRematch}
              className="bg-green-400 text-white font-bold py-3 px-8 rounded-xl hover:bg-green-500">
              🔥 ¡{oppName} quiere revancha! Aceptar
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
