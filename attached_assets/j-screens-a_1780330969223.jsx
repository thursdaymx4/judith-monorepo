/* j-screens-a.jsx — Welcome · Country · Language · Persona */

function ScreenWelcome({ ctx }) {
  const { T, next, persona } = ctx;
  const ws = ctx.welcomeStyle || "halo";
  const title = "Your bills, handled — before they’re ever late.";
  const lede = "Judith tracks every due date and reminds you in your own voice, your own language.";

  let hero;
  if (ws === "greeting") {
    hero = (
      <div className="welcome-greeting">
        <JudithAvatar persona={persona} size={88} state="idle" />
        <div className="speech-bubble welcome-bubble">
          <div style={{ fontWeight: 600, fontSize: 15 }}>Hi, I’m Judith!</div>
          <div className="low" style={{ fontSize: 12, marginTop: 2 }}>Let’s get your bills sorted.</div>
        </div>
      </div>
    );
  } else if (ws === "scene") {
    hero = (
      <div className="welcome-scene">
        <span className="ws-chip ws1"><span className="logo-tile" style={{ width: 22, height: 22, borderRadius: 7, background: "#F5821F", fontSize: 10 }}>M</span> <span className="mono">₱3,450</span></span>
        <span className="ws-chip ws2"><span className="logo-tile" style={{ width: 22, height: 22, borderRadius: 7, background: "#C8102E", fontSize: 10 }}>P</span> <span className="mono">₱1,699</span></span>
        <span className="ws-chip ws3"><span className="logo-tile" style={{ width: 22, height: 22, borderRadius: 7, background: "#E50914", fontSize: 10 }}>N</span> <span className="mono">₱549</span></span>
        <JudithAvatar persona={persona} size={124} state="speaking" />
      </div>
    );
  } else {
    hero = (
      <div className="welcome-halo">
        <JudithAvatar persona={persona} size={140} state="listening" />
      </div>
    );
  }

  return (
    <div style={{ display: "contents" }}>
      <div className="scroll center screen-anim" style={{ textAlign: "center", alignItems: "center", gap: 0 }}>
        {hero}
        <div className="kicker" style={{ marginTop: 30 }}>Meet Judith</div>
        <h1 className="title" style={{ maxWidth: 300 }}>{title}</h1>
        <p className="lede" style={{ maxWidth: 290 }}>{lede}</p>
      </div>
      <div className="cta-bar">
        <button className="btn btn-primary" onClick={next}>{T("getstarted")}</button>
      </div>
    </div>
  );
}

function ScreenCountry({ ctx }) {
  const { T, country, setCountry, next } = ctx;
  const [q, setQ] = useState("");
  const list = COUNTRIES.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{display:"contents"}}>
      <div className="scroll screen-anim">
        <div className="kicker"><Icon name="globe" size={13} /> &nbsp;Step 1</div>
        <h1 className="title">{T("countryT")}</h1>
        <p className="lede" style={{ marginBottom: 16 }}>{T("countryL")}</p>
        <input className="search" placeholder={T("countrySearch")} value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 14 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {list.map((c) => (
            <div key={c.code} className={"row-card" + (country && country.code === c.code ? " sel" : "")}
              onClick={() => { setCountry(c); }}>
              <span className="flag">{c.flag}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "var(--txt-low)" }} className="mono">{c.cur} · {c.code}</div>
              </div>
              <div className="check"><Icon name="check" size={13} /></div>
            </div>
          ))}
        </div>
      </div>
      <div className="cta-bar">
        <button className="btn btn-primary" disabled={!country} style={{ opacity: country ? 1 : 0.4 }} onClick={() => country && next()}>{T("continue")}</button>
      </div>
    </div>
  );
}

/* Language = the language Judith SPEAKS reminders in (app UI stays English).
   The play affordance animates her speaking now; wire to ElevenLabs later
   (replace `playSample` body with an ElevenLabs TTS call keyed by lang+voice). */
const VOICE_SAMPLE = {
  en: "Hi, I’m Judith. I’ll remind you before every bill is due.",
  fil: "Uy, si Judith ’to. Paalalahanan kita bago pa ma-due ang bayarin mo.",
  es: "Hola, soy Judith. Te aviso antes de que venza cada factura.",
  id: "Hai, aku Judith. Aku ingatkan sebelum tagihanmu jatuh tempo.",
  vi: "Chào, mình là Judith. Mình nhắc bạn trước khi hoá đơn đến hạn."
};
const VOICE_DESC = { en: "Clear & warm", fil: "Parang kaibigan", es: "Cálida y clara", id: "Hangat & jelas", vi: "Ấm áp & rõ ràng" };

function ScreenLanguage({ ctx }) {
  const { T, next, persona } = ctx;
  const ls = ctx.langStyle || "list";
  const [voiceLang, setVoiceLang] = useState("en");
  const [speaking, setSpeaking] = useState(false);
  const cur = LANGS.find((l) => l.code === voiceLang) || LANGS[1];

  const playSample = (code) => {
    setVoiceLang(code);
    setSpeaking(true);
    clearTimeout(window.__judithSpeak);
    window.__judithSpeak = setTimeout(() => setSpeaking(false), 2800);
    /* TODO: ElevenLabs — speak VOICE_SAMPLE[code] in the chosen voice */
  };

  const Head = (
    <React.Fragment>
      <div className="kicker"><Icon name="mic" size={13} /> &nbsp;Step 2</div>
      <h1 className="title">What language should Judith speak?</h1>
      <p className="lede" style={{ marginBottom: 16 }}>Her reminders, in a language that feels like home. The app itself stays in English.</p>
    </React.Fragment>
  );

  const Transcript = (
    <div className="voice-stage">
      <JudithAvatar persona={persona} size={ls === "hero" ? 132 : 64} state={speaking ? "speaking" : "idle"} />
      <div className={"judith-line bubble-in" + (speaking ? "" : " is-hint")} key={voiceLang + speaking}>
        {speaking ? VOICE_SAMPLE[voiceLang] : "Tap a language to hear me."}
      </div>
    </div>
  );

  /* ---- layout: list (Replika / Meta) ---- */
  if (ls === "list") {
    return (
      <div style={{ display: "contents" }}>
        <div className="scroll screen-anim">
          {Head}
          <div className="voice-stage row" style={{ marginBottom: 14 }}>
            <JudithAvatar persona={persona} size={56} state={speaking ? "speaking" : "idle"} />
            <div className={"judith-line bubble-in" + (speaking ? "" : " is-hint")} key={voiceLang + speaking} style={{ flex: 1 }}>
              {speaking ? VOICE_SAMPLE[voiceLang] : "Tap ▸ to hear me in any language."}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {LANGS.map((l) => {
              const on = voiceLang === l.code;
              return (
                <div key={l.code} className={"row-card" + (on ? " sel" : "")} onClick={() => playSample(l.code)}>
                  <button className={"voice-play" + (on && speaking ? " live" : "")} onClick={(e) => { e.stopPropagation(); playSample(l.code); }}><Icon name={on && speaking ? "spark" : "play"} size={15} /></button>
                  <span className="flag">{l.flag}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{l.native}</div>
                    <div style={{ fontSize: 12, color: "var(--txt-low)" }}>{VOICE_DESC[l.code]}</div>
                  </div>
                  <div className="check"><Icon name="check" size={13} /></div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="cta-bar"><button className="btn btn-primary" onClick={next}>{T("continue")}</button></div>
      </div>
    );
  }

  /* ---- layout: hero (ChatGPT) ---- */
  if (ls === "hero") {
    return (
      <div style={{ display: "contents" }}>
        <div className="scroll center screen-anim" style={{ textAlign: "center", alignItems: "center" }}>
          {Head}
          <div style={{ margin: "8px 0 6px" }}><JudithAvatar persona={persona} size={150} state={speaking ? "speaking" : "idle"} /></div>
          <div style={{ fontWeight: 600, fontSize: 20 }}>{cur.native}</div>
          <div className="low" style={{ fontSize: 13, marginBottom: 4 }}>{VOICE_DESC[voiceLang]}</div>
          <div className={"judith-line bubble-in" + (speaking ? "" : " is-hint")} key={voiceLang + speaking} style={{ maxWidth: 280, margin: "6px auto 0", textAlign: "left" }}>
            {speaking ? VOICE_SAMPLE[voiceLang] : "Tap “Hear Judith” to listen."}
          </div>
          <button className="btn btn-soft" style={{ width: "auto", margin: "16px auto 18px", display: "inline-flex", alignItems: "center", gap: 8 }} onClick={() => playSample(voiceLang)}>
            <Icon name="play" size={16} /> Hear Judith
          </button>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {LANGS.map((l) => (
              <button key={l.code} className={"chip" + (voiceLang === l.code ? " sel" : "")} onClick={() => playSample(l.code)}>{l.flag} {l.label}</button>
            ))}
          </div>
        </div>
        <div className="cta-bar"><button className="btn btn-primary" onClick={next}>{T("continue")}</button></div>
      </div>
    );
  }

  /* ---- layout: cards ---- */
  return (
    <div style={{ display: "contents" }}>
      <div className="scroll screen-anim">
        {Head}
        <div className="voice-stage row" style={{ marginBottom: 14 }}>
          <JudithAvatar persona={persona} size={56} state={speaking ? "speaking" : "idle"} />
          <div className={"judith-line bubble-in" + (speaking ? "" : " is-hint")} key={voiceLang + speaking} style={{ flex: 1 }}>
            {speaking ? VOICE_SAMPLE[voiceLang] : "Pick a language to hear me."}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)" }}>
          {LANGS.map((l) => {
            const on = voiceLang === l.code;
            return (
              <div key={l.code} className={"card voice-card" + (on ? " sel" : "")} onClick={() => playSample(l.code)}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span className="flag" style={{ fontSize: 22 }}>{l.flag}</span>
                  <button className={"voice-play" + (on && speaking ? " live" : "")} onClick={(e) => { e.stopPropagation(); playSample(l.code); }}><Icon name={on && speaking ? "spark" : "play"} size={14} /></button>
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, marginTop: 10 }}>{l.native}</div>
                <div className="low" style={{ fontSize: 11 }}>{VOICE_DESC[l.code]}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="cta-bar"><button className="btn btn-primary" onClick={next}>{T("continue")}</button></div>
    </div>
  );
}

function ScreenPersona({ ctx }) {
  const { T, lang, persona, setPersona, next } = ctx;
  const [speakId, setSpeakId] = useState(null);
  const selected = PERSONAS.find((p) => p.id === persona);

  const playLine = (id) => {
    setPersona(id);
    setSpeakId(id);
    clearTimeout(window.__judithSpeak);
    window.__judithSpeak = setTimeout(() => setSpeakId(null), 2600);
  };

  return (
    <div style={{display:"contents"}}>
      <div className="scroll screen-anim">
        <div className="kicker">Step 3</div>
        <h1 className="title">{T("personaT")}</h1>
        <p className="lede" style={{ marginBottom: 16 }}>{T("personaL")}</p>
        <div className="grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)" }}>
          {PERSONAS.map((p) => {
            const on = persona === p.id;
            return (
              <div key={p.id} className={"card"} onClick={() => playLine(p.id)}
                style={{ cursor: "pointer", padding: 15, display: "flex", flexDirection: "column", gap: 10,
                  borderColor: on ? "color-mix(in oklab, var(--accent) 60%, transparent)" : "var(--hair)",
                  boxShadow: on ? "0 0 0 1px color-mix(in oklab,var(--accent) 35%,transparent), 0 10px 28px -14px color-mix(in oklab,var(--accent) 80%,transparent)" : "none" }}>
                <PersonaAvatar persona={p.id} size={52} state={speakId === p.id ? "speaking" : "idle"} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{pick(p.name, lang)}</div>
                  <div style={{ fontSize: 12, color: "var(--txt-low)", marginTop: 2 }}>{pick(p.vibe, lang)}</div>
                </div>
                <div className="chip" style={{ alignSelf: "flex-start", padding: "6px 11px", fontSize: 12, display: "flex", gap: 6, alignItems: "center", borderColor: on ? "var(--accent)" : "var(--hair)", color: on ? "var(--accent)" : "var(--txt-mid)" }}>
                  <Icon name="mic" size={13} /> {T("play")}
                </div>
              </div>
            );
          })}
        </div>

        {selected && (
          <div className="judith-line bubble-in" key={selected.id + lang} style={{ marginTop: 16, alignSelf: "stretch", maxWidth: "100%" }}>
            {pick(selected.line, lang)}
          </div>
        )}
      </div>
      <div className="cta-bar">
        <button className="btn btn-primary" disabled={!persona} style={{ opacity: persona ? 1 : 0.4 }} onClick={() => persona && next()}>{T("continue")}</button>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenWelcome, ScreenCountry, ScreenLanguage, ScreenPersona });

/* In-between (Step 3 → 4): relatable "late fee" hook, in context with Judith.
   3 variants via ctx.lateFeeStyle: "stat" | "alert" | "promise". */
function ScreenLateFee({ ctx }) {
  const { next, persona } = ctx;
  const s = ctx.lateFeeStyle || "alert";
  const cur = (ctx.country && ctx.country.cur) || "₱";

  if (s === "stat") {
    return (
      <div style={{ display: "contents" }}>
        <div className="scroll center screen-anim" style={{ textAlign: "center", alignItems: "center" }}>
          <PersonaAvatar persona={persona} size={84} state="idle" />
          <div className="lf-stat mono">{cur}2,400</div>
          <div className="low" style={{ fontSize: 13, marginTop: -2 }}>average late fees paid per year*</div>
          <h1 className="title" style={{ maxWidth: 300, marginTop: 18 }}>Missed a bill you fully meant to pay?</h1>
          <p className="lede" style={{ maxWidth: 290 }}>It happens to everyone — one slipped due date and you’re hit with a fee. That’s exactly what I’m here to stop.</p>
        </div>
        <div className="cta-bar">
          <button className="btn btn-primary" onClick={next}>Not anymore — let’s set up</button>
          <div className="low" style={{ fontSize: 10, textAlign: "center", marginTop: 8 }}>*illustrative</div>
        </div>
      </div>
    );
  }

  if (s === "promise") {
    return (
      <div style={{ display: "contents" }}>
        <div className="scroll center screen-anim" style={{ textAlign: "center", alignItems: "center" }}>
          <h1 className="title" style={{ maxWidth: 300, marginTop: 8 }}>Ever paid a late fee you didn’t deserve?</h1>
          <p className="lede" style={{ maxWidth: 280 }}>A bill slips your mind, and suddenly there’s a charge. Be honest:</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, width: "100%", margin: "16px 0 20px" }}>
            <div className="row-card" onClick={next}><span style={{ flex: 1, fontWeight: 500 }}>Yes, more than once 😣</span><Icon name="chev" size={15} /></div>
            <div className="row-card" onClick={next}><span style={{ flex: 1, fontWeight: 500 }}>Once or twice</span><Icon name="chev" size={15} /></div>
            <div className="row-card" onClick={next}><span style={{ flex: 1, fontWeight: 500 }}>Never — and let’s keep it that way</span><Icon name="chev" size={15} /></div>
          </div>
          <div className="voice-stage row" style={{ width: "100%" }}>
            <PersonaAvatar persona={persona} size={56} state="speaking" />
            <div className="judith-line" style={{ flex: 1 }}>Whatever your answer — I’ve got your due dates from here.</div>
          </div>
        </div>
        <div className="cta-bar"><button className="btn btn-primary" onClick={next}>Continue</button></div>
      </div>
    );
  }

  /* alert (default) — mock late-fee notification, persona-tailored headline */
  const MOM_TERM = { PH: "Anak", ID: "Nak", VN: "Con", MY: "Sayang", TH: "Lûk", MX: "Mija", NG: "My dear", IN: "Beta" };
  const term = MOM_TERM[(ctx.country && ctx.country.code)] || "Anak";
  const LF_COPY = {
    pro:   { pre: "Missed a bill — and ", hot: "paid", suf: " for it?" },
    funny: { pre: "Oops — forgot a bill and ", hot: "paid", suf: " the price?" },
    sib:   { pre: "Missed a bill.. ", hot: "again", suf: "?" },
    mama:  { pre: term + ", missed a bill and ", hot: "paid", suf: " extra?" }
  };
  const c = LF_COPY[persona] || LF_COPY.pro;
  return (
    <div style={{ display: "contents" }}>
      <div className="scroll center screen-anim" style={{ textAlign: "center", alignItems: "center" }}>
        <div className="lf-notif">
          <span className="lf-notif-ico"><Icon name="card" size={18} /></span>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Late payment fee</div>
            <div className="low" style={{ fontSize: 11 }}>Posted to your account</div>
          </div>
          <span className="lf-notif-amt mono">−{cur}500</span>
        </div>
        <PersonaAvatar persona={persona} size={84} state="speaking" />
        <h1 className="title" style={{ maxWidth: 300, marginTop: 16 }}>
          {c.pre}<span className="lf-hot">{c.hot}</span>{c.suf}
        </h1>
      </div>
      <div className="cta-bar"><button className="btn btn-primary" onClick={next}>Keep me on time</button></div>
    </div>
  );
}

Object.assign(window, { ScreenLateFee });
