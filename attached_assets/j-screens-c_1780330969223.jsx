/* j-screens-c.jsx — Congrats · Personalizing (loader) · Summary */

function billData(ctx) {
  return ctx.bills && ctx.bills.length ? ctx.bills : SAMPLES;
}
window.dueClass = window.dueClass || function (d) { return d <= 3 ? "urgent" : d <= 7 ? "near" : "ok"; };

function ScreenCongrats({ ctx }) {
  const { T, next } = ctx;
  const data = billData(ctx);
  const cur = (ctx.country && ctx.country.cur) || "₱";
  const total = data.reduce((s, b) => s + b.amount, 0);
  return (
    <div style={{display:"contents"}}>
      <div className="scroll center screen-anim" style={{ textAlign: "center", alignItems: "center", gap: 0 }}>
        <PersonaAvatar persona={ctx.persona} size={140} state="idle" mood="joy" />
        <h1 className="title" style={{ marginTop: 30, fontSize: 32 }}>{T("congratsT")}</h1>
        <p className="lede" style={{ maxWidth: 270 }}>{T("congratsL")}</p>
        <div className="card" style={{ marginTop: 22, display: "flex", gap: 0, alignSelf: "stretch", padding: 0, overflow: "hidden" }}>
          <div style={{ flex: 1, padding: "16px 12px" }}>
            <div className="stat-big mono" style={{ fontSize: 30 }}>{data.length}</div>
            <div style={{ fontSize: 12, color: "var(--txt-low)" }}>{T("billsCount")}</div>
          </div>
          <div style={{ width: 1, background: "var(--hair)" }}></div>
          <div style={{ flex: 1.4, padding: "16px 12px" }}>
            <div className="stat-big mono" style={{ fontSize: 30 }}>{cur}{total.toLocaleString("en-US")}</div>
            <div style={{ fontSize: 12, color: "var(--txt-low)" }}>{T("perMonth")}</div>
          </div>
        </div>
      </div>
      <div className="cta-bar">
        <button className="btn btn-primary" onClick={next}>{T("continue")}</button>
      </div>
    </div>
  );
}

function ScreenPersonalizing({ ctx }) {
  const { T, next, motion } = ctx;
  const lines = T("persLines");
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const dur = motion ? 3400 : 900;
    const per = dur / lines.length;
    const li = setInterval(() => setStep((s) => Math.min(s + 1, lines.length - 1)), per);
    const start = Date.now();
    const pi = setInterval(() => setPct(Math.min(100, ((Date.now() - start) / dur) * 100)), 40);
    const done = setTimeout(() => { clearInterval(li); clearInterval(pi); next(); }, dur + 250);
    return () => { clearInterval(li); clearInterval(pi); clearTimeout(done); };
  }, []);
  return (
    <div style={{display:"contents"}}>
      <div className="scroll center screen-anim" style={{ textAlign: "center", alignItems: "center", gap: 0 }}>
        <PersonaAvatar persona={ctx.persona} size={130} state="speaking" mood="warm" />
        <div style={{ marginTop: 34, height: 24 }}>
          <div className="lede" key={step} style={{ margin: 0, fontSize: 16, color: "var(--txt-hi)" }}>{lines[step]}</div>
        </div>
        <div style={{ width: 200, height: 5, borderRadius: 5, background: "var(--surface-3)", marginTop: 22, overflow: "hidden" }}>
          <div style={{ width: pct + "%", height: "100%", background: "var(--accent)", boxShadow: "0 0 12px var(--accent)", transition: "width .1s linear" }}></div>
        </div>
        <div className="mono" style={{ marginTop: 10, fontSize: 13, color: "var(--txt-low)" }}>{Math.round(pct)}%</div>
      </div>
    </div>
  );
}

function ScreenSummary({ ctx }) {
  const { T, next } = ctx;
  const data = billData(ctx);
  const cur = (ctx.country && ctx.country.cur) || "₱";
  const total = data.reduce((s, b) => s + b.amount, 0);
  const maxA = Math.max(...data.map((b) => b.amount));
  const biggest = data.reduce((a, b) => (b.amount > a.amount ? b : a), data[0]);
  const nextDue = data.reduce((a, b) => (b.dueDays < a.dueDays ? b : a), data[0]);
  const catTotals = {};
  data.forEach((b) => { catTotals[b.cat] = (catTotals[b.cat] || 0) + b.amount; });
  const bigCatName = Object.keys(catTotals).reduce((a, b) => (catTotals[b] > catTotals[a] ? b : a), Object.keys(catTotals)[0]);
  const bigCatAmt = catTotals[bigCatName] || 0;
  const bigCatPct = total > 0 ? Math.round((bigCatAmt / total) * 100) : 0;
  const fmt = (n) => n.toLocaleString("en-US");

  return (
    <div style={{display:"contents"}}>
      <div className="scroll screen-anim">
        <div className="kicker"><Icon name="chart" size={13} /> &nbsp;{T("summaryT")}</div>
        <div className="stat-big mono">{cur}{fmt(total)}</div>
        <div style={{ fontSize: 13, color: "var(--txt-low)", marginBottom: 6 }}>{T("perMonth")} · {data.length} {T("billsCount")}</div>

        <div className="card" style={{ marginTop: 14 }}>
          <div className="chart">
            {data.map((b, i) => (
              <div className="bar" key={i}>
                <div className="bv mono">{cur}{(b.amount / 1000).toFixed(b.amount % 1000 === 0 ? 0 : 1)}k</div>
                <div className="fill" style={{ height: Math.max(12, (b.amount / maxA) * 100) + "%", animationDelay: (i * 0.08) + "s", background: b === nextDue ? "linear-gradient(to top, color-mix(in oklab,var(--near) 40%,var(--surface-3)), var(--near))" : undefined }}></div>
                <div className="bl">{b.provider.split(" ")[0]}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 14 }}>
          <div className="insight">
            <span className="ico" style={{ width: 30, height: 30, color: "var(--accent)" }}><Icon name="zap" size={16} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "var(--txt-low)" }}>{T("insBiggest")}</div>
              <div style={{ fontWeight: 600 }}>{biggest.provider}</div>
            </div>
            <span className="mono" style={{ fontWeight: 600 }}>{cur}{fmt(biggest.amount)}</span>
          </div>
          <div className="insight">
            <span className="ico" style={{ width: 30, height: 30, color: "var(--accent)" }}><Icon name="layers" size={16} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "var(--txt-low)" }}>Biggest category</div>
              <div style={{ fontWeight: 600 }}>{bigCatName} · {bigCatPct}%</div>
            </div>
            <span className="mono" style={{ fontWeight: 600 }}>{cur}{fmt(bigCatAmt)}</span>
          </div>
          <div className="insight">
            <span className={"dot " + dueClass(nextDue.dueDays)}></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "var(--txt-low)" }}>{T("insNext")}</div>
              <div style={{ fontWeight: 600 }}>{nextDue.provider}</div>
            </div>
            <span className="mono" style={{ fontWeight: 600, color: "var(--" + dueClass(nextDue.dueDays) + ")" }}>{nextDue.dueDays}d</span>
          </div>
          <div className="insight">
            <span className="ico" style={{ width: 30, height: 30, color: "var(--ok)" }}><Icon name="check" size={16} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "var(--txt-low)" }}>{T("insSaved")}</div>
              <div style={{ fontWeight: 600 }}>~ {cur}450+ / mo</div>
            </div>
            <span className="dot ok"></span>
          </div>
        </div>
      </div>
      <div className="cta-bar">
        <button className="btn btn-primary" onClick={next}>{T("continue")}</button>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenCongrats, ScreenPersonalizing, ScreenSummary, billData, dueClass });
