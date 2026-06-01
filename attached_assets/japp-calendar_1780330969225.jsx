/* japp-calendar.jsx — Calendar tab with 3 selectable layouts (ctx.calStyle):
   "grid"  — polished month grid (logos + amount pills, labeled legend)
   "heat"  — calm heatmap dots (color = urgency, size = amount)
   "rail"  — horizontal day rail / week strip + agenda
   Inspired by Monarch, Rocket Money, Cron/Amie. */

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_INDEX = 5;       // June
const YEAR = 2026;
const FIRST_DOW = 1;         // Jun 1 2026 falls on column 1 (Sun-start grid)
const DAYS_IN_MONTH = 30;
const TODAY = 1;
const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const fmtK = (n) => (n >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k" : String(n));

/* ---- shared improved legend ---- */
function CalLegend() {
  const items = [
    { cls: "urgent", label: "Urgent", sub: "≤3 days" },
    { cls: "near", label: "This week", sub: "≤7 days" },
    { cls: "ok", label: "Upcoming", sub: "later" }
  ];
  return (
    <div className="cal-legend2">
      {items.map((it) => (
        <span key={it.cls} className="leg">
          <i className={"dot " + it.cls}></i>
          <b>{it.label}</b>
          <em>{it.sub}</em>
        </span>
      ))}
    </div>
  );
}

/* ---- variant: polished grid ---- */
function CalGrid({ byDay, sel, setSel }) {
  const cells = [];
  for (let i = 0; i < FIRST_DOW; i++) cells.push(null);
  for (let d = 1; d <= DAYS_IN_MONTH; d++) cells.push(d);
  return (
    <div className="card cg-card">
      <div className="cg-grid cg-dow">{DOW.map((d, i) => <div key={i} className="cg-dowcell">{d}</div>)}</div>
      <div className="cg-grid">
        {cells.map((d, i) => {
          if (d == null) return <div key={"e" + i}></div>;
          const items = byDay[d] || [];
          const due = items.filter((b) => b.status !== "paid");
          const paid = items.filter((b) => b.status === "paid");
          const top = due.slice().sort((a, b) => a.dueDays - b.dueDays)[0];
          const cls = top ? dueClass(top.dueDays) : null;
          const isToday = d === TODAY, isSel = d === sel;
          const dayTotal = due.reduce((s, b) => s + b.amount, 0);
          return (
            <button key={d}
              className={"cg-cell" + (due.length ? " has" : "") + (isToday ? " today" : "") + (isSel ? " sel" : "")}
              onClick={() => setSel(isSel ? null : (items.length ? d : null))}
              style={cls ? { ["--cc"]: "var(--" + cls + ")" } : null}>
              <span className="cg-num">{d}</span>
              {due.length > 0 && <ProviderLogo provider={top.provider} cat={top.cat} size={19} />}
              {due.length > 1 && <span className="cg-more">+{due.length - 1}</span>}
              {due.length > 0 && <span className="cg-amt mono">₱{fmtK(dayTotal)}</span>}
              {due.length === 0 && paid.length > 0 && <span className="cg-paid"><Icon name="check" size={9} /></span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---- variant: heatmap dots ---- */
function CalHeat({ byDay, sel, setSel }) {
  const cells = [];
  for (let i = 0; i < FIRST_DOW; i++) cells.push(null);
  for (let d = 1; d <= DAYS_IN_MONTH; d++) cells.push(d);
  let maxDay = 1;
  Object.keys(byDay).forEach((k) => {
    const t = (byDay[k] || []).filter((b) => b.status !== "paid").reduce((s, b) => s + b.amount, 0);
    if (t > maxDay) maxDay = t;
  });
  return (
    <div className="card ch-card">
      <div className="ch-grid ch-dow">{DOW.map((d, i) => <div key={i} className="ch-dowcell">{d}</div>)}</div>
      <div className="ch-grid">
        {cells.map((d, i) => {
          if (d == null) return <div key={"e" + i}></div>;
          const items = byDay[d] || [];
          const due = items.filter((b) => b.status !== "paid");
          const top = due.slice().sort((a, b) => a.dueDays - b.dueDays)[0];
          const cls = top ? dueClass(top.dueDays) : null;
          const isToday = d === TODAY, isSel = d === sel;
          const dayTotal = due.reduce((s, b) => s + b.amount, 0);
          const sz = due.length ? Math.round(13 + (dayTotal / maxDay) * 20) : 0;
          return (
            <button key={d} className={"ch-cell" + (isToday ? " today" : "") + (isSel ? " sel" : "")}
              onClick={() => setSel(isSel ? null : (items.length ? d : null))}>
              {due.length > 0 && (
                <span className="ch-dot" style={{ width: sz, height: sz, background: "var(--" + cls + ")", boxShadow: "0 0 " + Math.round(sz / 2) + "px color-mix(in oklab, var(--" + cls + ") 70%, transparent)" }}></span>
              )}
              <span className={"ch-num" + (due.length ? " on" : "")}>{d}</span>
            </button>
          );
        })}
      </div>
      <div className="ch-scale">
        <span className="low" style={{ fontSize: 10 }}>smaller bill</span>
        <span className="ch-scale-dots"><i style={{ width: 7, height: 7 }}></i><i style={{ width: 11, height: 11 }}></i><i style={{ width: 16, height: 16 }}></i><i style={{ width: 22, height: 22 }}></i></span>
        <span className="low" style={{ fontSize: 10 }}>bigger</span>
      </div>
    </div>
  );
}

/* ---- variant: horizontal day rail ---- */
function CalRail({ byDay, sel, setSel }) {
  const days = Array.from({ length: DAYS_IN_MONTH }, (_, i) => i + 1);
  return (
    <div className="cr-strip">
      {days.map((d) => {
        const items = byDay[d] || [];
        const due = items.filter((b) => b.status !== "paid");
        const top = due.slice().sort((a, b) => a.dueDays - b.dueDays)[0];
        const cls = top ? dueClass(top.dueDays) : null;
        const isToday = d === TODAY, isSel = d === sel;
        const dowLetter = DOW[(FIRST_DOW + d - 1) % 7];
        return (
          <button key={d}
            className={"cr-day" + (due.length ? " has" : "") + (isToday ? " today" : "") + (isSel ? " sel" : "")}
            onClick={() => setSel(isSel ? null : (items.length ? d : null))}
            style={cls ? { ["--cc"]: "var(--" + cls + ")" } : null}>
            <span className="cr-dow">{dowLetter}</span>
            <span className="cr-num mono">{d}</span>
            {due.length > 0
              ? <span className="cr-mark"><ProviderLogo provider={top.provider} cat={top.cat} size={20} />{due.length > 1 && <span className="cr-more">+{due.length - 1}</span>}</span>
              : <span className="cr-mark cr-empty"></span>}
          </button>
        );
      })}
    </div>
  );
}

function CalendarTab({ ctx }) {
  const { bills, openBill, openAdd, persona } = ctx;
  const calStyle = ctx.calStyle || "grid";
  const [sel, setSel] = useState(null);

  const dueBills = bills.filter((b) => b.status !== "paid");
  const byDay = {};
  bills.forEach((b) => { (byDay[b.dueDate] = byDay[b.dueDate] || []).push(b); });

  const monthTotal = dueBills.reduce((s, b) => s + b.amount, 0);
  const agenda = (sel != null ? (byDay[sel] || []) : dueBills.slice().sort((a, b) => a.dueDate - b.dueDate));
  const agendaPaid = sel == null ? bills.filter((b) => b.status === "paid") : [];

  return (
    <div className="pagepad view-anim" style={{ paddingBottom: 96 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, marginBottom: 14 }}>
        <div>
          <h1 className="h">Calendar</h1>
          <div className="low" style={{ fontSize: 12, marginTop: 2 }}>{MONTHS[MONTH_INDEX]} {YEAR}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div className="round-btn"><span style={{ display: "inline-flex", transform: "rotate(180deg)" }}><Icon name="chev" size={15} /></span></div>
          <div className="round-btn"><Icon name="chev" size={15} /></div>
        </div>
      </div>

      {/* month summary */}
      <div className="card cal-summary" style={{ marginBottom: 12 }}>
        <div>
          <div className="low" style={{ fontSize: 12 }}>Due in {MONTHS[MONTH_INDEX]}</div>
          <div className="mono" style={{ fontSize: 24, fontWeight: 600 }}>{peso(monthTotal)}</div>
        </div>
        <div className="cal-summary-right low" style={{ fontSize: 12, textAlign: "right" }}>
          <div><b style={{ color: "var(--txt-hi)" }}>{dueBills.length}</b> bills</div>
          <div><b style={{ color: "var(--near)" }}>{dueBills.filter((b) => b.dueDays <= 7).length}</b> this week</div>
        </div>
      </div>

      <CalLegend />

      {calStyle === "heat" ? <CalHeat byDay={byDay} sel={sel} setSel={setSel} />
        : calStyle === "rail" ? <CalRail byDay={byDay} sel={sel} setSel={setSel} />
        : <CalGrid byDay={byDay} sel={sel} setSel={setSel} />}

      {/* weekly cash-flow (planner) — year-aware ranges */}
      {(() => {
        const dim = new Date(YEAR, MONTH_INDEX + 1, 0).getDate();
        const ranges = [];
        for (let s = 1; s <= dim; s += 7) ranges.push([s, Math.min(s + 6, dim)]);
        const weeks = ranges.map(() => 0);
        dueBills.forEach((b) => { const w = Math.min(ranges.length - 1, Math.floor((b.dueDate - 1) / 7)); weeks[w] += b.amount; });
        const maxW = Math.max(1, ...weeks);
        return (
          <div style={{ marginTop: 14 }}>
            <div className="section-label" style={{ marginTop: 0 }}>Weekly cash flow</div>
            <div className="cf-weeks">
              {weeks.map((w, i) => (
                <div key={i} className="cf-week">
                  <span className="cf-week-amt mono" style={{ color: w > 0 ? "var(--txt-hi)" : "var(--txt-low)" }}>{w > 0 ? "₱" + fmtK(w) : "—"}</span>
                  <div className="cf-week-bar"><div className="cf-week-fill" style={{ height: Math.round((w / maxW) * 100) + "%" }}></div></div>
                  <span className="cf-week-lbl">{ranges[i][0] === ranges[i][1] ? ranges[i][0] : ranges[i][0] + "–" + ranges[i][1]}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* agenda */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "18px 0 10px" }}>
        <div className="section-label" style={{ margin: 0 }}>{sel != null ? `${MONTHS[MONTH_INDEX]} ${sel}` : "Upcoming"}</div>
        {sel != null && <span className="pill" style={{ padding: "4px 11px", fontSize: 12 }} onClick={() => setSel(null)}>Show all</span>}
      </div>

      {agenda.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "26px 16px" }}>
          <JudithAvatar persona={persona} size={56} state="idle" />
          <div style={{ fontWeight: 600, marginTop: 12 }}>Nothing due that day</div>
          <div className="low" style={{ fontSize: 13, marginTop: 3 }}>Enjoy the quiet — I’ll flag the next one.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {agenda.map((b) => (
            <div key={b.id} className="bill-row" onClick={() => openBill(b)}>
              <div className="cal-daychip">
                <span className="cal-daychip-d mono">{b.dueDate}</span>
                <span className="cal-daychip-m">{MONTHS[MONTH_INDEX].slice(0, 3)}</span>
              </div>
              <ProviderLogo provider={b.provider} cat={b.cat} size={34} />
              <div className="meta">
                <div className="p">{b.provider}</div>
                <div className="d"><span className={"dot " + dueClass(b.dueDays)}></span>{b.cat} · in {b.dueDays}d</div>
              </div>
              <span className="mono amt" style={{ color: "var(--" + dueClass(b.dueDays) + ")" }}>{peso(b.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {agendaPaid.length > 0 && (
        <div>
          <div className="section-label">Paid this month</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {agendaPaid.map((b) => (
              <div key={b.id} className="bill-row paid" onClick={() => openBill(b)}>
                <div className="cal-daychip">
                  <span className="cal-daychip-d mono">{b.dueDate}</span>
                  <span className="cal-daychip-m">{MONTHS[MONTH_INDEX].slice(0, 3)}</span>
                </div>
                <ProviderLogo provider={b.provider} cat={b.cat} size={34} />
                <div className="meta">
                  <div className="p">{b.provider}</div>
                  <div className="d"><Icon name="check" size={12} /> Paid · {b.cat}</div>
                </div>
                <span className="mono amt" style={{ color: "var(--txt-low)" }}>{peso(b.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="fab-stack">
        <button className="fab fab-scan" onClick={() => openAdd({ mode: "scan" })}><Icon name="scan" size={22} /></button>
        <button className="fab" onClick={() => openAdd(null)}><Icon name="plus" size={24} /></button>
      </div>
    </div>
  );
}

Object.assign(window, { CalendarTab, CalLegend, CalGrid, CalHeat, CalRail });
