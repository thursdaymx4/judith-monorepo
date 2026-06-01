/* japp-flow.jsx — master root for the stitched flow.
   Phases: auth → onboarding → app. Owns the shared tweak store (accent, glow,
   density, motion, persona, theme) so choices carry across phases, applies the
   global visual vars, renders the one Tweaks panel + the single React root. */

const FLOW_ACCENTS = ["oklch(0.78 0.15 168)", "oklch(0.74 0.16 295)", "oklch(0.72 0.16 245)"];
const FLOW_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "oklch(0.78 0.15 168)",
  "glow": 100,
  "density": "regular",
  "motion": true,
  "persona": "pro",
  "theme": "dark",
  "look": "aqua",
  "splashStyle": "bloom",
  "calStyle": "heat",
  "homeStyle": "timeline",
  "insightsStyle": "overview",
  "scanStyle": "confirm",
  "welcomeStyle": "greeting",
  "langStyle": "list",
  "splashCards": "labels",
  "beginStyle": "sweep",
  "wordStyle": "stamp",
  "personaStyle": "ring",
  "lateFeeStyle": "alert",
  "commitStyle": "flip"
}/*EDITMODE-END*/;

const PHASE_LABELS = { splash: "Splash", auth: "Login", onboarding: "Onboarding", app: "App" };

function JudithRoot() {
  const [t, setTweak] = useTweaks(FLOW_DEFAULTS);
  const [phase, setPhaseState] = useState(() => {
    try { return localStorage.getItem("judith_phase") || "splash"; } catch (e) { return "splash"; }
  });
  const setPhase = (p) => { setPhaseState(p); try { localStorage.setItem("judith_phase", p); } catch (e) {} };

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", t.accent);
    document.documentElement.style.setProperty("--glow", String(t.glow / 100));
    document.body.dataset.density = t.density;
    document.body.dataset.theme = t.theme;
    document.body.classList.toggle("reduce-motion", !t.motion);
    window.__judithLook = t.look;
  }, [t.accent, t.glow, t.density, t.motion, t.theme, t.look]);

  useEffect(() => { window.__flow = { go: setPhase }; });

  const store = {
    accent: t.accent, glow: t.glow, density: t.density, motion: t.motion,
    persona: t.persona, setPersona: (p) => setTweak("persona", p),
    theme: t.theme, setTheme: (v) => setTweak("theme", v),
    splashStyle: t.splashStyle, calStyle: t.calStyle, homeStyle: t.homeStyle, insightsStyle: t.insightsStyle, scanStyle: t.scanStyle, welcomeStyle: t.welcomeStyle, langStyle: t.langStyle, splashCards: t.splashCards, beginStyle: t.beginStyle, wordStyle: t.wordStyle, personaStyle: t.personaStyle, lateFeeStyle: t.lateFeeStyle, commitStyle: t.commitStyle
  };

  const inIntro = phase === "splash" || phase === "auth";

  return (
    <div style={{ display: "contents" }}>
      {inIntro ? (
        <IntroShell store={store} stage={phase} setStage={setPhase}
          onLogin={() => setPhase("app")} onSignup={() => setPhase("onboarding")} />
      ) : (
        <div key={phase} className="phase-anim">
          {phase === "onboarding" && <OnboardingFlow store={store} onDone={() => setPhase("app")} />}
          {phase === "app" && <JudithApp store={store} />}
        </div>
      )}

      <div className="caption">Judith · <b>Full flow</b> — {PHASE_LABELS[phase]} &nbsp;·&nbsp; login → onboarding → app</div>

      <TweaksPanel>
        <TweakSection label="Flow" />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["splash", "auth", "onboarding", "app"].map((p) => (
            <button key={p} onClick={() => setPhase(p)} className={"chip" + (phase === p ? " sel" : "")} style={{ fontFamily: "inherit" }}>{PHASE_LABELS[p]}</button>
          ))}
        </div>

        <TweakSection label="Brand accent" />
        <TweakColor label="Electric accent" value={t.accent} options={FLOW_ACCENTS} onChange={(v) => setTweak("accent", v)} />
        <TweakSlider label="Judith glow" value={t.glow} min={0} max={160} unit="%" onChange={(v) => setTweak("glow", v)} />

        <TweakSection label="Judith’s persona" />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PERSONAS.map((p) => (
            <button key={p.id} onClick={() => setTweak("persona", p.id)} className={"chip" + (t.persona === p.id ? " sel" : "")} style={{ fontFamily: "inherit" }}>{pick(p.name, "en")}</button>
          ))}
        </div>

        <TweakSection label="Judith’s avatar" />
        <TweakSelect label="Look" value={t.look}
          options={["warm", "classic", "bright", "orchid", "aqua", "modern", "inked", "blossom", "bold", "cool", "minimal"]}
          onChange={(v) => setTweak("look", v)} />

        <TweakSection label="Splash screen" />
        <TweakSelect label="Style" value={t.splashStyle}
          options={["bloom", "spotlight", "confetti"]}
          onChange={(v) => setTweak("splashStyle", v)} />
        <TweakSelect label="Bloom cards" value={t.splashCards}
          options={["labels", "icons", "status"]}
          onChange={(v) => setTweak("splashCards", v)} />

        <TweakSection label="Calendar style" />
        <TweakSelect label="Layout" value={t.calStyle}
          options={["grid", "heat", "rail"]}
          onChange={(v) => setTweak("calStyle", v)} />

        <TweakSection label="Home layout" />
        <TweakSelect label="Style" value={t.homeStyle}
          options={["focus", "ring", "hero", "summary", "timeline"]}
          onChange={(v) => setTweak("homeStyle", v)} />

        <TweakSection label="Insights layout" />
        <TweakSelect label="Style" value={t.insightsStyle}
          options={["overview", "report", "bento"]}
          onChange={(v) => setTweak("insightsStyle", v)} />

        <TweakSection label="Scan a bill" />
        <TweakSelect label="Flow" value={t.scanStyle}
          options={["live", "confirm", "receipt"]}
          onChange={(v) => setTweak("scanStyle", v)} />

        <TweakSection label="Onboarding · Meet Judith" />
        <TweakSelect label="Stance" value={t.welcomeStyle}
          options={["halo", "greeting", "scene"]}
          onChange={(v) => setTweak("welcomeStyle", v)} />

        <TweakSection label="Onboarding · Language" />
        <TweakSelect label="Voice screen" value={t.langStyle}
          options={["list", "hero", "cards"]}
          onChange={(v) => setTweak("langStyle", v)} />

        <TweakSection label="Onboarding · Transitions" />
        <div className="low" style={{ fontSize: 12, padding: "2px 2px 4px" }}>Begin reveal, country greeting &amp; the late-fee hook are locked in.</div>
        <TweakSelect label="Commit moment" value={t.commitStyle}
          options={["flip", "zoom"]}
          onChange={(v) => setTweak("commitStyle", v)} />

        <TweakSection label="Appearance & layout" />
        <TweakRadio label="Theme" value={t.theme} options={["dark", "light"]} onChange={(v) => setTweak("theme", v)} />
        <TweakRadio label="Density" value={t.density} options={["compact", "regular", "comfy"]} onChange={(v) => setTweak("density", v)} />
        <TweakToggle label="Animations" value={t.motion} onChange={(v) => setTweak("motion", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<JudithRoot />);
