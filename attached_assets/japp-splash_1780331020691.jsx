/* japp-splash.jsx — IntroShell: splash + login as ONE mounted screen so
   Judith's avatar NEVER unmounts — she animates from splash-center to the
   login header (no flash, no gap). store.splashStyle picks the splash decor.
   Social login layout retained. */

/* ---- splash decorations (only shown during the splash stage) ---- */
function Confetti() {
  const cols = ["#ff6b9d", "#ffd166", "#06d6a0", "#4d9fff", "#c77dff", "#ff9e6d"];
  const bits = [];
  for (let i = 0; i < 18; i++) {
    const left = Math.round((i * 53) % 100);
    bits.push(
      <span key={i} className="cf" style={{
        left: left + "%",
        background: cols[i % cols.length],
        animationDelay: (i * 0.17 % 2.2).toFixed(2) + "s",
        animationDuration: (2 + (i % 4) * 0.5).toFixed(2) + "s",
        transform: "rotate(" + (i * 40 % 360) + "deg)",
        borderRadius: i % 3 === 0 ? "50%" : "1px"
      }}></span>
    );
  }
  return <div className="cf-wrap" aria-hidden="true">{bits}</div>;
}

function FloatingCards({ variant }) {
  const v = variant || "labels";
  /* international: bill CATEGORIES, not country-specific providers */
  const cats = [
    { icon: "zap", t: "Electricity", color: "oklch(0.74 0.16 60)", cls: "fc1" },
    { icon: "wifi", t: "Internet", color: "oklch(0.70 0.16 292)", cls: "fc2" },
    { icon: "droplet", t: "Water", color: "oklch(0.72 0.13 230)", cls: "fc3" },
    { icon: "spark", t: "Subscriptions", color: "oklch(0.74 0.15 330)", cls: "fc4" }
  ];

  if (v === "icons") {
    return (
      <div className="fc-wrap" aria-hidden="true">
        {cats.map((c) => (
          <div key={c.cls} className={"float-icon " + c.cls} style={{ ["--ic"]: c.color }}>
            <Icon name={c.icon} size={22} />
          </div>
        ))}
      </div>
    );
  }

  if (v === "status") {
    return (
      <div className="fc-wrap" aria-hidden="true">
        {cats.map((c) => (
          <div key={c.cls} className={"float-card " + c.cls}>
            <span className="fc-ico" style={{ ["--ic"]: c.color }}><Icon name={c.icon} size={15} /></span>
            <div style={{ flex: 1, minWidth: 0 }}><div className="fc-title">{c.t}</div></div>
            <span className="fc-chk"><Icon name="check" size={13} /></span>
          </div>
        ))}
      </div>
    );
  }

  /* labels (default) */
  return (
    <div className="fc-wrap" aria-hidden="true">
      {cats.map((c) => (
        <div key={c.cls} className={"float-pill " + c.cls}>
          <span className="fc-ico" style={{ ["--ic"]: c.color }}><Icon name={c.icon} size={15} /></span>
          <span className="fc-title">{c.t}</span>
        </div>
      ))}
    </div>
  );
}

function IntroShell({ store, stage, setStage, onLogin, onSignup }) {
  const persona = (store && store.persona) || "pro";
  const splashStyle = (store && store.splashStyle) || "spotlight";
  const motion = !store || store.motion;
  const isAuth = stage === "auth";

  useEffect(() => {
    if (stage !== "splash") return;
    /* haptic pulse synced to the "Handled." punch-in (~1.9s delay + ~0.5s) */
    let hap;
    if (motion) hap = setTimeout(() => { try { if (navigator.vibrate) navigator.vibrate([0, 45, 30, 90]); } catch (e) {} }, 2350);
    const t = setTimeout(() => setStage("auth"), motion ? 4600 : 1100);
    return () => { clearTimeout(t); if (hap) clearTimeout(hap); };
  }, [stage, motion]);

  const [email, setEmail] = useState("");

  return (
    <div style={{ display: "contents" }}>
      <div className="phone">
        <div className={"screen intro-screen stage-" + stage + " splash-" + splashStyle}
          onClick={stage === "splash" ? () => setStage("auth") : undefined}>
          <div className="statusbar">
            <span>9:41</span>
            <span className="ico-row">
              <span className="bars"><i></i><i></i><i></i><i></i></span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>5G</span>
              <span className="batt"></span>
            </span>
          </div>

          {/* splash decorations */}
          <div className={"intro-deco" + (isAuth ? " gone" : "")}>
            {splashStyle === "spotlight" && <div className="spotlight-rings"><i></i><i></i><i></i></div>}
            {splashStyle === "confetti" && <Confetti />}
            {splashStyle === "bloom" && <React.Fragment><div className="bloom-bg"></div><FloatingCards variant={(store && store.splashCards) || "labels"} /></React.Fragment>}
          </div>

          {/* PERSISTENT Judith — single mount, animates between stages */}
          <div className={"intro-judith" + (isAuth ? " is-auth" : " is-splash")}>
            <JudithAvatar persona={persona} size={132} state={isAuth ? "idle" : "listening"} />
          </div>

          {/* splash wordmark */}
          <div className={"intro-word" + (isAuth ? " gone" : "")}>
            <div className="splash-word">Judith</div>
            <div className="splash-tag">Due Dates, <span className="splash-hl">Handled.</span></div>
          </div>

          {/* login content (fades in on auth) */}
          <div className={"intro-auth" + (isAuth ? " in" : "")}>
            <div className="intro-auth-head">
              <div className="kicker">Welcome</div>
              <h1 className="title" style={{ fontSize: 25 }}>Hi, I’m Judith</h1>
              <p className="lede" style={{ fontSize: 14, marginTop: 6 }}>Your bills &amp; due dates — handled, on time, no stress.</p>
            </div>

            <button className="btn btn-soft auth-apple" onClick={onLogin}>
               &nbsp;Continue with Apple
            </button>
            <button className="btn btn-soft auth-google" onClick={onLogin}>
              <span className="g-badge">G</span> Continue with Google
            </button>

            <div className="auth-divider"><span>or use email</span></div>

            <div className="field">
              <input className="search" inputMode="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <input className="search" type="password" placeholder="Password" defaultValue="" />
            </div>

            <button className="btn btn-primary" style={{ marginTop: 4 }} onClick={onLogin}>Log in</button>
            <div className="auth-foot">New to Judith? <span onClick={onSignup}>Create an account</span></div>
          </div>

          {stage === "splash" && <div className="splash-foot">tap to continue</div>}
          <div className="homebar"></div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { IntroShell, Confetti, FloatingCards });
