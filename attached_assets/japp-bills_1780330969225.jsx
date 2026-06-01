/* japp-bills.jsx — Bills tab + Bill detail sheet + Add/Edit/Scan sheet */

const CATS = [
  { cat: "Electricity", icon: "zap" }, { cat: "Water", icon: "droplet" }, { cat: "Internet", icon: "wifi" },
  { cat: "Mobile", icon: "smartphone" }, { cat: "Landline", icon: "phone" }, { cat: "Credit card", icon: "card" },
  { cat: "Subscription", icon: "spark" }, { cat: "Custom", icon: "plus" }
];

function BillRow({ b, onClick }) {
  return (
    <div className={"bill-row" + (b.status === "paid" ? " paid" : "")} onClick={onClick}>
      <ProviderLogo provider={b.provider} cat={b.cat} size={38} />
      <div className="meta">
        <div className="p">{b.provider}</div>
        <div className="d">
          {b.status === "paid"
            ? <><Icon name="check" size={12} /> Paid · {b.dueLabel}</>
            : <><span className={"dot " + dueClass(b.dueDays)}></span>{b.cat} · {b.dueLabel}</>}
        </div>
      </div>
      <span className="mono amt" style={{ color: b.status === "paid" ? "var(--txt-low)" : "var(--" + dueClass(b.dueDays) + ")" }}>{peso(b.amount)}</span>
    </div>
  );
}

function BillsTab({ ctx }) {
  const { bills, openBill, openAdd } = ctx;
  const due = bills.filter((b) => b.status !== "paid");
  const groups = [
    { label: "Needs you now", items: due.filter((b) => b.dueDays <= 3) },
    { label: "This week", items: due.filter((b) => b.dueDays > 3 && b.dueDays <= 7) },
    { label: "Upcoming", items: due.filter((b) => b.dueDays > 7) },
    { label: "Paid", items: bills.filter((b) => b.status === "paid") }
  ].filter((g) => g.items.length);
  const total = due.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="pagepad view-anim" style={{ paddingBottom: 90 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 6, marginBottom: 6 }}>
        <h1 className="h">Bills</h1>
        <div style={{ textAlign: "right" }}>
          <div className="mono" style={{ fontWeight: 600, fontSize: 18 }}>{peso(total)}</div>
          <div className="low" style={{ fontSize: 11 }}>{due.length} due</div>
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.label}>
          <div className="section-label">{g.label}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {g.items.sort((a, b) => a.dueDays - b.dueDays).map((b) => (
              <BillRow key={b.id} b={b} onClick={() => openBill(b)} />
            ))}
          </div>
        </div>
      ))}

      <div className="fab-stack">
        <button className="fab fab-scan" onClick={() => openAdd({ mode: "scan" })}><Icon name="scan" size={22} /></button>
        <button className="fab" onClick={() => openAdd(null)}><Icon name="plus" size={24} /></button>
      </div>
    </div>
  );
}

function BillDetailSheet({ bill, ctx }) {
  if (!bill) return null;
  const paid = bill.status === "paid";
  const hist = HISTORY[bill.id] || [];
  const maxH = Math.max(1, ...hist.map((h) => h.a));
  return (
    <div style={{ display: "contents" }}>
      <div className="grab"></div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <ProviderLogo provider={bill.provider} cat={bill.cat} size={48} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 19 }}>{bill.provider}</div>
          <div className="low" style={{ fontSize: 13 }}>{bill.cat}</div>
        </div>
        <div className="round-btn" onClick={ctx.closeSheet}><Icon name="x" size={16} /></div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span className="mono stat-big">{peso(bill.amount)}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: paid ? "var(--ok)" : "var(--" + dueClass(bill.dueDays) + ")" }}>
          <span className={"dot " + (paid ? "ok" : dueClass(bill.dueDays))}></span>
          {paid ? "Paid" : "Due " + bill.dueLabel + " · " + bill.dueDays + "d"}
        </span>
      </div>

      {!paid ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <button className="btn btn-primary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }} onClick={() => ctx.markPaid(bill.id)}><Icon name="wallet" size={18} /> Mark as paid</button>
          <div className="two">
            <button className="btn btn-soft" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 13 }} onClick={() => ctx.snooze(bill.id)}><Icon name="snooze" size={17} /> Snooze</button>
            <button className="btn btn-soft" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 13 }} onClick={() => ctx.openAdd(bill)}><Icon name="pencil" size={16} /> Edit</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-soft" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => ctx.markUnpaid(bill.id)}><Icon name="refresh" size={16} /> Mark as unpaid</button>
      )}

      <div className="set-row" style={{ borderRadius: "var(--r-md)" }}>
        <span className="ico" style={{ color: "var(--accent)" }}><Icon name="bell" size={17} /></span>
        <div className="label"><div className="t">Reminder</div><div className="s">3 days before · 9:00 AM</div></div>
        <Icon name="chev" size={16} />
      </div>

      {hist.length > 0 && (
        <div>
          <div className="section-label" style={{ marginTop: 4 }}>Recent payments</div>
          <div className="card" style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 110, paddingTop: 14 }}>
            {hist.slice().reverse().map((h, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 7, height: "100%" }}>
                <span className="mono low" style={{ fontSize: 10 }}>{peso(h.a)}</span>
                <div style={{ width: "100%", borderRadius: "6px 6px 3px 3px", background: "linear-gradient(to top, color-mix(in oklab,var(--accent) 35%,var(--surface-3)), var(--accent))", height: Math.max(10, (h.a / maxH) * 100) + "%" }}></div>
                <span className="low" style={{ fontSize: 10 }}>{h.m}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Scan viewfinder ---- */
/* ---- Scan a bill — 3 flows (ctx.scanStyle): "live" (Brex), "confirm" (Splitwise), "receipt" (GoPay) ---- */
function DETECTED_DEFAULT() {
  return { provider: "Meralco", cat: "Electricity", amount: "3450", due: "Jun 15", dueDate: 15, lowDue: true };
}

function MiniReceipt({ small }) {
  return (
    <div className={"scan-receipt-thumb" + (small ? " sm" : "")}>
      <div className="rt-logo"></div>
      <div className="rt-line" style={{ width: "70%" }}></div>
      <div className="rt-line" style={{ width: "48%" }}></div>
      <div className="rt-amt"></div>
      <div className="rt-line" style={{ width: "60%" }}></div>
      <div className="rt-line" style={{ width: "38%" }}></div>
    </div>
  );
}

function DetField({ label, value, onChange, low, suffix }) {
  return (
    <div className={"det-field" + (low ? " low-conf" : "")}>
      <div className="det-label">{label}{low && <span className="det-flag"><Icon name="alert" size={11} /> check this</span>}</div>
      <div className="det-input-wrap">
        {suffix && <span className="det-suffix">{suffix}</span>}
        <input className="det-input" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function ScanView({ ctx, onDetected, onManual }) {
  const style = (ctx && ctx.scanStyle) || "live";
  const cur = (ctx && ctx.country && ctx.country.cur) || "₱";
  const [phase, setPhase] = useState("ready"); // ready -> scanning -> review (confirm/receipt) | done (live)
  const [det, setDet] = useState(DETECTED_DEFAULT());
  const set = (k, v) => setDet((d) => ({ ...d, [k]: v }));

  const shoot = () => {
    setPhase("scanning");
    setTimeout(() => {
      if (style === "live") {
        setPhase("done");
        setTimeout(() => onDetected({ provider: det.provider, cat: det.cat, amount: det.amount, due: det.due }), 700);
      } else {
        setPhase("review");
      }
    }, 1900);
  };

  const confirmSave = () => {
    const info = (typeof lookupProvider === "function") ? lookupProvider(det.provider) : null;
    ctx.saveBill({
      id: "b" + Date.now(), provider: det.provider || det.cat, cat: det.cat,
      icon: (CATS.find((c) => c.cat === det.cat) || {}).icon || "spark",
      amount: parseFloat(det.amount) || 0, dueLabel: det.due || "Jun 30",
      dueDate: parseInt((String(det.due).match(/\d+/) || [])[0], 10) || 30, dueDays: 14, status: "due"
    });
  };

  const viewfinder = (live) => (
    <div className={"scan-frame" + (live ? " live" : "")}>
      <div className="scan-doc">
        <div className="scan-line-row" style={{ width: "55%" }}></div>
        <div className="scan-line-row" style={{ width: "85%" }}></div>
        <div className="scan-line-row" style={{ width: "40%" }}></div>
        <div className="scan-amt mono">{cur} ▮,▮▮▮</div>
        <div className="scan-line-row" style={{ width: "70%" }}></div>
      </div>
      <span className="scan-corner tl"></span><span className="scan-corner tr"></span>
      <span className="scan-corner bl"></span><span className="scan-corner br"></span>
      {phase === "scanning" && <div className="scan-sweep"></div>}
      {phase === "done" && <div className="scan-check"><Icon name="check" size={30} /></div>}
      {/* live floating detect card (Brex pattern) */}
      {live && phase !== "ready" && (
        <div className="scan-live-card bubble-in">
          <ProviderLogo provider={det.provider} cat={det.cat} size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{phase === "scanning" ? "Reading…" : det.provider}</div>
            <div className="low" style={{ fontSize: 11 }}>{phase === "scanning" ? "detecting provider" : det.cat + " · due " + det.due}</div>
          </div>
          <span className="mono" style={{ fontWeight: 700 }}>{phase === "scanning" ? "…" : cur + parseFloat(det.amount).toLocaleString("en-US")}</span>
        </div>
      )}
    </div>
  );

  /* ----- B · confirm card (Splitwise) ----- */
  if (style === "confirm" && phase === "review") {
    return (
      <div style={{ display: "contents" }}>
        <div className="grab"></div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 className="h">Confirm bill</h2>
          <div className="round-btn" onClick={ctx.closeSheet}><Icon name="x" size={16} /></div>
        </div>
        <div className="detected-banner"><Icon name="check" size={14} /> Judith read this from your bill — fix anything that’s off.</div>
        <div style={{ display: "flex", gap: 13, alignItems: "center", margin: "2px 0 4px" }}>
          <MiniReceipt small={true} />
          <div>
            <div style={{ fontWeight: 600 }}>{det.provider}</div>
            <div className="low" style={{ fontSize: 12 }}>1 bill detected</div>
            <button className="link-btn" onClick={() => setPhase("ready")}><Icon name="scan" size={12} /> Rescan</button>
          </div>
        </div>
        <div className="det-grid">
          <DetField label="Provider" value={det.provider} onChange={(v) => set("provider", v)} />
          <DetField label="Amount" value={det.amount} onChange={(v) => set("amount", v)} suffix={cur} />
          <DetField label="Due date" value={det.due} onChange={(v) => set("due", v)} low={det.lowDue} />
          <div className="det-field">
            <div className="det-label">Category</div>
            <select className="search det-select" value={det.cat} onChange={(e) => set("cat", e.target.value)}>
              {CATS.map((c) => <option key={c.cat} value={c.cat}>{c.cat}</option>)}
            </select>
          </div>
        </div>
        <button className="btn btn-primary" onClick={confirmSave}><Icon name="check" size={18} /> Add this bill</button>
        <button className="btn btn-ghost" onClick={onManual}>Enter manually instead</button>
      </div>
    );
  }

  /* ----- C · receipt preview + extracted rows (GoPay) ----- */
  if (style === "receipt" && phase === "review") {
    const rows = [
      { k: "Provider", v: det.provider, edit: (val) => set("provider", val) },
      { k: "Category", v: det.cat, select: true },
      { k: "Amount", v: det.amount, edit: (val) => set("amount", val), mono: true, prefix: cur },
      { k: "Due date", v: det.due, edit: (val) => set("due", val), low: det.lowDue }
    ];
    return (
      <div style={{ display: "contents" }}>
        <div className="grab"></div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 className="h">Bill scanned</h2>
          <div className="round-btn" onClick={ctx.closeSheet}><Icon name="x" size={16} /></div>
        </div>
        <div className="rcpt-head">
          <MiniReceipt />
          <div style={{ flex: 1 }}>
            <div className="low" style={{ fontSize: 12 }}>Tap a value to fix it.</div>
            <button className="btn btn-soft" style={{ marginTop: 8, width: "auto", padding: "8px 13px", display: "inline-flex", gap: 7 }} onClick={() => setPhase("ready")}><Icon name="scan" size={15} /> Rescan</button>
          </div>
        </div>
        <div className="rcpt-rows">
          {rows.map((r) => (
            <div key={r.k} className={"rcpt-row" + (r.low ? " low-conf" : "")}>
              <span className="rcpt-k">{r.k}{r.low && <span className="det-flag"><Icon name="alert" size={11} /> check</span>}</span>
              {r.select ? (
                <select className="rcpt-edit" value={det.cat} onChange={(e) => set("cat", e.target.value)}>
                  {CATS.map((c) => <option key={c.cat} value={c.cat}>{c.cat}</option>)}
                </select>
              ) : (
                <span className={"rcpt-v" + (r.mono ? " mono" : "")}>{r.prefix || ""}<input className="rcpt-edit" value={r.v} onChange={(e) => r.edit(e.target.value)} /></span>
              )}
            </div>
          ))}
        </div>
        <button className="btn btn-primary" onClick={confirmSave}>Confirm & add bill</button>
        <button className="btn btn-ghost" onClick={onManual}>Enter manually instead</button>
      </div>
    );
  }

  /* ----- capture (all styles) ----- */
  const live = style === "live";
  return (
    <div style={{ display: "contents" }}>
      <div className="grab"></div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 className="h">Scan a bill</h2>
        <div className="round-btn" onClick={onManual}><Icon name="pencil" size={15} /></div>
      </div>
      {viewfinder(live)}
      <div className="low" style={{ textAlign: "center", fontSize: 13 }}>
        {phase === "ready" && "Point at your bill or statement — Judith reads the provider, amount and due date."}
        {phase === "scanning" && "Reading your bill…"}
        {phase === "done" && "Got it — mapping the details…"}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22, marginTop: 2 }}>
        <button className="round-btn lg" onClick={onManual}><Icon name="keyboard" size={20} /></button>
        <button className={"shutter" + (phase !== "ready" ? " busy" : "")} onClick={phase === "ready" ? shoot : undefined}>
          <span></span>
        </button>
        <button className="round-btn lg"><Icon name="flash" size={20} /></button>
      </div>
      <button className="btn btn-ghost" onClick={onManual}>Enter manually instead</button>
    </div>
  );
}

function AddBillSheet({ editBill, ctx }) {
  const initialScan = editBill && editBill.mode === "scan";
  const real = editBill && !editBill.mode ? editBill : null;
  const [view, setView] = useState(initialScan ? "scan" : "form");
  const [detected, setDetected] = useState(false);
  const [provider, setProvider] = useState(real ? real.provider : "");
  const [cat, setCat] = useState(real ? real.cat : "Electricity");
  const [amount, setAmount] = useState(real ? String(real.amount) : "");
  const [due, setDue] = useState(real ? real.dueLabel : "");

  const suggestions = (() => {
    const learned = (ctx.learnedProviders[cat] || []);
    const dbList = (PROVIDERS[cat] || []).map((p) => p.name);
    const merged = [];
    learned.concat(dbList).forEach((n) => { if (n && !merged.includes(n)) merged.push(n); });
    return merged.slice(0, 6);
  })();

  const onDetected = (d) => {
    setProvider(d.provider); setCat(d.cat); setAmount(d.amount.replace(/,/g, "")); setDue(d.due);
    setDetected(true); setView("form");
  };

  const save = () => {
    const info = lookupProvider(provider);
    ctx.saveBill({
      id: real ? real.id : "b" + Date.now(),
      provider: provider || cat, cat, icon: (CATS.find((c) => c.cat === cat) || {}).icon || "spark",
      amount: parseFloat(amount) || 0,
      dueLabel: due || "Jun 30", dueDate: parseInt((due.match(/\d+/) || [])[0], 10) || 30,
      dueDays: real ? real.dueDays : 20, status: "due"
    });
  };

  if (view === "scan") {
    return <ScanView ctx={ctx} onDetected={onDetected} onManual={() => setView("form")} />;
  }

  return (
    <div style={{ display: "contents" }}>
      <div className="grab"></div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 className="h">{real ? "Edit bill" : "Add a bill"}</h2>
        <div className="round-btn" onClick={ctx.closeSheet}><Icon name="x" size={16} /></div>
      </div>

      {!real && (
        <div className="seg-ctl wide">
          <button className={view === "form" && !initialScan ? "on" : ""} onClick={() => setView("form")}><Icon name="pencil" size={14} /> Manual</button>
          <button onClick={() => { setDetected(false); setView("scan"); }}><Icon name="scan" size={14} /> Scan</button>
        </div>
      )}

      {detected && (
        <div className="detected-banner"><Icon name="check" size={14} /> Detected from your bill — edit anything that's off.</div>
      )}

      <div className="field">
        <label>Category</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CATS.map((c) => (
            <span key={c.cat} className={"chip" + (cat === c.cat ? " sel" : "")} onClick={() => { setCat(c.cat); }}>{c.cat}</span>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Provider</label>
        {suggestions.length > 0 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, margin: "0 -2px 2px" }}>
            {suggestions.map((n) => (
              <button key={n} className={"prov-chip" + (provider === n ? " sel" : "")} onClick={() => setProvider(n)}>
                <ProviderLogo provider={n} cat={cat} size={20} />
                <span>{n}</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {provider ? <ProviderLogo provider={provider} cat={cat} size={40} /> : <ProviderLogo cat={cat} size={40} />}
          <input className="control" placeholder="e.g. Meralco" value={provider} onChange={(e) => setProvider(e.target.value)} style={{ flex: 1 }} />
        </div>
      </div>

      <div className="two">
        <div className="field">
          <label>Amount</label>
          <input className="control mono" inputMode="numeric" placeholder="₱ 0" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
        </div>
        <div className="field">
          <label>Due date</label>
          <input className="control" placeholder="e.g. Jun 15" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
      </div>

      <button className="btn btn-primary" onClick={save}>{real ? "Save changes" : "Add bill"}</button>
      {!real && (
        <button className="btn btn-ghost" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => { ctx.closeSheet(); ctx.openAsk(); }}>
          <Icon name="mic" size={16} /> Or just tell Judith
        </button>
      )}
    </div>
  );
}

Object.assign(window, { BillsTab, BillRow, BillDetailSheet, AddBillSheet, ScanView, CATS, BillsListScreen });

/* ---- Full bills list screen (reached via Home "See all") with filters ---- */
function BillsListScreen({ ctx }) {
  const { bills, openBill, closeBillsList, openAdd } = ctx;
  const [cat, setCat] = useState("All");
  const [prov, setProv] = useState("All");
  const [sort, setSort] = useState("due"); // due | amount | name

  const cats = ["All", ...Array.from(new Set(bills.map((b) => b.cat)))];
  const provsForCat = bills.filter((b) => cat === "All" || b.cat === cat).map((b) => b.provider);
  const provs = ["All", ...Array.from(new Set(provsForCat))];

  let list = bills.filter((b) => (cat === "All" || b.cat === cat) && (prov === "All" || b.provider === prov));
  list = list.slice().sort((a, b) => {
    if (sort === "amount") return b.amount - a.amount;
    if (sort === "name") return a.provider.localeCompare(b.provider);
    // due: unpaid first by days, paid last
    if ((a.status === "paid") !== (b.status === "paid")) return a.status === "paid" ? 1 : -1;
    return a.dueDays - b.dueDays;
  });
  const total = list.filter((b) => b.status !== "paid").reduce((s, b) => s + b.amount, 0);
  const sorts = [["due", "Due date"], ["amount", "Amount"], ["name", "Name"]];

  return (
    <div className="bl-screen">
      <div className="bl-head">
        <div className="round-btn" onClick={closeBillsList}><span style={{ display: "inline-flex", transform: "rotate(180deg)" }}><Icon name="chev" size={16} /></span></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 18 }}>All bills</div>
          <div className="low" style={{ fontSize: 12 }}>{list.length} shown · <span className="mono">{peso(total)}</span> due</div>
        </div>
        <div className="round-btn" onClick={() => openAdd(null)}><Icon name="plus" size={18} /></div>
      </div>

      <div className="bl-filters">
        <div className="bl-filter-row">
          <span className="bl-flabel">Category</span>
          <div className="bl-chips">
            {cats.map((c) => <button key={c} className={"chip" + (cat === c ? " sel" : "")} onClick={() => { setCat(c); setProv("All"); }}>{c}</button>)}
          </div>
        </div>
        <div className="bl-filter-row">
          <span className="bl-flabel">Provider</span>
          <div className="bl-chips">
            {provs.map((p) => <button key={p} className={"chip" + (prov === p ? " sel" : "")} onClick={() => setProv(p)}>{p}</button>)}
          </div>
        </div>
        <div className="bl-filter-row">
          <span className="bl-flabel">Sort</span>
          <div className="seg-ctl">
            {sorts.map(([v, l]) => <button key={v} className={sort === v ? "on" : ""} onClick={() => setSort(v)}>{l}</button>)}
          </div>
        </div>
      </div>

      <div className="bl-list">
        {list.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "30px 16px" }}>
            <div className="low">No bills match these filters.</div>
          </div>
        ) : list.map((b) => <BillRow key={b.id} b={b} onClick={() => openBill(b)} />)}
      </div>
    </div>
  );
}
