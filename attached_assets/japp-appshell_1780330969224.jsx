/* japp-appshell.jsx — the tabbed app as a mountable component for the
   stitched flow. IIFE-scoped (TABS/PacksSheet/seedLearned won't collide).
   persona + theme + visual tweaks come from the master `store`. */
(function () {
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
    const [pick, setPick] = useState("plus");
    const tiers = [
      { id: "plus", price: 99, name: "Judith+", asks: "50 voice asks / month", sub: "Plenty for most months", perks: ["Answers across every bill, card & loan", "Fair-use cap of 10 asks per hour"] },
      { id: "pro", price: 199, name: "Judith Unlimited", asks: "Unlimited voice asks", sub: "Ask away, no counting", perks: ["Everything in Judith+", "No monthly ask limit", "Fair-use cap of 10 asks per hour"], tag: "Best value" }
    ];
    const sel = tiers.find((t) => t.id === pick) || tiers[0];
    return (
      <div style={{ display: "contents" }}>
        <div className="grab"></div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 className="h">Go Judith+</h2>
          <div className="round-btn" onClick={ctx.closeSheet}><Icon name="x" size={16} /></div>
        </div>
        <div className="muted" style={{ fontSize: 14, marginTop: -4 }}>Ask Judith about your money out loud. {ctx.subscribed ? "You’re already subscribed 🎉" : "Pick a plan."}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tiers.map((t) => (
            <div key={t.id} onClick={() => setPick(t.id)} className="card" style={{ cursor: "pointer", padding: 15, borderColor: pick === t.id ? "var(--accent)" : "var(--hair)", boxShadow: pick === t.id ? "0 0 0 1px var(--accent)" : "none", background: pick === t.id ? "radial-gradient(130% 90% at 0 0, color-mix(in oklab, var(--accent) 13%, transparent), transparent 60%), linear-gradient(160deg, var(--surface-2), var(--surface-1))" : undefined }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <span className={"radio" + (pick === t.id ? " on" : "")}></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 16 }}>{t.name}</span>
                    {t.tag && <span className="chip sel" style={{ fontSize: 10, padding: "2px 8px" }}><Icon name="star" size={10} /> {t.tag}</span>}
                  </div>
                  <div className="low" style={{ fontSize: 12.5, marginTop: 2 }}>{t.asks}</div>
                </div>
                <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                  <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>₱{t.price}</div>
                  <div className="low" style={{ fontSize: 10 }}>/mo</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="low" style={{ fontSize: 12, lineHeight: 1.4, padding: "0 2px" }}>Judith only talks about <b style={{ color: "var(--txt-mid)" }}>your bills</b>. Ask her for a {countryFood(ctx)} recipe and she’ll politely send you back to your due dates. 🍲🚫</div>

        {ctx.subscribed ? (
          <button className="btn btn-soft" onClick={ctx.closeSheet}>You’re all set</button>
        ) : (
          <button className="btn btn-primary" onClick={() => ctx.subscribe(sel.id)}>Start {sel.name} · ₱{sel.price}/mo</button>
        )}
      </div>
    );
  }

  function JudithApp({ store }) {
    const savedCountry = (() => { try { const c = localStorage.getItem("judith_country"); return c && COUNTRIES.find((x) => x.code === c); } catch (e) { return null; } })() || store.country || COUNTRIES[0];
    const [tab, setTab] = useState("home");
    const [bills, setBills] = useState(APP_BILLS.map((b) => ({ ...b })));
    const [asks, setAsks] = useState(8);
    const [subscribed, setSubscribed] = useState(false);
    const [tier, setTier] = useState(null); // null | "plus" (50/mo) | "pro" (unlimited)
    const persona = store.persona;
    const setPersona = store.setPersona;
    const theme = store.theme;
    const setTheme = store.setTheme;
    const [voiceId, setVoice] = useState("rachel");
    const [toggles, setToggles] = useState({ reminders: true, widget: true, watch: false, autopay: true });
    const [sheet, setSheet] = useState(null);
    const [toast, setToast] = useState("");
    const [askOpen, setAskOpen] = useState(false);
    const [remindersOpen, setRemindersOpen] = useState(false);
    const [devicesOpen, setDevicesOpen] = useState(false);
    const [billsListOpen, setBillsListOpen] = useState(false);
    const [learnedProviders, setLearned] = useState(seedLearned);

    useEffect(() => { window.__japp = { go: setTab, ask: setAskOpen, reminders: setRemindersOpen, devices: setDevicesOpen, billsList: setBillsListOpen, bill: (b) => setSheet({ type: "bill", data: b }), add: (b) => setSheet({ type: "add", data: b || null }), packs: () => setSheet({ type: "packs" }), closeSheet: () => setSheet(null), sub: (tr) => { setSubscribed(true); setTier(tr || "plus"); } }; });

    const showToast = (m) => { setToast(m); clearTimeout(window.__jt); window.__jt = setTimeout(() => setToast(""), 2200); };
    const closeSheet = () => setSheet(null);

    const ctx = {
      bills, asks, subscribed, tier, persona, voiceId, toggles, tab, theme, country: savedCountry, learnedProviders, calStyle: store.calStyle, homeStyle: store.homeStyle, insightsStyle: store.insightsStyle, scanStyle: store.scanStyle,
      goTab: setTab, setTheme, setPersona, setVoice,
      openAsk: () => setAskOpen(true),
      openReminders: () => setRemindersOpen(true),
      closeReminders: () => setRemindersOpen(false),
      openDevices: () => setDevicesOpen(true),
      openBillsList: () => setBillsListOpen(true),
      closeBillsList: () => setBillsListOpen(false),
      setToggle: (k) => setToggles((s) => ({ ...s, [k]: !s[k] })),
      openBill: (b) => setSheet({ type: "bill", data: b }),
      openAdd: (b) => setSheet({ type: "add", data: b }),
      openPacks: () => setSheet({ type: "packs" }),
      closeSheet,
      addAsks: (n) => setAsks((a) => Math.max(0, a + n)),
      buyAsks: (n) => { setAsks((a) => a + n); closeSheet(); showToast("Added " + n + " asks ✓"); },
      subscribe: (t) => { setSubscribed(true); setTier(t || "plus"); setAsks(t === "pro" ? 999 : 50); closeSheet(); showToast((t === "pro" ? "Judith Unlimited" : "Judith+") + " active — ask away ✓"); },
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
      restart: () => { setBills(APP_BILLS.map((b) => ({ ...b }))); setAsks(8); setSubscribed(false); setTier(null); setLearned(seedLearned()); setToggles({ reminders: true, widget: true, watch: false, autopay: true }); setTab("home"); closeSheet(); }
    };

    const Active = (TABS.find((x) => x.id === tab) || TABS[0]).C;

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

          <div className="tabview">
            <Active ctx={ctx} key={tab} />
          </div>

          {(tab === "home" || tab === "calendar" || tab === "insights") && !askOpen && !billsListOpen && !remindersOpen && (
            <button className="avatar-fab" onClick={() => setAskOpen(true)} aria-label="Ask Judith">
              <JudithAvatar persona={persona} size={58} state="idle" badge={true} />
            </button>
          )}

          <div className={"sheet-screen" + (billsListOpen ? " show" : "")}>
            {billsListOpen && <BillsListScreen ctx={ctx} />}
          </div>

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

          <div className={"ask-overlay" + (remindersOpen ? " show" : "")}>
            {remindersOpen && (
              <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "flex-end", padding: "6px 18px 0" }}>
                  <div className="round-btn" onClick={() => setRemindersOpen(false)}><Icon name="x" size={16} /></div>
                </div>
                <div className="tabview" style={{ flex: 1 }}><RemindersTab ctx={ctx} /></div>
              </div>
            )}
          </div>

          <div className={"ask-overlay" + (devicesOpen ? " show" : "")}>
            {devicesOpen && (
              <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "flex-end", padding: "6px 18px 0" }}>
                  <div className="round-btn" onClick={() => setDevicesOpen(false)}><Icon name="x" size={16} /></div>
                </div>
                <div className="tabview" style={{ flex: 1 }}><DevicesShowcase ctx={ctx} /></div>
              </div>
            )}
          </div>

          {toast && (
            <div style={{ position: "absolute", left: 22, right: 22, bottom: 92, zIndex: 25, background: "var(--surface-3)", border: "1px solid var(--hair)", borderRadius: 14, padding: "12px 15px", textAlign: "center", fontSize: 14, fontWeight: 500, boxShadow: "0 14px 34px -12px rgba(0,0,0,.8)" }} className="bubble-in">{toast}</div>
          )}

          <div className="tabbar">
            {TABS.map((tb) => (
              <button key={tb.id} className={"tab" + (tab === tb.id ? " on" : "")} onClick={() => { setTab(tb.id); }}>
                <Icon name={tb.icon} size={22} />
                <span>{tb.label}</span>
              </button>
            ))}
          </div>

          <div className={"scrim" + (sheet ? " show" : "")} onClick={closeSheet}></div>
          <div className={"sheet" + (sheet ? " show" : "")}>
            {sheet && sheet.type === "bill" && <BillDetailSheet bill={sheet.data} ctx={ctx} />}
            {sheet && sheet.type === "add" && <AddBillSheet editBill={sheet.data} ctx={ctx} />}
            {sheet && sheet.type === "packs" && <PacksSheet ctx={ctx} />}
          </div>

          <div className="homebar"></div>
        </div>
      </div>
    );
  }

  window.JudithApp = JudithApp;
})();
