/* japp-shell.jsx — tab bar, router, state, sheets, tweaks */

const ACCENTS = ["oklch(0.78 0.15 168)", "oklch(0.74 0.16 295)", "oklch(0.72 0.16 245)"];
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "oklch(0.78 0.15 168)",
  "glow": 100,
  "density": "regular",
  "motion": true
}/*EDITMODE-END*/;

const TABS = [
  { id: "home", icon: "home", label: "Home", C: HomeTab },
  { id: "calendar", icon: "cal", label: "Calendar", C: CalendarTab },
  { id: "insights", icon: "chart", label: "Insights", C: InsightsTab },
  { id: "settings", icon: "gear", label: "Settings", C: SettingsTab }
];

function seedLearned() {
  const m = {};
  APP_BILLS.forEach((b) => { (m[b.cat] = m[b.cat] || []).push(b.provider); });
  return m;
}

function PacksSheet({ ctx }) {
  const packs = [{ price: 49, asks: 15, tag: null }, { price: 99, asks: 30, tag: "Most popular" }];
  return (
    <div style={{ display: "contents" }}>
      <div className="grab"></div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 className="h">Top up your asks</h2>
        <div className="iconbtn" style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--hair)", display: "grid", placeItems: "center", color: "var(--txt-mid)", cursor: "pointer" }} onClick={ctx.closeSheet}><Icon name="x" size={16} /></div>
      </div>
      <div className="muted" style={{ fontSize: 14, marginTop: -4 }}>Each question to Judith uses one ask. Bills & reminders stay unlimited. You have <b className="mono" style={{ color: "var(--txt-hi)" }}>{ctx.asks}</b> left.</div>
      {packs.map((p, i) => (
        <div key={i} className={p.tag ? "card" : "card"} style={{ padding: 0, overflow: "hidden", borderColor: p.tag ? "color-mix(in oklab,var(--accent) 35%,transparent)" : "var(--hair)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 16 }}>
            <div style={{ width: 56, height: 56, flex: "0 0 auto", borderRadius: 15, background: "color-mix(in oklab, var(--accent) 16%, var(--surface-3))", border: "1px solid color-mix(in oklab, var(--accent) 35%, transparent)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
              <span className="mono" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{p.asks}</span>
              <span style={{ fontSize: 9, letterSpacing: ".08em", marginTop: 2 }}>ASKS</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 17, whiteSpace: "nowrap" }}>{p.asks} asks</span>
                {p.tag && <span className="chip sel" style={{ fontSize: 10, padding: "3px 9px", whiteSpace: "nowrap" }}><Icon name="star" size={10} /> {p.tag}</span>}
              </div>
              <div className="low" style={{ fontSize: 12, marginTop: 3 }}>One-time top-up</div>
            </div>
            <button className="btn btn-primary" style={{ width: "auto", padding: "12px 17px", fontSize: 15 }} onClick={() => ctx.buyAsks(p.asks)}>₱{p.price}</button>
          </div>
        </div>
      ))}
      <div className="low" style={{ fontSize: 12, textAlign: "center" }}>One-time top-ups — no subscription.</div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [tab, setTab] = useState("home");
  const [bills, setBills] = useState(APP_BILLS.map((b) => ({ ...b })));
  const [asks, setAsks] = useState(8);
  const [persona, setPersona] = useState("pro");
  const [voiceId, setVoice] = useState("rachel");
  const [toggles, setToggles] = useState({ reminders: true, widget: true, watch: false, autopay: true });
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState("");
  const [askOpen, setAskOpen] = useState(false);
  const [billsListOpen, setBillsListOpen] = useState(false);
  const [learnedProviders, setLearned] = useState(seedLearned);
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem("judith_theme") || "dark"; } catch (e) { return "dark"; }
  });
  const setTheme = (v) => { setThemeState(v); try { localStorage.setItem("judith_theme", v); } catch (e) {} };

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", t.accent);
    document.documentElement.style.setProperty("--glow", String(t.glow / 100));
    document.body.dataset.density = t.density;
    document.body.classList.toggle("reduce-motion", !t.motion);
  }, [t.accent, t.glow, t.density, t.motion]);

  useEffect(() => { document.body.dataset.theme = theme; }, [theme]);

  useEffect(() => { window.__japp = { go: setTab, ask: setAskOpen }; });

  const showToast = (m) => { setToast(m); clearTimeout(window.__jt); window.__jt = setTimeout(() => setToast(""), 2200); };
  const closeSheet = () => setSheet(null);

  const ctx = {
    bills, asks, persona, voiceId, toggles, tab, theme, learnedProviders,
    goTab: setTab, setTheme,
    setPersona, setVoice,
    openAsk: () => setAskOpen(true),
    openBillsList: () => setBillsListOpen(true),
    closeBillsList: () => setBillsListOpen(false),
    setToggle: (k) => setToggles((s) => ({ ...s, [k]: !s[k] })),
    openBill: (b) => setSheet({ type: "bill", data: b }),
    openAdd: (b) => setSheet({ type: "add", data: b }),
    openPacks: () => setSheet({ type: "packs" }),
    closeSheet,
    addAsks: (n) => setAsks((a) => Math.max(0, a + n)),
    buyAsks: (n) => { setAsks((a) => a + n); closeSheet(); showToast("Added " + n + " asks ✓"); },
    markPaid: (id) => { setBills((bs) => bs.map((b) => b.id === id ? { ...b, status: "paid" } : b)); closeSheet(); showToast("Marked as paid ✓"); },
    markUnpaid: (id) => { setBills((bs) => bs.map((b) => b.id === id ? { ...b, status: "due" } : b)); closeSheet(); showToast("Moved back to due"); },
    snooze: (id) => { setBills((bs) => bs.map((b) => b.id === id ? { ...b, dueDays: b.dueDays + 1 } : b)); closeSheet(); showToast("Snoozed — I'll remind you tomorrow"); },
    saveBill: (nb) => {
      setBills((bs) => bs.some((b) => b.id === nb.id) ? bs.map((b) => b.id === nb.id ? { ...b, ...nb } : b) : [...bs, nb]);
      if (nb.provider) setLearned((m) => {
        const list = (m[nb.cat] || []).slice();
        if (!list.includes(nb.provider)) list.unshift(nb.provider);
        return { ...m, [nb.cat]: list };
      });
      closeSheet(); showToast("Bill saved ✓");
    },
    restart: () => { setBills(APP_BILLS.map((b) => ({ ...b }))); setAsks(8); setPersona("pro"); setLearned(seedLearned()); setToggles({ reminders: true, widget: true, watch: false, autopay: true }); setTab("home"); closeSheet(); }
  };

  const Active = (TABS.find((x) => x.id === tab) || TABS[0]).C;
  const isAsk = false;

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

          <div className="tabview">
            <Active ctx={ctx} key={tab} />
          </div>

          {/* Judith avatar launcher (Home / Calendar / Insights) */}
          {(tab === "home" || tab === "calendar" || tab === "insights") && !askOpen && !billsListOpen && (
            <button className="avatar-fab" onClick={() => setAskOpen(true)} aria-label="Ask Judith">
              <JudithAvatar persona={persona} size={58} state="idle" badge={true} placeholder="" />
            </button>
          )}

          {/* All-bills overlay (from Home “See all”) */}
          <div className={"sheet-screen" + (billsListOpen ? " show" : "")}>
            {billsListOpen && <BillsListScreen ctx={ctx} />}
          </div>

          {/* Ask Judith overlay */}
          <div className={"ask-overlay" + (askOpen ? " show" : "")}>
            {askOpen && (
              <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "flex-end", padding: "6px 18px 0" }}>
                  <div className="round-btn" onClick={() => setAskOpen(false)}><Icon name="x" size={16} /></div>
                </div>
                <AskTab ctx={ctx} />
              </div>
            )}
          </div>

          {/* toast */}
          {toast && (
            <div style={{ position: "absolute", left: 22, right: 22, bottom: 92, zIndex: 25, background: "var(--surface-3)", border: "1px solid var(--hair)", borderRadius: 14, padding: "12px 15px", textAlign: "center", fontSize: 14, fontWeight: 500, boxShadow: "0 14px 34px -12px rgba(0,0,0,.8)" }} className="bubble-in">{toast}</div>
          )}

          {/* tab bar */}
          <div className="tabbar">
            {TABS.map((tb) => (
              <button key={tb.id} className={"tab" + (tab === tb.id ? " on" : "")} onClick={() => { setTab(tb.id); }}>
                <Icon name={tb.icon} size={22} />
                <span>{tb.label}</span>
              </button>
            ))}
          </div>

          {/* sheets */}
          <div className={"scrim" + (sheet ? " show" : "")} onClick={closeSheet}></div>
          <div className={"sheet" + (sheet ? " show" : "")}>
            {sheet && sheet.type === "bill" && <BillDetailSheet bill={sheet.data} ctx={ctx} />}
            {sheet && sheet.type === "add" && <AddBillSheet editBill={sheet.data} ctx={ctx} />}
            {sheet && sheet.type === "packs" && <PacksSheet ctx={ctx} />}
          </div>

          <div className="homebar"></div>
        </div>
      </div>

      <div className="caption">Judith · <b>App</b> — {(TABS.find((x) => x.id === tab) || {}).label} tab &nbsp;·&nbsp; tap Judith to ask</div>

      <TweaksPanel>
        <TweakSection label="Brand accent" />
        <TweakColor label="Electric accent" value={t.accent} options={ACCENTS} onChange={(v) => setTweak("accent", v)} />
        <TweakSlider label="Judith glow" value={t.glow} min={0} max={160} unit="%" onChange={(v) => setTweak("glow", v)} />
        <TweakSection label="Layout & motion" />
        <TweakRadio label="Density" value={t.density} options={["compact", "regular", "comfy"]} onChange={(v) => setTweak("density", v)} />
        <TweakToggle label="Animations" value={t.motion} onChange={(v) => setTweak("motion", v)} />
        <TweakSection label="Jump to tab" />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TABS.map((tb) => (
            <button key={tb.id} onClick={() => setTab(tb.id)} className={"chip" + (tab === tb.id ? " sel" : "")} style={{ fontFamily: "inherit" }}>{tb.label}</button>
          ))}
        </div>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
