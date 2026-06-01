/* japp-devices.jsx — concept frames for iOS home-screen / lock-screen widgets
   and Apple Watch. Visual concepts (planned features), built from Judith tokens. */

function WidgetSmall({ ctx, next, cur }) {
  return (
    <div className="wdg wdg-sm">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <JudithAvatar persona={ctx.persona} size={26} state="idle" />
        <span className="wdg-tag" style={{ color: "var(--" + dueClass(next.dueDays) + ")" }}>{next.dueDays}d</span>
      </div>
      <div style={{ marginTop: "auto" }}>
        <div className="wdg-cap">Next due</div>
        <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.15 }}>{next.provider}</div>
        <div className="mono" style={{ fontSize: 19, fontWeight: 700 }}>{cur}{Math.round(next.amount).toLocaleString("en-US")}</div>
      </div>
    </div>
  );
}

function WidgetMedium({ ctx, due, total, cur }) {
  const soon = due.slice(0, 3);
  return (
    <div className="wdg wdg-md">
      <div style={{ flex: 1 }}>
        <div className="wdg-cap">Due this month</div>
        <div className="mono" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{cur}{Math.round(total).toLocaleString("en-US")}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
          {soon.map((b) => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11 }}>
              <span className={"dot " + dueClass(b.dueDays)}></span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.provider}</span>
              <span className="mono" style={{ opacity: .8 }}>{cur}{Math.round(b.amount).toLocaleString("en-US")}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="wdg-sep"></div>
      <div style={{ width: 76, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <JudithAvatar persona={ctx.persona} size={40} state="idle" />
        <div style={{ textAlign: "center" }}>
          <div className="mono" style={{ fontWeight: 700, fontSize: 15, color: "var(--near)" }}>{due.length}</div>
          <div className="wdg-cap" style={{ fontSize: 9 }}>upcoming</div>
        </div>
      </div>
    </div>
  );
}

function DevicesShowcase({ ctx }) {
  const bills = ctx.bills || [];
  const cur = (ctx.country && ctx.country.cur) || "₱";
  const due = bills.filter((b) => b.status !== "paid").slice().sort((a, b) => a.dueDays - b.dueDays);
  const total = due.reduce((s, b) => s + b.amount, 0);
  const next = due[0] || { provider: "Meralco", amount: 3450, dueDays: 3, cat: "Electricity" };

  return (
    <div className="pagepad view-anim" style={{ paddingBottom: 28 }}>
      <h1 className="h" style={{ marginTop: 4, marginBottom: 2 }}>On your devices</h1>
      <p className="muted" style={{ fontSize: 14, marginTop: 0, marginBottom: 18 }}>A preview of where Judith shows up — concepts for what’s coming next.</p>

      {/* HOME SCREEN */}
      <div className="dev-label"><Icon name="grid" size={13} /> Home Screen</div>
      <div className="homescreen">
        <div className="hs-widgets">
          <WidgetSmall ctx={ctx} next={next} cur={cur} />
          <WidgetMedium ctx={ctx} due={due} total={total} cur={cur} />
        </div>
        <div className="hs-dock">
          {["phone", "spark", "card", "bell"].map((ic, i) => <span key={i} className="hs-app"><Icon name={ic} size={18} /></span>)}
        </div>
      </div>

      {/* LOCK SCREEN */}
      <div className="dev-label" style={{ marginTop: 22 }}><Icon name="bell" size={13} /> Lock Screen</div>
      <div className="lockscreen lockscreen-dev">
        <div className="lock-complications">
          <span className="lc-circle"><JudithAvatar persona={ctx.persona} size={30} state="idle" /></span>
          <span className="lc-circle ring"><span className="mono">{due.length}</span><span className="lc-sub">due</span></span>
          <span className="lc-circle"><Icon name="card" size={16} /><span className="lc-sub mono">{cur}{(total / 1000).toFixed(1)}k</span></span>
        </div>
        <div className="lock-time" style={{ margin: "8px 0 14px" }}>
          <div className="lock-clock">9:41</div>
          <div className="lock-date">Monday, June 1</div>
        </div>
        <div className="lock-rect-wdg">
          <JudithAvatar persona={ctx.persona} size={28} state="idle" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{next.provider} due in {next.dueDays} days</div>
            <div style={{ fontSize: 11, opacity: .75 }}>{cur}{Math.round(next.amount).toLocaleString("en-US")} · tap to pay</div>
          </div>
        </div>
      </div>

      {/* APPLE WATCH */}
      <div className="dev-label" style={{ marginTop: 22 }}><Icon name="watch" size={13} /> Apple Watch</div>
      <div className="watch-row">
        <div className="watch">
          <div className="watch-screen">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
              <span className="mono" style={{ color: "var(--near)", fontWeight: 700, fontSize: 13 }}>9:41</span>
              <JudithAvatar persona={ctx.persona} size={20} state="idle" />
            </div>
            <div className="watch-face-num mono">{cur}{Math.round(total).toLocaleString("en-US")}</div>
            <div className="watch-cap">due this month</div>
            <div className="watch-comp">
              <span className={"dot " + dueClass(next.dueDays)}></span>{next.provider} · {next.dueDays}d
            </div>
          </div>
        </div>
        <div className="watch">
          <div className="watch-screen" style={{ justifyContent: "center", gap: 6 }}>
            <JudithAvatar persona={ctx.persona} size={34} state="speaking" />
            <div className="watch-cap" style={{ marginTop: 2 }}>NEXT DUE</div>
            <div style={{ fontWeight: 600, fontSize: 12 }}>{next.provider}</div>
            <div className="watch-face-num mono" style={{ fontSize: 20 }}>{cur}{Math.round(next.amount).toLocaleString("en-US")}</div>
            <button className="watch-pay">Pay now</button>
          </div>
        </div>
      </div>

      <div className="low" style={{ fontSize: 12, textAlign: "center", marginTop: 20, lineHeight: 1.5 }}>Widgets &amp; Watch are on the roadmap — turn them on in Settings to be first when they ship.</div>
    </div>
  );
}

Object.assign(window, { DevicesShowcase });
