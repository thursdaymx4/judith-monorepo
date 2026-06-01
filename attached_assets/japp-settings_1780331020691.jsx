/* japp-settings.jsx — Settings tab */

function Toggle({ on, onClick }) {
  return <div className={"toggle" + (on ? " on" : "")} onClick={onClick}><div className="knob"></div></div>;
}

function SettingsTab({ ctx }) {
  const { persona, setPersona, voiceId, setVoice, toggles, setToggle, asks, subscribed, tier, openPacks, theme, setTheme } = ctx;
  const TOGGLE_DEFS = [
    { key: "reminders", icon: "bell", t: "Due-date reminders", s: "Before every bill" },
    { key: "widget", icon: "grid", t: "Home-screen widget", s: "Next due bill at a glance" },
    { key: "watch", icon: "watch", t: "Apple Watch", s: "Glanceable on your wrist" },
    { key: "autopay", icon: "wallet", t: "Payment nudges", s: "Remind me to pay, not autopay" }
  ];

  return (
    <div className="pagepad view-anim" style={{ paddingBottom: 24 }}>
      <h1 className="h" style={{ marginTop: 6, marginBottom: 14 }}>Settings</h1>

      {/* plan */}
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 14, borderColor: "color-mix(in oklab, var(--accent) 30%, transparent)", background: "radial-gradient(130% 90% at 0 0, color-mix(in oklab, var(--accent) 14%, transparent), transparent 60%), linear-gradient(160deg, var(--surface-2), var(--surface-1))" }}>
        <span className="ico" style={{ width: 44, height: 44, color: "var(--accent)", borderColor: "color-mix(in oklab,var(--accent) 40%,transparent)" }}><Icon name="star" size={20} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>Judith Premium</div>
          <div className="low" style={{ fontSize: 12 }}><span className="mono">₱199</span> · Lifetime · Active</div>
        </div>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--ok)" }}><span className="dot ok"></span>Active</span>
      </div>

      {/* asks */}
      <div className="set-row" style={{ borderRadius: "var(--r-md)", marginTop: 12, cursor: "pointer" }} onClick={openPacks}>
        <span className="ico" style={{ color: "var(--accent)" }}><Icon name={subscribed ? "star" : "spark"} size={18} /></span>
        <div className="label"><div className="t">{subscribed ? (tier === "pro" ? "Judith Unlimited" : "Judith+") : "Ask Judith"}</div><div className="s">{subscribed ? (tier === "pro" ? "Unlimited asks · ₱199/mo" : <span><span className="mono">{asks}</span> of 50 asks left · ₱99/mo</span>) : <span><span className="mono">{asks}</span> free asks left</span>}</div></div>
        <span className="pill" style={{ pointerEvents: "none" }}><b>{subscribed ? (tier === "pro" ? "Manage" : "Upgrade") : "Go unlimited"}</b></span>
      </div>

      {/* appearance */}
      <div className="section-label">Appearance</div>
      <div className="theme-switch">
        <button className={theme === "dark" ? "on" : ""} onClick={() => setTheme("dark")}>
          <Icon name="moon" size={17} /> Dark
        </button>
        <button className={theme === "light" ? "on" : ""} onClick={() => setTheme("light")}>
          <Icon name="sun" size={17} /> Light
        </button>
      </div>

      {/* persona */}
      <div className="section-label">Judith's personality</div>
      <div className="set-group">
        {PERSONAS.map((p) => (
          <div key={p.id} className="set-row" style={{ cursor: "pointer" }} onClick={() => setPersona(p.id)}>
            <span className="ico" style={{ color: persona === p.id ? "var(--accent)" : "var(--txt-mid)" }}><Icon name={p.icon} size={17} /></span>
            <div className="label"><div className="t">{pick(p.name, "en")}</div><div className="s">{pick(p.vibe, "en")}</div></div>
            {persona === p.id
              ? <span style={{ color: "var(--accent)" }}><Icon name="check" size={18} /></span>
              : <span style={{ width: 18 }}></span>}
          </div>
        ))}
      </div>

      {/* voice */}
      <div className="section-label">Voice <span className="low" style={{ textTransform: "none", letterSpacing: 0 }}>· powered by ElevenLabs</span></div>
      <div className="set-group">
        {VOICES.map((v) => (
          <div key={v.id} className="set-row" style={{ cursor: "pointer" }} onClick={() => setVoice(v.id)}>
            <span className="ico" style={{ color: voiceId === v.id ? "var(--accent)" : "var(--txt-mid)" }}><Icon name="play" size={15} /></span>
            <div className="label">
              <div className="t">{v.name} {v.tag && <span className="chip sel" style={{ fontSize: 9, padding: "2px 7px", marginLeft: 4 }}>{v.tag}</span>}</div>
              <div className="s">{v.desc}</div>
            </div>
            {voiceId === v.id
              ? <span style={{ color: "var(--accent)" }}><Icon name="check" size={18} /></span>
              : <span style={{ width: 18 }}></span>}
          </div>
        ))}
      </div>
      <div className="low" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.4 }}>Judith always speaks in English, in the voice you choose — even when your bills are local.</div>

      {/* reminders */}
      <div className="section-label">Reminders & devices</div>
      <div className="set-group">
        {TOGGLE_DEFS.map((d) => (
          <div key={d.key} className="set-row">
            <span className="ico" style={{ color: toggles[d.key] ? "var(--accent)" : "var(--txt-mid)" }}><Icon name={d.icon} size={17} /></span>
            <div className="label"><div className="t">{d.t}</div><div className="s">{d.s}</div></div>
            <Toggle on={toggles[d.key]} onClick={() => setToggle(d.key)} />
          </div>
        ))}
      </div>
      <div className="set-row" style={{ borderRadius: "var(--r-md)", marginTop: 9, cursor: "pointer" }} onClick={ctx.openDevices}>
        <span className="ico" style={{ color: "var(--accent)" }}><Icon name="watch" size={17} /></span>
        <div className="label"><div className="t">Preview on your devices</div><div className="s">Widgets &amp; Apple Watch concepts</div></div>
        <Icon name="chev" size={16} />
      </div>

      <div style={{ textAlign: "center", marginTop: 22 }}>
        <div className="low" style={{ fontSize: 12 }}>Judith v1.0 · Made for the Philippines</div>
        <div className="low" style={{ fontSize: 12, marginTop: 6, cursor: "pointer" }} onClick={ctx.restart}>Restart demo</div>
      </div>
    </div>
  );
}

Object.assign(window, { SettingsTab, Toggle });
