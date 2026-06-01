/* japp-home.jsx — Home tab with 5 selectable layouts (ctx.homeStyle):
   "focus"    — stat duo + urgent callout + up-next list (baseline)
   "ring"     — paid-vs-due progress ring hero (Copilot-inspired)
   "hero"     — giant total + horizontal "due soon" cards (Cleo-inspired)
   "summary"  — structured summary card + grouped reminders (Quicken-inspired)
   "timeline" — vertical timeline rail of upcoming bills
   All keep Judith's comic speech-bubble header. */

function HomeHeader({ ctx, due, week }) {
  const { persona, asks, subscribed, openAsk, openReminders } = ctx;
  const soon = due.filter((b) => b.dueDays <= 3).length;
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16, marginTop: 4 }}>
      <JudithAvatar persona={persona} size={52} state="idle" />
      <div className="speech-bubble">
        <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>{due.length > 0 ? due.length + (due.length === 1 ? " bill this month" : " bills this month") : "You’re all caught up"}</div>
        <div className="low" style={{ fontSize: 12, marginTop: 2 }}>{due.length > 0 ? (week.length > 0 ? week.length + " due this week — I’ve got it" : "nothing due this week") : "no bills due right now"}</div>
      </div>
      <button className="bell-btn" onClick={openReminders} aria-label="Reminders">
        <Icon name="bell" size={19} />
        {soon > 0 && <span className="bell-badge">{soon}</span>}
      </button>
    </div>
  );
}

function UpNext({ ctx, list, label }) {
  const { openBill, openBillsList, due } = ctx;
  return (
    <React.Fragment>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "18px 0 10px" }}>
        <div className="section-label" style={{ margin: 0 }}>{label || "Up next"}</div>
        <span className="pill" style={{ padding: "4px 11px", fontSize: 12 }} onClick={openBillsList}>See all · {due.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {list.map((b) => (
          <div key={b.id} className="bill-row" onClick={() => openBill(b)}>
            <ProviderLogo provider={b.provider} cat={b.cat} size={38} />
            <div className="meta">
              <div className="p">{b.provider}</div>
              <div className="d"><span className={"dot " + dueClass(b.dueDays)}></span>{b.cat} · {b.dueLabel}</div>
            </div>
            <span className="mono amt" style={{ color: "var(--" + dueClass(b.dueDays) + ")" }}>{peso(b.amount)}</span>
          </div>
        ))}
      </div>
    </React.Fragment>
  );
}

/* ---- A · focus (baseline) ---- */
function HomeFocus({ ctx, due, total, week, weekSum, urgent, preview }) {
  const { openBill, openBillsList } = ctx;
  return (
    <React.Fragment>
      <div className="card" style={{ display: "flex", padding: 0, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ flex: 1.3, padding: "16px 15px" }}>
          <div className="stat-big mono" style={{ fontSize: 27 }}>{peso(total)}</div>
          <div className="low" style={{ fontSize: 12 }}>due this month</div>
        </div>
        <div style={{ width: 1, background: "var(--hair)" }}></div>
        <div style={{ flex: 1, padding: "16px 15px" }}>
          <div className="stat-big mono" style={{ fontSize: 27, color: "var(--near)" }}>{peso(weekSum)}</div>
          <div className="low" style={{ fontSize: 12 }}>due in 7 days</div>
        </div>
      </div>
      {urgent.length > 0 && (
        <div className="card" style={{ borderColor: "color-mix(in oklab, var(--urgent) 45%, transparent)", marginBottom: 14, display: "flex", gap: 13, alignItems: "center", background: "radial-gradient(120% 100% at 0 0, color-mix(in oklab, var(--urgent) 12%, transparent), transparent 60%), linear-gradient(160deg, var(--surface-2), var(--surface-1))" }} onClick={() => openBill(urgent[0])}>
          <ProviderLogo provider={urgent[0].provider} cat={urgent[0].cat} size={40} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: "var(--urgent)", fontWeight: 600 }}>DUE IN {urgent[0].dueDays} {urgent[0].dueDays === 1 ? "DAY" : "DAYS"}</div>
            <div style={{ fontWeight: 600 }}>{urgent[0].provider}</div>
          </div>
          <span className="mono amt">{peso(urgent[0].amount)}</span>
        </div>
      )}
      <UpNext ctx={ctx} list={preview} />
      <button className="btn btn-soft" style={{ marginTop: 12 }} onClick={openBillsList}>See all {due.length} bills</button>
    </React.Fragment>
  );
}

/* ---- B · ring (paid vs due) ---- */
function HomeRing({ ctx, due, total, preview, paidTotal }) {
  const { openBillsList } = ctx;
  const grand = total + paidTotal;
  const frac = grand > 0 ? paidTotal / grand : 0;
  const size = 168, stroke = 14, r = (size - stroke) / 2, C = 2 * Math.PI * r;
  return (
    <React.Fragment>
      <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "22px 16px", marginBottom: 14 }}>
        <div style={{ position: "relative", width: size, height: size }}>
          <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke} strokeLinecap="round"
              strokeDasharray={`${frac * C} ${C}`} style={{ transition: "stroke-dasharray .7s ease", filter: "drop-shadow(0 0 6px color-mix(in oklab,var(--accent) 60%,transparent))" }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div className="low" style={{ fontSize: 11 }}>still due</div>
            <div className="mono" style={{ fontSize: 26, fontWeight: 700 }}>{peso(total)}</div>
            <div className="low" style={{ fontSize: 11 }}>{Math.round(frac * 100)}% handled</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 22, marginTop: 16 }}>
          <div style={{ textAlign: "center" }}>
            <div className="mono" style={{ fontWeight: 600, color: "var(--ok)" }}>{peso(paidTotal)}</div>
            <div className="low" style={{ fontSize: 11 }}>paid so far</div>
          </div>
          <div style={{ width: 1, background: "var(--hair)" }}></div>
          <div style={{ textAlign: "center" }}>
            <div className="mono" style={{ fontWeight: 600 }}>{peso(grand)}</div>
            <div className="low" style={{ fontSize: 11 }}>this month</div>
          </div>
        </div>
      </div>
      <UpNext ctx={ctx} list={preview} />
      <button className="btn btn-soft" style={{ marginTop: 12 }} onClick={openBillsList}>See all {due.length} bills</button>
    </React.Fragment>
  );
}

/* ---- C · hero (big number + due-soon carousel) ---- */
function HomeHero({ ctx, due, total, week, weekSum, urgent }) {
  const { openBill, openBillsList } = ctx;
  const soon = due.slice().sort((a, b) => a.dueDays - b.dueDays).slice(0, 6);
  return (
    <React.Fragment>
      <div style={{ marginBottom: 6 }}>
        <div className="low" style={{ fontSize: 13 }}>Due this month</div>
        <div className="mono" style={{ fontSize: 46, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.05 }}>{peso(total)}</div>
        <div className="low" style={{ fontSize: 13, marginTop: 2 }}>
          <span style={{ color: "var(--near)" }}>{peso(weekSum)}</span> due in the next 7 days
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "20px 0 10px" }}>
        <div className="section-label" style={{ margin: 0 }}>Due soon</div>
        <span className="pill" style={{ padding: "4px 11px", fontSize: 12 }} onClick={openBillsList}>See all · {due.length}</span>
      </div>
      <div style={{ display: "flex", gap: 11, overflowX: "auto", margin: "0 -22px", padding: "0 22px 6px" }} className="hide-scroll">
        {soon.map((b) => (
          <div key={b.id} className="duesoon-card" onClick={() => openBill(b)} style={{ ["--cc"]: "var(--" + dueClass(b.dueDays) + ")" }}>
            <ProviderLogo provider={b.provider} cat={b.cat} size={40} />
            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{b.provider}</div>
              <div className="low" style={{ fontSize: 11 }}>{b.cat}</div>
            </div>
            <div className="mono" style={{ fontSize: 17, fontWeight: 700, marginTop: 8 }}>{peso(b.amount)}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--" + dueClass(b.dueDays) + ")", marginTop: 2 }}>in {b.dueDays}d · {b.dueLabel}</div>
          </div>
        ))}
      </div>
      <button className="btn btn-soft" style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={openBillsList}>
        <Icon name="receipt" size={17} /> All bills
      </button>
    </React.Fragment>
  );
}

/* ---- D · summary (Quicken-style) ---- */
function HomeSummary({ ctx, due, total, paidTotal, urgent, week }) {
  const { openBill } = ctx;
  const grand = total + paidTotal;
  const groups = [
    { label: "Needs you now", items: due.filter((b) => b.dueDays <= 3) },
    { label: "This week", items: due.filter((b) => b.dueDays > 3 && b.dueDays <= 7) },
    { label: "Later this month", items: due.filter((b) => b.dueDays > 7) }
  ].filter((g) => g.items.length);
  return (
    <React.Fragment>
      <div className="card" style={{ marginBottom: 14, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px 4px" }}>
          <div style={{ fontWeight: 600 }}>June summary</div>
          <div className="low" style={{ fontSize: 11 }}>Jun 1 – Jun 30, 2026</div>
        </div>
        <div className="sum-row"><span>Total bills</span><span className="mono" style={{ fontWeight: 600 }}>{peso(grand)}</span></div>
        <div className="sum-row"><span>Paid</span><span className="mono" style={{ fontWeight: 600, color: "var(--ok)", whiteSpace: "nowrap" }}>−{peso(paidTotal)}</span></div>
        <div className="sum-row sum-total"><span>Remaining</span><span className="mono" style={{ fontWeight: 700, color: "var(--accent)" }}>{peso(total)}</span></div>
      </div>
      {groups.map((g) => (
        <div key={g.label}>
          <div className="section-label">{g.label}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {g.items.sort((a, b) => a.dueDays - b.dueDays).map((b) => (
              <div key={b.id} className="bill-row" onClick={() => openBill(b)}>
                <ProviderLogo provider={b.provider} cat={b.cat} size={38} />
                <div className="meta">
                  <div className="p">{b.provider}</div>
                  <div className="d"><span className={"dot " + dueClass(b.dueDays)}></span>{b.cat} · {b.dueLabel}</div>
                </div>
                <span className="mono amt" style={{ color: "var(--" + dueClass(b.dueDays) + ")" }}>{peso(b.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </React.Fragment>
  );
}

/* compact paid-vs-unpaid bar (count + amount) */
function PaidBar({ bills }) {
  const paid = bills.filter((b) => b.status === "paid");
  const unpaid = bills.filter((b) => b.status !== "paid");
  const paidAmt = paid.reduce((s, b) => s + b.amount, 0);
  const unpaidAmt = unpaid.reduce((s, b) => s + b.amount, 0);
  const grand = paidAmt + unpaidAmt;
  const pct = grand > 0 ? Math.round((paidAmt / grand) * 100) : 0;
  return (
    <div className="card" style={{ marginBottom: 14, padding: "14px 15px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Paid this month</span>
        <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--ok)" }}>{pct}%</span>
      </div>
      <div className="paidbar">
        <div className="paidbar-fill" style={{ width: pct + "%" }}></div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 9 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}><span className="dot ok"></span>{paid.length} paid · <span className="mono">{peso(paidAmt)}</span></span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}><span className="dot" style={{ background: "var(--surface-3)", width: 8, height: 8, borderRadius: "50%" }}></span>{unpaid.length} unpaid · <span className="mono">{peso(unpaidAmt)}</span></span>
      </div>
    </div>
  );
}

/* ---- E · timeline (Home) ---- */
function HomeTimeline({ ctx, due, total, weekSum }) {
  const { openBill, openBillsList, bills } = ctx;
  const sorted = due.slice().sort((a, b) => a.dueDays - b.dueDays);
  return (
    <React.Fragment>
      <div className="card" style={{ display: "flex", padding: 0, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ flex: 1.3, padding: "14px 15px" }}>
          <div className="stat-big mono" style={{ fontSize: 24 }}>{peso(total)}</div>
          <div className="low" style={{ fontSize: 12 }}>due this month</div>
        </div>
        <div style={{ width: 1, background: "var(--hair)" }}></div>
        <div style={{ flex: 1, padding: "14px 15px" }}>
          <div className="stat-big mono" style={{ fontSize: 24, color: "var(--near)" }}>{peso(weekSum)}</div>
          <div className="low" style={{ fontSize: 12 }}>next 7 days</div>
        </div>
      </div>
      <PaidBar bills={bills} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "4px 0 12px" }}>
        <div className="section-label" style={{ margin: 0 }}>Your timeline</div>
        <span className="pill" style={{ padding: "4px 11px", fontSize: 12 }} onClick={openBillsList}>See all · {due.length}</span>
      </div>
      <div className="tl-wrap">
        {sorted.map((b) => (
          <div key={b.id} className="tl-item" onClick={() => openBill(b)}>
            <div className="tl-rail">
              <span className="tl-node" style={{ background: "var(--" + dueClass(b.dueDays) + ")", boxShadow: "0 0 10px var(--" + dueClass(b.dueDays) + ")" }}></span>
            </div>
            <div className="tl-date">
              <span className="mono" style={{ fontWeight: 700, fontSize: 15 }}>{b.dueDate}</span>
              <span className="low" style={{ fontSize: 9, textTransform: "uppercase" }}>Jun</span>
            </div>
            <div className="card tl-card">
              <ProviderLogo provider={b.provider} cat={b.cat} size={34} />
              <div className="meta">
                <div className="p">{b.provider}</div>
                <div className="d">{b.cat} · in {b.dueDays}d</div>
              </div>
              <span className="mono amt" style={{ color: "var(--" + dueClass(b.dueDays) + ")" }}>{peso(b.amount)}</span>
            </div>
          </div>
        ))}
      </div>
    </React.Fragment>
  );
}

function HomeTab({ ctx }) {
  const { bills } = ctx;
  const homeStyle = ctx.homeStyle || "focus";
  const due = bills.filter((b) => b.status !== "paid").slice().sort((a, b) => a.dueDays - b.dueDays);
  const total = due.reduce((s, b) => s + b.amount, 0);
  const paidTotal = bills.filter((b) => b.status === "paid").reduce((s, b) => s + b.amount, 0);
  const week = due.filter((b) => b.dueDays <= 7);
  const weekSum = week.reduce((s, b) => s + b.amount, 0);
  const urgent = due.filter((b) => b.dueDays <= 3);
  const preview = due.slice(0, 3);
  const shared = { ctx: { ...ctx, due }, due, total, paidTotal, week, weekSum, urgent, preview };

  return (
    <div className="pagepad view-anim" style={{ paddingBottom: 96 }}>
      <HomeHeader ctx={ctx} due={due} week={week} />
      {homeStyle === "ring" ? <HomeRing {...shared} />
        : homeStyle === "hero" ? <HomeHero {...shared} />
        : homeStyle === "summary" ? <HomeSummary {...shared} />
        : homeStyle === "timeline" ? <HomeTimeline {...shared} />
        : <HomeFocus {...shared} />}
    </div>
  );
}

Object.assign(window, { HomeTab, HomeHeader, HomeFocus, HomeRing, HomeHero, HomeSummary, HomeTimeline });
