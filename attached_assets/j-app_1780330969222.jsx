/* j-app.jsx — router, chrome, tweaks (English-only) */

const ACCENTS = ["oklch(0.78 0.15 168)", "oklch(0.74 0.16 295)", "oklch(0.72 0.16 245)"];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "oklch(0.78 0.15 168)",
  "glow": 100,
  "density": "regular",
  "motion": true,
  "persona": "pro"
}/*EDITMODE-END*/;

const FLOW = [
  { id: "welcome", C: ScreenWelcome },
  { id: "country", C: ScreenCountry },
  { id: "persona", C: ScreenPersona },
  { id: "problem", C: ScreenProblem },
  { id: "intro", C: ScreenIntro },
  { id: "voice", C: ScreenVoiceAdd },
  { id: "congrats", C: ScreenCongrats },
  { id: "personalizing", C: ScreenPersonalizing },
  { id: "summary", C: ScreenSummary },
  { id: "feature1", C: ScreenFeature1 },
  { id: "feature2", C: ScreenFeature2 },
  { id: "feature3", C: ScreenFeature3 },
  { id: "home", C: ScreenHome },
  { id: "voicepack", C: ScreenVoicePack }
];
const SETUP = ["country", "persona", "problem", "intro", "voice", "congrats", "summary"];
const NO_BACK = ["welcome", "personalizing", "home"];
const SKIPPABLE = ["country", "persona"];
const SCREEN_LABELS = {
  welcome: "0 · Welcome", country: "1 · Country", persona: "2 · Persona",
  problem: "3 · Problem", intro: "4 · Intro", voice: "5 · Voice add-bill", congrats: "6 · Congrats",
  personalizing: "7 · Personalizing", summary: "8 · Summary", feature1: "9 · Feature 1",
  feature2: "10 · Feature 2", feature3: "11 · Feature 3", home: "12 · Home", voicepack: "13 · Voice packs"
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [idx, setIdx] = useState(0);
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [bills, setBills] = useState([]);
  const [asks, setAsks] = useState(8);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", t.accent);
    document.documentElement.style.setProperty("--glow", String(t.glow / 100));
    document.body.dataset.density = t.density;
    document.body.classList.toggle("reduce-motion", !t.motion);
  }, [t.accent, t.glow, t.density, t.motion]);

  useEffect(() => { window.__judith = { go: setIdx }; });

  const screen = FLOW[idx];
  const lang = "en";
  const T = makeT("en");

  const next = () => setIdx((i) => Math.min(i + 1, FLOW.length - 1));
  const back = () => setIdx((i) => Math.max(i - 1, 0));
  const goId = (id) => { const n = FLOW.findIndex((f) => f.id === id); if (n >= 0) setIdx(n); };
  const restart = () => { setBills([]); setCountry(COUNTRIES[0]); setAsks(8); setIdx(0); };
  const addBill = (b) => setBills((arr) => [...arr, b]);
  const addAsks = (n) => setAsks((a) => a + n);

  const ctx = {
    T, lang, accent: t.accent, motion: t.motion,
    persona: t.persona, setPersona: (p) => setTweak("persona", p),
    country, setCountry, bills, addBill, asks, addAsks,
    next, back, goId, restart, go: setIdx
  };

  const showProgress = SETUP.includes(screen.id);
  const showBack = !NO_BACK.includes(screen.id);
  const showSkip = SKIPPABLE.includes(screen.id);

  return (
    <div style={{ display: "contents" }}>
      <div className="phone">
        <div className="screen">
          <div className="statusbar">
            <span>9:41</span>
            <span className="ico-row">
              <span className="bars"><i></i><i></i><i></i><i></i></span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>5G</span>
              <span className="batt"></span>
            </span>
          </div>

          <div className="nav">
            {showBack ? <div className="iconbtn" onClick={back}>‹</div> : <div style={{ width: 34 }}></div>}
            {showProgress ? (
              <div className="progress">
                {SETUP.map((s) => {
                  const myPos = SETUP.indexOf(screen.id);
                  const i = SETUP.indexOf(s);
                  return <i key={s} className={i < myPos ? "done" : i === myPos ? "now" : ""}></i>;
                })}
              </div>
            ) : <div style={{ flex: 1 }}></div>}
            {showSkip ? <span className="skip" onClick={next}>{T("skip")}</span> : <div style={{ width: 30 }}></div>}
          </div>

          <screen.C ctx={ctx} key={screen.id + idx} />

          <div className="homebar"></div>
        </div>
      </div>

      <div className="caption">Judith · <b>Onboarding</b> — {SCREEN_LABELS[screen.id]} &nbsp;·&nbsp; voice-first</div>

      <TweaksPanel>
        <TweakSection label="Brand accent" />
        <TweakColor label="Electric accent" value={t.accent} options={ACCENTS} onChange={(v) => setTweak("accent", v)} />
        <TweakSlider label="Orb glow" value={t.glow} min={0} max={160} unit="%" onChange={(v) => setTweak("glow", v)} />

        <TweakSection label="Judith’s persona" />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PERSONAS.map((p) => (
            <button key={p.id} onClick={() => setTweak("persona", p.id)} className={"chip" + (t.persona === p.id ? " sel" : "")}
              style={{ fontFamily: "inherit" }}>{pick(p.name, "en")}</button>
          ))}
        </div>

        <TweakSection label="Layout & motion" />
        <TweakRadio label="Density" value={t.density} options={["compact", "regular", "comfy"]} onChange={(v) => setTweak("density", v)} />
        <TweakToggle label="Animations" value={t.motion} onChange={(v) => setTweak("motion", v)} />

        <TweakSection label="Jump to screen" />
        <select value={screen.id} onChange={(e) => setIdx(FLOW.findIndex((f) => f.id === e.target.value))}
          style={{ width: "100%", padding: "9px 11px", borderRadius: 10, background: "var(--surface-1)", color: "var(--txt-hi)", border: "1px solid var(--hair)", fontFamily: "inherit", fontSize: 14 }}>
          {FLOW.map((f) => <option key={f.id} value={f.id}>{SCREEN_LABELS[f.id]}</option>)}
        </select>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
