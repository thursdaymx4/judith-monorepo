/* japp-interstitial.jsx — micro-transition screens between onboarding steps.
   - "begin": tap Let's begin → button slides to center → light reveal of next.
     variants: beginStyle = "sweep" | "portal"
   - "word": country-specific greeting with a (placeholder) voice-over.
     variants: wordStyle = "spotlight" | "stamp"
   Voice-over is simulated with an animated waveform; wire to ElevenLabs later
   at the marked TODO (speak CULTURE_WORD[code].say in the chosen voice). */

const CULTURE_WORD = {
  PH: { word: "Mabuhay!", say: "Mabuhay", sub: "Welcome — let’s get you set up." },
  ID: { word: "Selamat datang!", say: "Selamat datang", sub: "Welcome — let’s begin." },
  VN: { word: "Xin chào!", say: "Xin chào", sub: "Hello — let’s begin." },
  MY: { word: "Selamat!", say: "Selamat", sub: "Welcome — let’s begin." },
  TH: { word: "Sawasdee!", say: "Sawasdee", sub: "Welcome — let’s begin." },
  MX: { word: "¡Bienvenida!", say: "Bienvenida", sub: "Welcome — let’s begin." },
  NG: { word: "Welcome!", say: "Welcome", sub: "Let’s get you set up." },
  IN: { word: "Namaste!", say: "Namaste", sub: "Welcome — let’s begin." }
};

function VoiceWave({ on }) {
  return (
    <div className={"vo-wave" + (on ? " on" : "")} aria-hidden="true">
      {Array.from({ length: 7 }).map((_, i) => <i key={i} style={{ animationDelay: (i * 0.09).toFixed(2) + "s" }}></i>)}
    </div>
  );
}

/* ---- the "Let's begin" reveal ---- */
function BeginTransition({ variant, label, onDone, motion }) {
  const [phase, setPhase] = useState("center"); // center -> reveal
  useEffect(() => {
    if (!motion) { const t = setTimeout(onDone, 350); return () => clearTimeout(t); }
    const t1 = setTimeout(() => setPhase("reveal"), 760);
    const t2 = setTimeout(onDone, 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className={"intermission begin-" + variant + " ph-" + phase}>
      {variant === "portal" && <span className="begin-portal"></span>}
      {variant === "sweep" && <span className="begin-sweep"></span>}
      <button className="btn btn-primary begin-btn">{label}</button>
    </div>
  );
}

/* ---- the country greeting word + voice-over ---- */
function WordTransition({ variant, code, onDone, motion }) {
  const cw = CULTURE_WORD[code] || CULTURE_WORD.PH;
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (!motion) { const t = setTimeout(onDone, 500); return () => clearTimeout(t); }
    /* TODO: ElevenLabs — speak cw.say in the chosen voice here */
    const t0 = setTimeout(() => setSpeaking(true), 360);
    const t1 = setTimeout(() => setSpeaking(false), 1900);
    const t2 = setTimeout(onDone, 2500);
    return () => { [t0, t1, t2].forEach(clearTimeout); };
  }, []);
  return (
    <div className={"intermission word-" + variant}>
      <div className="word-inner">
        <span className="word-flag">{(COUNTRIES.find((c) => c.code === code) || {}).flag}</span>
        <div className="word-big">{cw.word}</div>
        <VoiceWave on={speaking} />
        <div className="word-sub">{cw.sub}</div>
      </div>
    </div>
  );
}

Object.assign(window, { CULTURE_WORD, VoiceWave, BeginTransition, WordTransition });

/* dramatic "failure" transition — red alarm flash + screen shake, then it
   drops away to reveal the next screen. Stages the problem with weight. */
function TearTransition({ onDone, motion }) {
  useEffect(() => {
    try { if (navigator.vibrate) navigator.vibrate([0, 60, 40, 120]); } catch (e) {}
    const t = setTimeout(onDone, motion ? 1250 : 300);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="intermission fault-wrap">
      <div className="fault-flash"></div>
      <div className="fault-bar"></div>
    </div>
  );
}

Object.assign(window, { TearTransition });

/* hopeful turning-point transition — a bright accent bloom rises and washes
   upward into the next (solution) screen. */
function RiseTransition({ onDone, motion }) {
  useEffect(() => {
    try { if (navigator.vibrate) navigator.vibrate(35); } catch (e) {}
    const t = setTimeout(onDone, motion ? 1150 : 280);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="intermission rise-wrap">
      <div className="rise-bloom"></div>
    </div>
  );
}

Object.assign(window, { RiseTransition });

/* question-mark transition — floating "?" rise up, invoking the question. */
function QuestionTransition({ onDone, motion }) {
  useEffect(() => {
    try { if (navigator.vibrate) navigator.vibrate(20); } catch (e) {}
    const t = setTimeout(onDone, motion ? 1250 : 280);
    return () => clearTimeout(t);
  }, []);
  const marks = [];
  for (let i = 0; i < 14; i++) {
    marks.push(<span key={i} className="qm" style={{
      left: (6 + (i * 67) % 88) + "%",
      fontSize: (22 + (i % 4) * 16) + "px",
      animationDelay: (i * 0.08).toFixed(2) + "s",
      animationDuration: (1.1 + (i % 3) * 0.25).toFixed(2) + "s"
    }}>?</span>);
  }
  return <div className="intermission qm-wrap"><div className="qm-veil"></div>{marks}</div>;
}

Object.assign(window, { QuestionTransition });

/* COMMIT — the dramatic turning point. "Start today" zooms to center, then
   flips/morphs to a manifesto card: "You will start taking control today".
   variant: "flip" (3D card flip) | "zoom" (scale + crossfade). */
function CommitTransition({ variant, onDone, motion, cur }) {
  const v = variant || "flip";
  const sym = cur || "₱";
  const [phase, setPhase] = useState("chip"); // chip -> card
  useEffect(() => {
    if (!motion) { const t = setTimeout(onDone, 500); return () => clearTimeout(t); }
    try { if (navigator.vibrate) navigator.vibrate([0, 30, 80, 40]); } catch (e) {}
    const t1 = setTimeout(() => setPhase("card"), 2500);   // hold the box ~2s
    const t2 = setTimeout(onDone, 9400);                    // ~2s extra after "today!" to internalize
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className={"intermission commit-wrap commit-" + v + " ph-" + phase}>
      <div className="commit-stage">
        <div className="commit-box">
          <div className="commit-box-label">Start today</div>
          <span className="ico commit-box-ico" style={{ color: "var(--ok)", borderColor: "color-mix(in oklab,var(--ok) 40%,transparent)" }}><Icon name="check" size={22} /></span>
          <div className="commit-box-amt mono">{sym}0</div>
          <div className="commit-box-sub">in late fees</div>
        </div>
        <div className="commit-card">
          <div className="commit-you">You</div>
          <div className="commit-line">will start taking</div>
          <div className="commit-control">control</div>
          <div className="commit-today">today<span className="commit-uline"></span></div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CommitTransition });
