/* j-screens-d.jsx — Feature→Benefit x3 · Paywall · Home (finale) */

const DLOCAL = {
  askQ: { fil: "“Judith, magkano lahat ng credit card ko sa susunod na buwan?”", en: "“Judith, what’s my total credit card bill next month?”", es: "“Judith, ¿cuánto es el total de mis tarjetas el próximo mes?”" },
  askA: { fil: "“₱8,300 — BPI at BDO, parehong due bago mag-25. Ipaalala ko?”", en: "“₱8,300 across BPI and BDO — both due before the 25th. Want a heads-up?”", es: "“₱8,300 entre BPI y BDO — ambas vencen antes del 25. ¿Te aviso?”" },
  askQ2: { en: "“Judith, which bills are due this week?”" },
  askA2: { en: "“Three — Meralco, PLDT and your condo dues. ₱5,830 total. Want me to remind you the day before each?”" },
  askQ3: { en: "“Judith, I’ve got ₱30,000 left this month — can I afford ₱5,000 for a trip this week?”" },
  askA3: { en: "“You can, but keep it tight — ₱8,800 is due by Friday. After the trip you’d have ₱16,200 to cover the rest. Go, just don’t touch the bill money.”" },
  notifTitle: { fil: "Judith · Paalala", en: "Judith · Reminder", es: "Judith · Recordatorio" },
  notifBody: { fil: "Meralco due in 3 days. Tapusin na natin?", en: "Meralco due in 3 days. Let’s knock it out.", es: "La luz vence en 3 días. Vamos a pagarla." },
  watchNext: { fil: "SUSUNOD", en: "NEXT DUE", es: "PRÓXIMO" },
  hello: { fil: "Kumusta!", en: "Good day!", es: "¡Hola!" },
  dueMonth: { fil: "due ngayong buwan", en: "due this month", es: "este mes" },
  due7: { fil: "due sa loob ng 7 araw", en: "due in 7 days", es: "en 7 días" },
  upcoming: { fil: "Mga paparating", en: "Upcoming", es: "Próximas" },
  askJudith: { fil: "Tanungin si Judith", en: "Ask Judith", es: "Pregunta a Judith" },
  welcomeToast: { fil: "Maligayang pagdating sa Judith", en: "Welcome to Judith", es: "Bienvenido a Judith" },
  restart: { fil: "Ulitin ang demo", en: "Restart demo", es: "Restart demo" }
};

function FeatureShell({ ctx, dotIdx, kicker, title, lede, children }) {
  const { T, next } = ctx;
  return (
    <div style={{display:"contents"}}>
      <div className="scroll center screen-anim" style={{ gap: 0 }}>
        <div className="dots" style={{ marginBottom: 26 }}>
          {[0, 1, 2].map((i) => <i key={i} className={i === dotIdx ? "on" : ""}></i>)}
        </div>
        <div style={{ alignSelf: "stretch", minHeight: 230, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
        <div className="kicker" style={{ marginTop: 30 }}>{kicker}</div>
        <h1 className="title" style={{ textAlign: "center", maxWidth: 290 }}>{title}</h1>
        <p className="lede" style={{ textAlign: "center", maxWidth: 285 }}>{lede}</p>
      </div>
      <div className="cta-bar">
        <button className="btn btn-primary" onClick={next}>{dotIdx === 2 ? (T("finish") || "Enter Judith") : T("continue")}</button>
      </div>
    </div>
  );
}

function ScreenFeature1({ ctx }) {
  const { T, lang } = ctx;
  const L = (o) => o[lang] || o.en;
  return (
    <FeatureShell ctx={ctx} dotIdx={0} kicker="Voice-first" title="Just ask Judith." lede="Ask anything — she totals it across every card and bill, out loud, hands free.">
      <div style={{ display: "flex", flexDirection: "column", gap: 11, width: "100%", alignItems: "center" }}>
        <PersonaAvatar persona={ctx.persona} size={72} state="speaking" mood="warm" />
        <div className="transcript" style={{ alignSelf: "flex-end" }}>{L(DLOCAL.askQ)}</div>
        <div className="judith-line">{L(DLOCAL.askA)}</div>
      </div>
    </FeatureShell>
  );
}

function ScreenFeature2({ ctx }) {
  const { T, lang } = ctx;
  const cur = (ctx.country && ctx.country.cur) || "₱";
  const L = (o) => o[lang] || o.en;
  return (
    <FeatureShell ctx={ctx} dotIdx={1} kicker="Voice-first" title="Ask about anything." lede="Due dates, what’s coming up, what you owe — just talk, she answers.">
      <div style={{ display: "flex", flexDirection: "column", gap: 11, width: "100%", alignItems: "center" }}>
        <PersonaAvatar persona={ctx.persona} size={72} state="speaking" mood="proud" />
        <div className="transcript" style={{ alignSelf: "flex-end" }}>{L(DLOCAL.askQ2)}</div>
        <div className="judith-line">{L(DLOCAL.askA2)}</div>
      </div>
    </FeatureShell>
  );
}

function ScreenFeature3({ ctx }) {
  const { T, lang } = ctx;
  const cur = (ctx.country && ctx.country.cur) || "₱";
  const L = (o) => o[lang] || o.en;
  return (
    <FeatureShell ctx={ctx} dotIdx={2} kicker="Voice-first" title="She does the math." lede="Judith weighs what’s due before you spend — so you decide with the full picture.">
      <div style={{ display: "flex", flexDirection: "column", gap: 11, width: "100%", alignItems: "center" }}>
        <PersonaAvatar persona={ctx.persona} size={72} state="speaking" mood="joy" />
        <div className="transcript" style={{ alignSelf: "flex-end" }}>{L(DLOCAL.askQ3)}</div>
        <div className="judith-line">{L(DLOCAL.askA3)}</div>
      </div>
    </FeatureShell>
  );
}

function ScreenPaywall({ ctx }) {
  const { T, next } = ctx;
  const cur = (ctx.country && ctx.country.cur) || "₱";
  const feats = [T("payF1"), T("payF2"), T("payF3"), T("payF4")];
  return (
    <div style={{display:"contents"}}>
      <div className="scroll screen-anim">
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <Orb size={72} state="idle" />
        </div>
        <h1 className="title" style={{ textAlign: "center" }}>{T("payT")}</h1>
        <div className="price-card" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span className="chip sel" style={{ fontSize: 11, padding: "4px 10px" }}><Icon name="star" size={11} /> {T("bestValue")}</span>
            <div style={{ textAlign: "right" }}>
              <span className="stat-big mono" style={{ fontSize: 34 }}>{cur}79</span>
              <span style={{ color: "var(--txt-low)" }}>{T("per")}</span>
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--hair)", marginTop: 10, paddingTop: 8 }}>
            {feats.map((f, i) => (
              <div className="feat-line" key={i}><span className="tick"><Icon name="check" size={16} /></span>{f}</div>
            ))}
          </div>
        </div>
        <p className="lede" style={{ textAlign: "center", fontSize: 13 }}>{T("payTrial")} <b className="mono" style={{ color: "var(--txt-hi)" }}>{cur}79{T("per")}</b></p>
      </div>
      <div className="cta-bar">
        <button className="btn btn-primary" onClick={next}>{T("payCta")}</button>
        <button className="btn btn-ghost" onClick={next}>{T("skip")}</button>
      </div>
    </div>
  );
}

function ScreenHome({ ctx }) {
  const { T, lang, persona, restart, goId, asks } = ctx;
  const cur = (ctx.country && ctx.country.cur) || "₱";
  const L = (o) => o[lang] || o.en;
  const data = billData(ctx).slice().sort((a, b) => a.dueDays - b.dueDays);
  const total = data.reduce((s, b) => s + b.amount, 0);
  const due7 = data.filter((b) => b.dueDays <= 7);
  const due7sum = due7.reduce((s, b) => s + b.amount, 0);
  const p = PERSONAS.find((x) => x.id === persona) || PERSONAS[0];
  const fmt = (n) => n.toLocaleString("en-US");
  return (
    <div style={{display:"contents"}}>
      <div className="scroll screen-anim">
        <div style={{ display: "flex", gap: 13, alignItems: "center", marginBottom: 16 }}>
          <Orb size={52} state="idle" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: "var(--txt-low)" }}>{L(DLOCAL.hello)}</div>
            <div style={{ fontWeight: 600, fontSize: 17 }}>{pick(p.name, lang)} · Judith</div>
          </div>
          <span className="stack-pill" style={{ cursor: "pointer" }} onClick={() => goId("voicepack")}>
            <Icon name="spark" size={13} /> <b>{asks}</b> asks
          </span>
        </div>

        <div className="card" style={{ display: "flex", padding: 0, overflow: "hidden", marginBottom: 14 }}>
          <div style={{ flex: 1.3, padding: "15px 14px" }}>
            <div className="stat-big mono" style={{ fontSize: 26 }}>{cur}{fmt(total)}</div>
            <div style={{ fontSize: 12, color: "var(--txt-low)" }}>{L(DLOCAL.dueMonth)}</div>
          </div>
          <div style={{ width: 1, background: "var(--hair)" }}></div>
          <div style={{ flex: 1, padding: "15px 14px" }}>
            <div className="stat-big mono" style={{ fontSize: 26, color: "var(--near)" }}>{cur}{fmt(due7sum)}</div>
            <div style={{ fontSize: 12, color: "var(--txt-low)" }}>{L(DLOCAL.due7)}</div>
          </div>
        </div>

        <div style={{ fontSize: 13, color: "var(--txt-mid)", margin: "4px 0 10px", letterSpacing: ".02em" }}>{L(DLOCAL.upcoming)}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {data.map((b, i) => (
            <div key={i} className="row-card" style={{ cursor: "default" }}>
              <span className="ico" style={{ color: "var(--accent)" }}><Icon name={b.icon} size={17} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{b.provider}</div>
                <div style={{ fontSize: 12, color: "var(--txt-low)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span className={"dot " + dueClass(b.dueDays)} style={{ width: 7, height: 7, borderRadius: "50%" }}></span>
                  {b.cat} · {b.dueDays}d
                </div>
              </div>
              <span className="mono" style={{ fontWeight: 600, color: "var(--" + dueClass(b.dueDays) + ")" }}>{cur}{fmt(b.amount)}</span>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <span className="btn-ghost" style={{ cursor: "pointer", fontSize: 13, textDecoration: "underline" }} onClick={restart}>{L(DLOCAL.restart)}</span>
        </div>
      </div>
      <div className="cta-bar" style={{ background: "transparent" }}>
        <button className="btn btn-primary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }} onClick={() => goId("voicepack")}><Icon name="mic" size={19} /> {L(DLOCAL.askJudith)}</button>
      </div>
    </div>
  );
}

function ScreenVoicePack({ ctx }) {
  const { goId, asks, addAsks } = ctx;
  const cur = (ctx.country && ctx.country.cur) || "₱";
  const packs = [
    { price: 49, asks: 15, tag: null },
    { price: 99, asks: 30, tag: "Most popular" }
  ];
  const buy = (p) => { addAsks(p.asks); goId("home"); };
  const lowOnAsks = asks <= 3;
  return (
    <div style={{ display: "contents" }}>
      <div className="scroll screen-anim">
        <div className="kicker"><Icon name="mic" size={13} /> &nbsp;Ask Judith</div>
        <h1 className="title">{lowOnAsks ? "You’re running low on asks" : "Top up your asks"}</h1>
        <p className="lede" style={{ marginBottom: 16 }}>Every question you ask Judith out loud uses one ask. Your bills and reminders stay unlimited.</p>

        <div className="card" style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 18 }}>
          <Orb size={42} state="idle" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: "var(--txt-low)" }}>Current balance</div>
            <div style={{ fontWeight: 600 }}><span className="mono" style={{ color: lowOnAsks ? "var(--near)" : "var(--txt-hi)" }}>{asks}</span> asks left</div>
          </div>
          {lowOnAsks && <span className="dot near"></span>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {packs.map((p, i) => (
            <div key={i} className={p.tag ? "price-card" : "card"} style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 16 }}>
                <div style={{ width: 56, height: 56, flex: "0 0 auto", borderRadius: 15, background: "color-mix(in oklab, var(--accent) 16%, var(--surface-3))", border: "1px solid color-mix(in oklab, var(--accent) 35%, transparent)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
                  <span className="mono" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{p.asks}</span>
                  <span style={{ fontSize: 9, letterSpacing: ".08em", marginTop: 2 }}>ASKS</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: 17, whiteSpace: "nowrap" }}>{p.asks} asks</span>
                    {p.tag && <span className="chip sel" style={{ fontSize: 10, padding: "3px 9px", whiteSpace: "nowrap" }}><Icon name="star" size={10} /> {p.tag}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--txt-low)", marginTop: 3 }}>One-time top-up</div>
                </div>
                <button className="btn btn-primary" style={{ padding: "12px 17px", fontSize: 15, flex: "0 0 auto" }} onClick={() => buy(p)}>{cur}{p.price}</button>
              </div>
            </div>
          ))}
        </div>

        <p className="lede" style={{ textAlign: "center", fontSize: 12, marginTop: 18 }}>One-time top-ups — no subscription. Your Judith plan <b className="mono" style={{ color: "var(--txt-mid)" }}>{cur}199</b> covers all bills &amp; reminders.</p>
      </div>
      <div className="cta-bar" style={{ background: "transparent" }}>
        <button className="btn btn-ghost" onClick={() => goId("home")}>← Back to Judith</button>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenFeature1, ScreenFeature2, ScreenFeature3, ScreenPaywall, ScreenAskPaywall, ScreenHome, ScreenVoicePack });

/* Paywall shown right after the 3 Ask-Judith demos — explains free asks and
   promotes the two subscription tiers (₱99 / 50 asks, ₱199 / unlimited). */
function ScreenAskPaywall({ ctx }) {
  const { next, persona } = ctx;
  const cur = (ctx.country && ctx.country.cur) || "₱";
  const [pick, setPick] = useState("plus");
  const tiers = [
    { id: "plus", name: "Judith+", price: 99, asks: "50 voice asks / month", sub: "Plenty for most months" },
    { id: "pro", name: "Judith Unlimited", price: 199, asks: "Unlimited voice asks", sub: "Ask away, no counting", tag: "Best value" }
  ];
  const sel = tiers.find((t) => t.id === pick) || tiers[0];
  return (
    <div style={{ display: "contents" }}>
      <div className="scroll screen-anim" style={{ textAlign: "center", alignItems: "center" }}>
        <PersonaAvatar persona={persona} size={72} state="speaking" mood="proud" />
        <div className="kicker" style={{ marginTop: 16 }}>Ask Judith</div>
        <h1 className="title" style={{ maxWidth: 300 }}>You’ve got 8 free asks to start</h1>
        <p className="lede" style={{ maxWidth: 290 }}>Try her out on the house. When you’re hooked, go Judith+ for more — she only ever talks about your bills. Ask her for a {countryFood(ctx)} recipe and she’ll politely send you back to your due dates. 🍲🚫</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", marginTop: 20, textAlign: "left" }}>
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
                  <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{cur}{t.price}</div>
                  <div className="low" style={{ fontSize: 10 }}>/mo</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="low" style={{ fontSize: 11, marginTop: 12 }}>Fair-use cap of 10 asks per hour · cancel anytime</div>
      </div>
      <div className="cta-bar">
        <button className="btn btn-primary" onClick={next}>Start {sel.name} · {cur}{sel.price}/mo</button>
        <button className="btn btn-ghost" onClick={next}>Continue with 8 free asks</button>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenAskPaywall });
