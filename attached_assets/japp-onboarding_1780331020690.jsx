/* japp-onboarding.jsx — onboarding as a mountable component for the stitched
   flow. IIFE-scoped (so its FLOW/App internals don't collide with the app
   shell). Visual tweaks + persona come from the master `store`; the final
   screen hands off via onDone(). */
(function () {
  const FLOW = [
    { id: "welcome", C: ScreenWelcome },
    { id: "country", C: ScreenCountry },
    { id: "language", C: ScreenLanguage },
    { id: "persona", C: ScreenPersona },
    { id: "latefee", C: ScreenLateFee },
    { id: "problem", C: ScreenProblem },
    { id: "stakes", C: ScreenStakes },
    { id: "intro", C: ScreenIntro },
    { id: "voice", C: ScreenVoiceAdd },
    { id: "congrats", C: ScreenCongrats },
    { id: "personalizing", C: ScreenPersonalizing },
    { id: "summary", C: ScreenSummary },
    { id: "feature1", C: ScreenFeature1 },
    { id: "feature2", C: ScreenFeature2 },
    { id: "feature3", C: ScreenFeature3 },
    { id: "askpaywall", C: ScreenAskPaywall }
  ];
  const SETUP = ["country", "language", "persona", "problem", "stakes", "intro", "voice", "congrats", "summary"];
  const NO_BACK = ["welcome", "personalizing"];
  const SKIPPABLE = ["country", "persona"];

  function OnboardingFlow({ store, onDone }) {
    const SAVE_FROM = FLOW.findIndex((f) => f.id === "intro"); // checkpoint: resume here, not restart
    const [idx, setIdx] = useState(() => {
      try { const s = parseInt(localStorage.getItem("judith_onb_idx"), 10); if (s >= SAVE_FROM && s < FLOW.length) return s; } catch (e) {}
      return 0;
    });
    useEffect(() => {
      try { if (idx >= SAVE_FROM) localStorage.setItem("judith_onb_idx", String(idx)); } catch (e) {}
    }, [idx]);
    const [country, setCountryRaw] = useState(COUNTRIES[0]);
    const setCountry = (c) => { setCountryRaw(c); try { localStorage.setItem("judith_country", c.code); } catch (e) {} };
    const [bills, setBills] = useState([]);
    const [asks, setAsks] = useState(8);
    const [trans, setTrans] = useState(null); // {kind, toIdx}

    const screen = FLOW[idx];
    const lang = "en";
    const T = makeT("en");

    const advance = (toIdx) => setIdx(() => { if (toIdx >= FLOW.length) { try { localStorage.removeItem("judith_onb_idx"); } catch (e) {} onDone(); return FLOW.length - 1; } return toIdx; });
    const record = (k, v) => {
      try { const b = JSON.parse(localStorage.getItem("judith_bench") || "{}"); b[k] = v; localStorage.setItem("judith_bench", JSON.stringify(b)); } catch (e) {}
      window.__judithBench = window.__judithBench || {}; window.__judithBench[k] = v;
    };
    const next = () => {
      const cur = FLOW[idx];
      if (cur.id === "welcome") { setTrans({ kind: "begin" }); advance(idx + 1); return; }
      if (cur.id === "country") { setTrans({ kind: "word" }); advance(idx + 1); return; }
      if (cur.id === "persona") { setTrans({ kind: "tear" }); advance(idx + 1); return; }
      if (cur.id === "latefee") { setTrans({ kind: "question" }); advance(idx + 1); return; }
      if (cur.id === "stakes") { setTrans({ kind: "commit" }); advance(idx + 1); return; }
      advance(idx + 1);
    };
    const finishTrans = () => setTrans(null);
    const back = () => setIdx((i) => Math.max(i - 1, 0));
    const goId = (id) => { const n = FLOW.findIndex((f) => f.id === id); if (n >= 0) setIdx(n); };
    useEffect(() => { window.__onb = { go: setIdx, goId, count: FLOW.length, ids: FLOW.map((f) => f.id) }; });
    const restart = () => { try { localStorage.removeItem("judith_onb_idx"); } catch (e) {} setBills([]); setCountry(COUNTRIES[0]); setAsks(8); setIdx(0); };
    const addBill = (b) => setBills((arr) => [...arr, b]);
    const addAsks = (n) => setAsks((a) => a + n);

    const ctx = {
      T, lang, accent: store.accent, motion: store.motion,
      persona: store.persona, setPersona: store.setPersona, welcomeStyle: store.welcomeStyle, langStyle: store.langStyle, personaStyle: store.personaStyle, lateFeeStyle: store.lateFeeStyle, commitStyle: store.commitStyle, record,
      country, setCountry, bills, addBill, asks, addAsks,
      next, back, goId, restart, go: setIdx
    };

    const showProgress = SETUP.includes(screen.id);
    const showBack = !NO_BACK.includes(screen.id);
    const showSkip = SKIPPABLE.includes(screen.id);

    return (
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

          {trans && trans.kind === "begin" &&
            <BeginTransition variant={store.beginStyle || "sweep"} label={T("getstarted")} motion={store.motion} onDone={finishTrans} />}
          {trans && trans.kind === "word" &&
            <WordTransition variant={store.wordStyle || "spotlight"} code={country.code} motion={store.motion} onDone={finishTrans} />}
          {trans && trans.kind === "tear" &&
            <TearTransition motion={store.motion} onDone={finishTrans} />}
          {trans && trans.kind === "question" &&
            <QuestionTransition motion={store.motion} onDone={finishTrans} />}
          {trans && trans.kind === "rise" &&
            <RiseTransition motion={store.motion} onDone={finishTrans} />}
          {trans && trans.kind === "commit" &&
            <CommitTransition variant={store.commitStyle || "flip"} cur={country.cur} motion={store.motion} onDone={finishTrans} />}

          <div className="homebar"></div>
        </div>
      </div>
    );
  }

  window.OnboardingFlow = OnboardingFlow;
})();
