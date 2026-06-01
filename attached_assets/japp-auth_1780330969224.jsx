/* japp-auth.jsx — Login / sign-in screen (entry of the stitched flow).
   Two layouts via store.loginLayout: "centered" | "social". */

function AuthScreen({ store, onLogin, onSignup }) {
  const persona = (store && store.persona) || "pro";
  const layout = (store && store.loginLayout) || "centered";
  const [email, setEmail] = useState("");

  const Socials = (
    <div className="auth-socials">
      <button className="auth-social" onClick={onLogin}></button>
      <button className="auth-social" onClick={onLogin}>G</button>
      <button className="auth-social" onClick={onLogin}><Icon name="phone" size={18} /></button>
    </div>
  );

  const Fields = (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 11, textAlign: "left" }}>
      <div className="field">
        <label>Email or mobile</label>
        <input className="search" inputMode="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label>Password</label>
        <input className="search" type="password" placeholder="••••••••" defaultValue="" />
      </div>
      <div style={{ textAlign: "right", marginTop: -2 }}>
        <span className="low" style={{ fontSize: 12, cursor: "pointer" }}>Forgot password?</span>
      </div>
    </div>
  );

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

          {layout === "social" ? (
            <React.Fragment>
              <div className="scroll screen-anim" style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 26 }}>
                  <JudithAvatar persona={persona} size={64} state="idle" />
                  <div>
                    <div className="kicker">Welcome back</div>
                    <h1 className="title" style={{ fontSize: 26 }}>Hi, I’m Judith</h1>
                  </div>
                </div>
                <button className="btn btn-soft" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 9 }} onClick={onLogin}> Continue with Apple</button>
                <button className="btn btn-soft" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }} onClick={onLogin}>G&nbsp;&nbsp;Continue with Google</button>
                <div className="auth-divider"><span>or use email</span></div>
                {Fields}
              </div>
              <div className="cta-bar">
                <button className="btn btn-primary" onClick={onLogin}>Log in</button>
                <div className="auth-foot">New to Judith? <span onClick={onSignup}>Create an account</span></div>
              </div>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <div className="scroll center screen-anim" style={{ textAlign: "center", alignItems: "center" }}>
                <JudithAvatar persona={persona} size={92} state="idle" />
                <div className="kicker" style={{ marginTop: 26 }}>Welcome back</div>
                <h1 className="title" style={{ maxWidth: 280, marginTop: 4 }}>Sign in to Judith</h1>
                <p className="lede" style={{ maxWidth: 270 }}>Your due dates, handled — pick up right where you left off.</p>
                <div style={{ marginTop: 26, width: "100%" }}>{Fields}</div>
              </div>
              <div className="cta-bar">
                <button className="btn btn-primary" onClick={onLogin}>Log in</button>
                <div className="auth-divider"><span>or continue with</span></div>
                {Socials}
                <div className="auth-foot">New to Judith? <span onClick={onSignup}>Create an account</span></div>
              </div>
            </React.Fragment>
          )}

          <div className="homebar"></div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AuthScreen });
