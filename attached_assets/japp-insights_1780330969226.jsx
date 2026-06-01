/* japp-insights.jsx — Insights tab with compact filters (date + category +
   provider) and 3 selectable layouts (ctx.insightsStyle):
   "overview" — KPI hero + trend + donut + top providers
   "report"   — big total + chart-type toggle + by-category bars (Revolut/Vivid)
   "bento"    — grid of insight cards
   Filters are compact: a segmented date row + two expand-on-tap chips. */

/* ---- donut ---- */
function Donut({ segments, total, size = 130 }) {
  const stroke = 18, r = (size - stroke) / 2, C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
      {segments.map((s, i) => {
        const len = total > 0 ? (s.value / total) * C : 0;
        const seg = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${Math.max(0, len - 3)} ${C - Math.max(0, len - 3)}`} strokeDashoffset={-acc} style={{ transition: "stroke-dasharray .6s ease" }} />;
        acc += len; return seg;
      })}
    </svg>
  );
}

function TrendBars({ data }) {
  const max = Math.max(...data.map((d) => d.a), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 110, marginTop: 8 }}>
      {data.map((d, i) => {
        const h = Math.max(8, (d.a / max) * 100), last = i === data.length - 1;
        return (
          <div key={d.m + i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 6, height: "100%" }}>
            <span className="mono low" style={{ fontSize: 9 }}>{(d.a / 1000).toFixed(1)}k</span>
            <div className="trend-bar" style={{ width: "100%", height: h + "%", borderRadius: "7px 7px 4px 4px", background: last ? "linear-gradient(to top, color-mix(in oklab,var(--accent) 45%,var(--surface-3)), var(--accent))" : "linear-gradient(to top, var(--surface-3), color-mix(in oklab,var(--accent) 22%,var(--surface-3)))", boxShadow: last ? "0 0 16px color-mix(in oklab,var(--accent) 55%,transparent)" : "none" }}></div>
            <span className="low" style={{ fontSize: 10, fontWeight: last ? 700 : 400, color: last ? "var(--accent)" : "var(--txt-low)" }}>{d.m}</span>
          </div>
        );
      })}
    </div>
  );
}

function TrendLine({ data }) {
  const max = Math.max(...data.map((d) => d.a), 1), min = Math.min(...data.map((d) => d.a), 0);
  const W = 300, H = 110, pad = 6;
  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1 || 1)) * (W - pad * 2);
    const y = H - pad - ((d.a - min) / (max - min || 1)) * (H - pad * 2);
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = path + ` L${pts[pts.length - 1][0].toFixed(1)} ${H} L${pts[0][0].toFixed(1)} ${H} Z`;
  return (
    <div style={{ marginTop: 8 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 120, display: "block" }} preserveAspectRatio="none">
        <defs><linearGradient id="tlg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" /><stop offset="100%" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
        <path d={area} fill="url(#tlg)" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 4 : 2.5} fill={i === pts.length - 1 ? "var(--accent)" : "var(--surface-1)"} stroke="var(--accent)" strokeWidth="1.5" />)}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        {data.map((d, i) => <span key={i} className="low" style={{ fontSize: 10, color: i === data.length - 1 ? "var(--accent)" : "var(--txt-low)" }}>{d.m}</span>)}
      </div>
    </div>
  );
}

/* ---- compact filter header ---- */
function InsightsFilters({ range, setRange, catF, setCatF, provF, setProvF, houseF, setHouseF, cats, provs, houses }) {
  const [open, setOpen] = useState(null); // 'cat' | 'prov' | 'house' | null
  const ranges = [["1m", "1M"], ["3m", "3M"], ["6m", "6M"], ["1y", "1Y"]];
  const multiHouse = houses && houses.length > 1;
  return (
    <div className="ins-filters">
      <div className="ins-frow">
        <div className="seg-ctl ins-range">
          {ranges.map(([v, l]) => <button key={v} className={range === v ? "on" : ""} onClick={() => setRange(v)}>{l}</button>)}
        </div>
        {multiHouse && (
          <button className={"ins-fchip" + (houseF !== "All" ? " active" : "")} onClick={() => setOpen(open === "house" ? null : "house")}>
            <Icon name="home" size={13} /> {houseF === "All" ? "All homes" : houseF} <Icon name="chev" size={12} />
          </button>
        )}
        <button className={"ins-fchip" + (catF !== "All" ? " active" : "")} onClick={() => setOpen(open === "cat" ? null : "cat")}>
          <Icon name="layers" size={13} /> {catF === "All" ? "Category" : catF} <Icon name="chev" size={12} />
        </button>
        <button className={"ins-fchip" + (provF !== "All" ? " active" : "")} onClick={() => setOpen(open === "prov" ? null : "prov")}>
          <Icon name="grid" size={13} /> {provF === "All" ? "Provider" : provF} <Icon name="chev" size={12} />
        </button>
      </div>
      {open === "house" && (
        <div className="ins-tray">
          {["All", ...houses].map((h) => <button key={h} className={"chip" + (houseF === h ? " sel" : "")} onClick={() => { setHouseF(h); setOpen(null); }}>{h === "All" ? "All homes" : h}</button>)}
        </div>
      )}
      {open === "cat" && (
        <div className="ins-tray">
          {["All", ...cats].map((c) => <button key={c} className={"chip" + (catF === c ? " sel" : "")} onClick={() => { setCatF(c); setProvF("All"); setOpen(null); }}>{c}</button>)}
        </div>
      )}
      {open === "prov" && (
        <div className="ins-tray">
          {["All", ...provs].map((p) => <button key={p} className={"chip" + (provF === p ? " sel" : "")} onClick={() => { setProvF(p); setOpen(null); }}>{p}</button>)}
        </div>
      )}
    </div>
  );
}

/* ---- layout renderers ---- */
function InsOverview({ active, total, cats, providers, trendData, biggest, providerCount, delta, deltaPct }) {
  return (
    <React.Fragment>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="low" style={{ fontSize: 12 }}>Total monthly bills</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 11, flexWrap: "wrap" }}>
          <span className="mono stat-big">{peso(total)}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: delta >= 0 ? "var(--urgent)" : "var(--ok)" }}><Icon name="trend" size={14} /> {delta >= 0 ? "+" : ""}{deltaPct}% vs prev</span>
        </div>
        <TrendBars data={trendData} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
        <div className="card kpi"><div className="low" style={{ fontSize: 11 }}>Biggest bill</div><div className="mono" style={{ fontSize: 19, fontWeight: 600 }}>{biggest ? peso(biggest.amount) : "—"}</div><div className="low" style={{ fontSize: 11 }}>{biggest ? biggest.provider : ""}</div></div>
        <div className="card kpi"><div className="low" style={{ fontSize: 11 }}>Avg / bill</div><div className="mono" style={{ fontSize: 19, fontWeight: 600 }}>{active.length ? peso(total / active.length) : "—"}</div><div className="low" style={{ fontSize: 11 }}>{active.length} bills</div></div>
        <div className="card kpi"><div className="low" style={{ fontSize: 11 }}>Providers</div><div className="mono" style={{ fontSize: 19, fontWeight: 600 }}>{providerCount}</div><div className="low" style={{ fontSize: 11 }}>across {cats.length} categories</div></div>
        <div className="card kpi"><div className="low" style={{ fontSize: 11 }}>On-time rate</div><div className="mono" style={{ fontSize: 19, fontWeight: 600, color: "var(--ok)" }}>100%</div><div className="low" style={{ fontSize: 11 }}>last 6 months</div></div>
      </div>
      <div className="section-label">Where it goes</div>
      <div className="card" style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <div style={{ position: "relative", flex: "0 0 auto" }}>
          <Donut segments={cats} total={total} size={130} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}><span className="low" style={{ fontSize: 10 }}>monthly</span><span className="mono" style={{ fontWeight: 600, fontSize: 15 }}>{peso(total)}</span></div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9 }}>
          {cats.map((c) => (
            <div key={c.cat} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="dot" style={{ background: c.color, boxShadow: "0 0 8px " + c.color }}></span>
              <span style={{ flex: 1, fontSize: 13 }}>{c.cat}</span>
              <span className="low" style={{ fontSize: 11 }}>{total > 0 ? Math.round((c.value / total) * 100) : 0}%</span>
              <span className="mono" style={{ fontSize: 12, fontWeight: 600, minWidth: 52, textAlign: "right" }}>{peso(c.value)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="section-label">Top providers</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {providers.map((b) => (
          <div key={b.id} className="bill-row" style={{ cursor: "default" }}>
            <ProviderLogo provider={b.provider} cat={b.cat} size={38} />
            <div className="meta"><div className="p">{b.provider}</div><div className="d">{b.cat} · {total > 0 ? Math.round((b.amount / total) * 100) : 0}% of bills</div></div>
            <span className="mono amt">{peso(b.amount)}</span>
          </div>
        ))}
      </div>
    </React.Fragment>
  );
}

function InsReport({ total, cats, trendData, delta, deltaPct }) {
  const [chart, setChart] = useState("bars");
  const catMax = Math.max(...cats.map((c) => c.value), 1);
  return (
    <React.Fragment>
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="low" style={{ fontSize: 12 }}>Total</div>
            <div className="mono" style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em" }}>{peso(total)}</div>
            <div className="low" style={{ fontSize: 12 }}><span style={{ color: delta >= 0 ? "var(--urgent)" : "var(--ok)" }}>{delta >= 0 ? "+" : ""}{deltaPct}%</span> vs prev period</div>
          </div>
          <div className="seg-ctl">
            <button className={chart === "bars" ? "on" : ""} onClick={() => setChart("bars")}><Icon name="chart" size={15} /></button>
            <button className={chart === "line" ? "on" : ""} onClick={() => setChart("line")}><Icon name="trend" size={15} /></button>
          </div>
        </div>
        {chart === "line" ? <TrendLine data={trendData} /> : <TrendBars data={trendData} />}
      </div>
      <div className="section-label">By category</div>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        {cats.map((c) => (
          <div key={c.cat}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 7 }}><span className="dot" style={{ background: c.color }}></span>{c.cat}</span>
              <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{peso(c.value)} <span className="low" style={{ fontWeight: 400 }}>· {total > 0 ? Math.round((c.value / total) * 100) : 0}%</span></span>
            </div>
            <div className="cat-bar"><div className="cat-bar-fill" style={{ width: Math.round((c.value / catMax) * 100) + "%", background: c.color }}></div></div>
          </div>
        ))}
      </div>
    </React.Fragment>
  );
}

function InsBento({ active, total, cats, providers, trendData, biggest, providerCount, deltaPct, delta }) {
  return (
    <div className="bento">
      <div className="card bento-wide">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div><div className="low" style={{ fontSize: 11 }}>Total monthly</div><div className="mono" style={{ fontSize: 24, fontWeight: 700 }}>{peso(total)}</div></div>
          <span style={{ fontSize: 12, color: delta >= 0 ? "var(--urgent)" : "var(--ok)" }}>{delta >= 0 ? "+" : ""}{deltaPct}%</span>
        </div>
        <TrendBars data={trendData} />
      </div>
      <div className="card bento-cell">
        <div className="low" style={{ fontSize: 11, marginBottom: 8 }}>Where it goes</div>
        <div style={{ position: "relative", width: 92, height: 92, margin: "0 auto" }}>
          <Donut segments={cats} total={total} size={92} />
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}><span className="low" style={{ fontSize: 9 }}>{cats.length} cats</span></div>
        </div>
      </div>
      <div className="card bento-cell">
        <div className="low" style={{ fontSize: 11 }}>Top category</div>
        {cats[0] && <React.Fragment><div style={{ fontWeight: 600, marginTop: 6, display: "flex", alignItems: "center", gap: 7 }}><span className="dot" style={{ background: cats[0].color }}></span>{cats[0].cat}</div><div className="mono" style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{peso(cats[0].value)}</div><div className="low" style={{ fontSize: 11 }}>{total > 0 ? Math.round((cats[0].value / total) * 100) : 0}% of bills</div></React.Fragment>}
      </div>
      <div className="card bento-cell"><div className="low" style={{ fontSize: 11 }}>Biggest bill</div><div className="mono" style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>{biggest ? peso(biggest.amount) : "—"}</div><div className="low" style={{ fontSize: 11 }}>{biggest ? biggest.provider : ""}</div></div>
      <div className="card bento-cell"><div className="low" style={{ fontSize: 11 }}>On-time</div><div className="mono" style={{ fontSize: 20, fontWeight: 700, marginTop: 6, color: "var(--ok)" }}>100%</div><div className="low" style={{ fontSize: 11 }}>6 months</div></div>
      <div className="card bento-wide">
        <div className="low" style={{ fontSize: 11, marginBottom: 9 }}>Top providers</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {providers.slice(0, 3).map((b) => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ProviderLogo provider={b.provider} cat={b.cat} size={30} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{b.provider}</span>
              <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{peso(b.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InsightsTab({ ctx }) {
  const { bills, openAsk, persona } = ctx;
  const insightsStyle = ctx.insightsStyle || "overview";
  const [range, setRange] = useState("6m");
  const [catF, setCatF] = useState("All");
  const [provF, setProvF] = useState("All");
  const [houseF, setHouseF] = useState("All");

  const houses = Array.from(new Set(bills.map((b) => b.house).filter(Boolean)));
  const allCats = Array.from(new Set(bills.filter((b) => houseF === "All" || b.house === houseF).map((b) => b.cat)));
  const provsForCat = bills.filter((b) => (houseF === "All" || b.house === houseF) && (catF === "All" || b.cat === catF)).map((b) => b.provider);
  const allProvs = Array.from(new Set(provsForCat));

  const active = bills.filter((b) => (houseF === "All" || b.house === houseF) && (catF === "All" || b.cat === catF) && (provF === "All" || b.provider === provF));
  const total = active.reduce((s, b) => s + b.amount, 0);
  const prev = TREND_6MO[TREND_6MO.length - 2].a;
  const delta = total - prev;
  const deltaPct = prev > 0 ? Math.round((delta / prev) * 100) : 0;

  const catMap = {};
  active.forEach((b) => { catMap[b.cat] = (catMap[b.cat] || 0) + b.amount; });
  const cats = Object.keys(catMap).map((cat) => ({ cat, value: catMap[cat], color: CAT_COLORS[cat] || "var(--accent)" })).sort((a, b) => b.value - a.value);
  const providers = active.slice().sort((a, b) => b.amount - a.amount).slice(0, 5);
  const biggest = active.slice().sort((a, b) => b.amount - a.amount)[0];
  const providerCount = new Set(active.map((b) => b.provider)).size;
  const nMap = { "1m": 2, "3m": 3, "6m": 6, "1y": 6 };
  const trendData = TREND_6MO.slice(-nMap[range]).map((d) => ({ ...d, a: catF === "All" && provF === "All" ? d.a : Math.round(d.a * (total / (TREND_6MO[TREND_6MO.length - 1].a || 1))) }));

  const shared = { active, total, cats, providers, trendData, biggest, providerCount, delta, deltaPct };

  return (
    <div className="pagepad view-anim" style={{ paddingBottom: 96 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, marginBottom: 12 }}>
        <h1 className="h">Insights</h1>
      </div>

      <InsightsFilters range={range} setRange={setRange} catF={catF} setCatF={setCatF} provF={provF} setProvF={setProvF} houseF={houseF} setHouseF={setHouseF} cats={allCats} provs={allProvs} houses={houses} />

      {active.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "30px 16px" }}><div className="low">No bills match these filters.</div></div>
      ) : insightsStyle === "report" ? <InsReport {...shared} />
        : insightsStyle === "bento" ? <InsBento {...shared} />
        : <InsOverview {...shared} />}

      <div className="card" style={{ marginTop: 14, display: "flex", gap: 13, alignItems: "center", cursor: "pointer", borderColor: "color-mix(in oklab,var(--accent) 28%,transparent)" }} onClick={openAsk}>
        <JudithAvatar persona={persona} size={42} state="idle" />
        <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>Ask about your spending</div><div className="low" style={{ fontSize: 12 }}>“Why is my bill higher this month?”</div></div>
        <Icon name="mic" size={18} />
      </div>
    </div>
  );
}

Object.assign(window, { InsightsTab, Donut, TrendBars, TrendLine, InsightsFilters, InsOverview, InsReport, InsBento });
