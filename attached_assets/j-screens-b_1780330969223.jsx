/* j-screens-b.jsx — Problem · Intro · Voice add-bill loop (+ tap fallback) */

function ScreenProblem({ ctx }) {
  const { next, record } = ctx;
  const cur = (ctx.country && ctx.country.cur) || "₱";
  const [answered, setAnswered] = useState(null);
  const rows = [
    { icon: "zap", cat: "Electricity" }, { icon: "droplet", cat: "Water" },
    { icon: "wifi", cat: "Internet" }, { icon: "smartphone", cat: "Mobile" },
    { icon: "card", cat: "Credit card" }, { icon: "spark", cat: "Netflix" },
    { icon: "spark", cat: "Spotify" }, { icon: "spark", cat: "iCloud+" }
  ];
  const pick = (knows) => {
    if (answered) return;
    setAnswered(knows);
    record && record("knowsMonthlyTotal", knows);
    setTimeout(next, 480);
  };
  return (
    <div style={{ display: "contents" }}>
      <div className="scroll center screen-anim" style={{ gap: 0 }}>
        <div className="kicker">Quick question</div>
        <h1 className="title" style={{ maxWidth: 300, textAlign: "center" }}>Do you know your total bills due next month?</h1>

        <div className="card mystery-card">
          <div className="low" style={{ fontSize: 12 }}>Due next month</div>
          <div className="mystery-total mono">{cur}<span className="mystery-digits">?,???</span></div>
          <div className="mystery-rows">
            {rows.map((r, i) => (
              <div key={i} className="mystery-row">
                <span className="ico" style={{ width: 24, height: 24, color: "var(--txt-mid)" }}><Icon name={r.icon} size={13} /></span>
                <span style={{ flex: 1, fontSize: 13 }}>{r.cat}</span>
                <span className="mono mystery-blur">{cur}•••</span>
              </div>
            ))}
            <div className="mystery-row" style={{ justifyContent: "center", color: "var(--txt-low)", fontSize: 12 }}>+ every other subscription you forgot</div>
          </div>
        </div>
      </div>
      <div className="cta-bar">
        <div className="two" style={{ gap: 10 }}>
          <button className={"btn btn-soft" + (answered === true ? " sel-yes" : "")} onClick={() => pick(true)}>Yes, roughly</button>
          <button className={"btn btn-primary" + (answered === false ? " sel-no" : "")} onClick={() => pick(false)}>Honestly, no</button>
        </div>
      </div>
    </div>
  );
}

function ScreenIntro({ ctx }) {
  const { next, persona } = ctx;
  useEffect(() => {
    /* TODO: ElevenLabs — Judith speaks: "Do you have five to seven minutes now,
       so we can map your whole bill picture? More bills than most? It might take
       a little longer — but it's worth it." (in the chosen voice) */
  }, []);
  return (
    <div style={{ display: "contents" }}>
      <div className="scroll center screen-anim" style={{ textAlign: "center", alignItems: "center", gap: 0 }}>
        <PersonaAvatar persona={persona} size={76} state="speaking" />
        <div className="vo-wave on" style={{ marginTop: 12 }}><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div className="kicker" style={{ marginTop: 14 }}>Before we start</div>
        <h1 className="title" style={{ maxWidth: 300 }}>Do you have 5–7 minutes now to map your whole bill picture?</h1>
        <p className="lede" style={{ maxWidth: 290 }}>More bills than most? It may take a little longer — worth it.</p>

        <div className="exp-save" style={{ marginTop: 22 }}>
          <Icon name="check" size={14} /> Saved as you go — close anytime and you’ll pick up right here.
        </div>
      </div>
      <div className="cta-bar">
        <button className="btn btn-primary" onClick={next}>I’ve got time — let’s go</button>
      </div>
    </div>
  );
}

/* ---- voice flow data ---- */
const SAMPLES = [
  /* group 0 — essentials */
  { group: 0, provider: "Ayala Land", cat: "Rent / Mortgage", subtype: "Rent", icon: "home", amount: 18000, due: "1st", dueDays: 1,
    utter: { en: "My rent, eighteen thousand, due every 1st." }, toks: { en: ["rent", "eighteen thousand", "1st"] } },
  { group: 0, provider: "Meralco", cat: "Electricity", icon: "zap", amount: 3450, due: "15th", dueDays: 6,
    utter: { en: "My Meralco, around three thousand four fifty, due every 15th." }, toks: { en: ["Meralco", "three thousand four fifty", "15th"] } },
  { group: 0, provider: "Maynilad", cat: "Water", icon: "droplet", amount: 890, due: "22nd", dueDays: 13,
    utter: { en: "Then Maynilad water, about eight ninety, every 22nd." }, toks: { en: ["Maynilad", "eight ninety", "22nd"] } },
  { group: 0, provider: "PLDT Home", cat: "Internet", icon: "wifi", amount: 1699, due: "5th", dueDays: 25,
    utter: { en: "My PLDT internet, 1,699, on the 5th." }, toks: { en: ["PLDT", "1,699", "5th"] } },
  /* group 1 — phone, subscriptions, TV, web apps */
  { group: 1, provider: "Globe Postpaid", cat: "Mobile", icon: "smartphone", amount: 1299, due: "18th", dueDays: 8,
    utter: { en: "My Globe phone plan, 1,299, every 18th." }, toks: { en: ["Globe", "1,299", "18th"] } },
  { group: 1, provider: "iCloud+", cat: "Phone subscription", icon: "spark", amount: 149, due: "1st", dueDays: 14,
    utter: { en: "iCloud storage, 149, on the 1st." }, toks: { en: ["iCloud", "149", "1st"] } },
  { group: 1, provider: "Spotify", cat: "Phone subscription", icon: "spark", amount: 194, due: "7th", dueDays: 20,
    utter: { en: "Spotify Premium, 194, every 7th." }, toks: { en: ["Spotify", "194", "7th"] } },
  { group: 1, provider: "Netflix", cat: "TV / Streaming", icon: "spark", amount: 549, due: "28th", dueDays: 11,
    utter: { en: "Netflix, 549, on the 28th." }, toks: { en: ["Netflix", "549", "28th"] } },
  { group: 1, provider: "Disney+", cat: "TV / Streaming", icon: "spark", amount: 369, due: "12th", dueDays: 2,
    utter: { en: "Disney Plus, 369, the 12th." }, toks: { en: ["Disney", "369", "12th"] } },
  { group: 1, provider: "Canva Pro", cat: "Web app", icon: "spark", amount: 199, due: "9th", dueDays: 22,
    utter: { en: "Canva Pro, 199, every 9th." }, toks: { en: ["Canva", "199", "9th"] } }
];
/* card & loan templates — count-driven (we ask "how many?" then loop) */
const CARD_TEMPLATES = [
  { provider: "BPI Mastercard", amount: 5200, due: "20th", dueDays: 4, utter: { en: "My BPI Mastercard, 5,200 due, on the 20th." }, toks: { en: ["BPI", "5,200", "20th"] } },
  { provider: "BDO Visa", amount: 3100, due: "25th", dueDays: 9, utter: { en: "BDO Visa, around 3,100, the 25th." }, toks: { en: ["BDO", "3,100", "25th"] } },
  { provider: "Metrobank", amount: 2800, due: "10th", dueDays: 23, utter: { en: "Metrobank card, about 2,800, the 10th." }, toks: { en: ["Metrobank", "2,800", "10th"] } },
  { provider: "UnionBank", amount: 1950, due: "15th", dueDays: 6, utter: { en: "UnionBank, 1,950, every 15th." }, toks: { en: ["UnionBank", "1,950", "15th"] } }
];
const LOAN_TEMPLATES = [
  { provider: "Home Credit", amount: 2400, due: "3rd", dueDays: 16, utter: { en: "Home Credit loan, 2,400 a month, on the 3rd." }, toks: { en: ["Home Credit", "2,400", "3rd"] } },
  { provider: "Pag-IBIG", amount: 1800, due: "7th", dueDays: 20, utter: { en: "Pag-IBIG housing loan, 1,800, the 7th." }, toks: { en: ["Pag-IBIG", "1,800", "7th"] } },
  { provider: "Car loan · BPI", amount: 12500, due: "12th", dueDays: 2, utter: { en: "Car loan with BPI, 12,500, the 12th." }, toks: { en: ["BPI", "12,500", "12th"] } }
];
/* breather + save-point checkpoints shown AFTER finishing each group (except last) */
const VGROUPS = [
  { label: "The essentials", done: "Your essentials are in.", note: "Power, water, internet — the must-pays. Take a breath; this is saved.", askTitle: "Any other utilities?", askSub: "Another meter, association dues, garbage, gas?", addLabel: "Add a utility" },
  { label: "Subscriptions", done: "Subscriptions, logged.", note: "Phone, streaming, apps — the silent drainers. Saved and safe.", askTitle: "Any other subscriptions?", askSub: "Gaming, news, cloud storage, that free trial that wasn’t?", addLabel: "Add a subscription" },
  { label: "Cards & loans", done: "", note: "" }
];
const VLOCAL = {
  gotit: { fil: "Kuha ko! Ito ’yong narinig ko:", en: "Got it! Here’s what I heard:", es: "¡Entendido! Esto escuché:" },
  lblP: { fil: "Provider", en: "Provider", es: "Proveedor" },
  lblA: { fil: "Halaga", en: "Amount", es: "Monto" },
  lblD: { fil: "Due", en: "Due", es: "Vence" },
  lblC: { fil: "Kategorya", en: "Category", es: "Categoría" },
  monthly: { fil: "kada buwan", en: "monthly", es: "mensual" }
};
const MANUAL_CATS = [
  { cat: "Rent / Mortgage", icon: "home" }, { cat: "Electricity", icon: "zap" }, { cat: "Water", icon: "droplet" },
  { cat: "Internet", icon: "wifi" }, { cat: "Mobile", icon: "smartphone" }, { cat: "TV / Streaming", icon: "spark" },
  { cat: "Credit card", icon: "card" }, { cat: "Personal loan", icon: "wallet" }, { cat: "Other", icon: "plus" }
];

function hl(text, toks) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const valid = (toks || []).filter(Boolean);
  if (!valid.length) return [text];
  const re = new RegExp("(" + valid.map(esc).join("|") + ")", "gi");
  const out = []; let last = 0, m, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<span className="heard" key={k++}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function ScreenVoiceAdd({ ctx }) {
  const { T, lang, bills, addBill, next, motion, persona } = ctx;
  const cur = (ctx.country && ctx.country.cur) || "₱";
  const [mode, setMode] = useState("prompt"); // prompt | listening | parsed | manualCats | manualForm | breather | done
  const SUBKEY = "judith_voice_idx";
  const [idx, setIdx] = useState(() => { try { const s = parseInt(localStorage.getItem(SUBKEY), 10); if (s > 0 && s < SAMPLES.length) return s; } catch (e) {} return 0; });
  useEffect(() => { try { localStorage.setItem(SUBKEY, String(idx)); } catch (e) {} }, [idx]);
  const [partial, setPartial] = useState("");
  const [formCat, setFormCat] = useState(null);
  const [manualReturn, setManualReturn] = useState("prompt");
  const [form, setForm] = useState({ provider: "", amount: "", due: "", house: (typeof HOUSES !== "undefined" && HOUSES[0]) || "" });
  const [phase, setPhase] = useState("scripted"); // scripted | cards | loans
  const [breatherGroup, setBreatherGroup] = useState(0);
  const [cardN, setCardN] = useState(0); const [cardDone, setCardDone] = useState(0);
  const [loanN, setLoanN] = useState(0); const [loanDone, setLoanDone] = useState(0);
  const L = (o) => o[lang] || o.en || o.fil;
  const scriptedItem = SAMPLES[Math.min(idx, SAMPLES.length - 1)];
  const sample = phase === "cards"
    ? Object.assign({}, CARD_TEMPLATES[cardDone % CARD_TEMPLATES.length], { cat: "Credit card", icon: "card", group: 2 })
    : phase === "loans"
    ? Object.assign({}, LOAN_TEMPLATES[loanDone % LOAN_TEMPLATES.length], { cat: "Personal loan", icon: "wallet", group: 3 })
    : scriptedItem;
  const done = mode === "done";
  const fmt = (n) => n.toLocaleString("en-US");
  /* fixed vs variable — usage-based bills swing month to month */
  const VARIABLE_CATS = ["Electricity", "Water", "Mobile", "Credit card"];
  const kindFor = (cat) => (VARIABLE_CATS.indexOf(cat) >= 0 ? "Variable" : "Fixed");

  const PROMPTS = {
    "Rent / Mortgage": "Let’s start with the big one — rent or mortgage. How much, and when’s it due?",
    Electricity: "Now your electricity. Who’s the provider, how much, and when’s it due?",
    Water: "Next, your water. Provider, amount, and the due date?",
    Internet: "And your internet. Provider, amount, due date?",
    Mobile: "Now your phone plan — which carrier, how much, and when’s it due?",
    "Phone subscription": "Phone subscriptions — iCloud, Apple Music, Spotify? Name one, the cost, the date.",
    "TV / Streaming": "Streaming — Netflix, Disney+, HBO? Which one, how much, when?",
    "Web app": "Any web apps? Canva, Notion, ChatGPT… name it, the cost, the date.",
    "Credit card": "Now the heavy ones. A credit card — which bank, the amount due, and the date?",
    "Personal loan": "Any loans? Lender, the monthly amount, and the due date."
  };

  useEffect(() => {
    if (mode !== "listening") return;
    const full = L(sample.utter);
    if (!motion) { setPartial(full); const t = setTimeout(() => setMode("parsed"), 600); return () => clearTimeout(t); }
    const words = full.split(" ");
    let i = 0; setPartial("");
    const iv = setInterval(() => {
      i++; setPartial(words.slice(0, i).join(" "));
      if (i >= words.length) { clearInterval(iv); setTimeout(() => setMode("parsed"), 550); }
    }, 130);
    return () => clearInterval(iv);
  }, [mode, idx]);

  const advanceAfterItem = () => {
    setPartial("");
    if (phase === "cards") { const d = cardDone + 1; setCardDone(d); if (d >= cardN) startLoans(); else setMode("prompt"); return; }
    if (phase === "loans") { const d = loanDone + 1; setLoanDone(d); if (d >= loanN) setMode("more"); else setMode("prompt"); return; }
    const n = idx + 1; setIdx(n);
    if (n >= SAMPLES.length) { setBreatherGroup(sample.group); setMode("breather"); return; }
    if (SAMPLES[n].group !== sample.group) { setBreatherGroup(sample.group); setMode("breather"); return; }
    setMode("prompt");
  };
  const confirm = () => {
    addBill({ provider: sample.provider, cat: sample.cat, icon: sample.icon, amount: sample.amount, due: sample.due, dueDays: sample.dueDays, kind: kindFor(sample.cat), subtype: sample.subtype, house: (typeof HOUSES !== "undefined" && HOUSES[0]) || undefined });
    advanceAfterItem();
  };
  const skipOne = () => { advanceAfterItem(); };
  const startCards = () => { setPhase("cards"); setCardDone(0); setMode("count"); };
  const startLoans = () => { setPhase("loans"); setLoanDone(0); setMode("count"); };
  const chooseCount = (k) => {
    if (phase === "cards") { setCardN(k); if (k === 0) startLoans(); else { setCardDone(0); setMode("prompt"); } }
    else { setLoanN(k); if (k === 0) setMode("more"); else { setLoanDone(0); setMode("prompt"); } }
  };
  const openForm = (c) => {
    const presets = { "Rent / Mortgage": "18000", Electricity: "3450", Water: "890", Internet: "1699", Mobile: "999", "TV / Streaming": "549", "Credit card": "5200" };
    setFormCat(c); setForm({ provider: "", amount: presets[c.cat] || "", due: "", kind: kindFor(c.cat), subtype: c.cat === "Rent / Mortgage" ? "Rent" : undefined, house: (typeof HOUSES !== "undefined" && HOUSES[0]) || "" }); setMode("manualForm");
  };
  const saveForm = () => {
    addBill({ provider: form.provider || formCat.cat, cat: formCat.cat, icon: formCat.icon, amount: parseFloat(form.amount) || 0, due: form.due || "—", dueDays: 20, kind: form.kind || kindFor(formCat.cat), subtype: form.subtype, house: form.house || undefined });
    setMode(manualReturn);
  };

  const promptText = phase === "cards" ? "Card " + (cardDone + 1) + " of " + cardN + " — which bank, the amount due, and the date?"
    : phase === "loans" ? "Loan " + (loanDone + 1) + " of " + loanN + " — lender, the monthly amount, and the due date?"
    : (PROMPTS[sample.cat] || "Tell me about this bill.");

  const progress = Math.min(idx + (mode === "done" ? 0 : 1), SAMPLES.length);

  return (
    <div style={{display:"contents"}}>
      <div className="scroll screen-anim" style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="title">{done ? "All set" : "Tell Judith your bills"}</h2>
          {bills.length > 0 && (
            <span className="stack-pill"><Icon name="check" size={13} /> <b>{bills.length}</b> {T("billsCount")}</span>
          )}
        </div>
        {phase === "scripted" && !done && mode !== "manualCats" && mode !== "manualForm" && (
          <div className="va-steps">{SAMPLES.map((s, i) => <i key={i} className={i < idx ? "done" : i === idx ? "now" : ""}></i>)}<span className="low" style={{ fontSize: 11, marginLeft: 6 }}>Bill {progress} of {SAMPLES.length}</span></div>
        )}
        {(phase === "cards" || phase === "loans") && (mode === "prompt" || mode === "listening" || mode === "parsed") && (
          <div className="va-steps"><span className="low" style={{ fontSize: 11 }}>{phase === "cards" ? "Card " + (cardDone + 1) + " of " + cardN : "Loan " + (loanDone + 1) + " of " + loanN}</span></div>
        )}

        {/* conversation area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 11, marginTop: 14, minHeight: 210 }}>
          {(mode === "prompt" || mode === "listening" || mode === "parsed") && !done && (
            <div className="va-judith">
              <PersonaAvatar persona={persona} size={44} state={mode === "listening" ? "listening" : "speaking"} />
              <div className="judith-line bubble-in" key={phase + sample.cat + (phase === "cards" ? cardDone : phase === "loans" ? loanDone : "")}>{promptText}</div>
            </div>
          )}
          {mode === "count" && (
            <div style={{display:"contents"}}>
              <div className="va-judith">
                <PersonaAvatar persona={persona} size={44} state="speaking" />
                <div className="judith-line bubble-in">{phase === "cards" ? "Now the heavy hitters. How many credit cards do you have? I’ll take them one at a time." : "And loans — personal, car, housing, anything. How many?"}</div>
              </div>
              <div className="count-grid">
                {[0, 1, 2, 3, 4, 5].map((k) => (
                  <button key={k} className="count-chip" onClick={() => chooseCount(k)}>{k === 0 ? "None" : k === 5 ? "5+" : k}</button>
                ))}
              </div>
            </div>
          )}
          {(mode === "listening" || mode === "parsed") && (
            <div className="transcript bubble-in">{mode === "parsed" ? hl(L(sample.utter), L(sample.toks)) : (partial || "…")}</div>
          )}
          {mode === "parsed" && (
            <div style={{display:"contents"}}>
              <div className="judith-line bubble-in">{L(VLOCAL.gotit)}</div>
              <div className="parsed">
                <div className="pcell full" style={{ animationDelay: ".05s" }}>
                  <div className="pl">{L(VLOCAL.lblP)}</div><div className="pv">{sample.provider}</div>
                </div>
                <div className="pcell" style={{ animationDelay: ".12s" }}>
                  <div className="pl">{L(VLOCAL.lblA)}</div><div className="pv mono"><span style={{ color: "var(--accent)" }}>{cur}</span>{fmt(sample.amount)}</div>
                </div>
                <div className="pcell" style={{ animationDelay: ".19s" }}>
                  <div className="pl">{L(VLOCAL.lblD)}</div><div className="pv">{sample.due} · {L(VLOCAL.monthly)}</div>
                </div>
                <div className="pcell" style={{ animationDelay: ".26s" }}>
                  <div className="pl">Type</div><div className="pv" style={{ display: "flex", alignItems: "center", gap: 6 }}><span className={"kind-dot " + (kindFor(sample.cat) === "Variable" ? "var" : "fix")}></span>{kindFor(sample.cat)}</div>
                </div>
                <div className="pcell" style={{ animationDelay: ".33s" }}>
                  <div className="pl">{L(VLOCAL.lblC)}</div><div className="pv" style={{ display: "flex", alignItems: "center", gap: 7 }}><span className="ico" style={{ width: 24, height: 24, color: "var(--accent)", flex: "0 0 auto" }}><Icon name={sample.icon} size={14} /></span><span style={{ fontSize: 14, lineHeight: 1.1 }}>{sample.subtype || sample.cat}</span></div>
                </div>
              </div>
            </div>
          )}
          {done && (
            <div className="va-done">
              <PersonaAvatar persona={persona} size={72} state="idle" />
              <div className="judith-line bubble-in" style={{ marginTop: 12 }}>That’s everything — utilities, subscriptions, cards and loans. Now you can see the whole picture.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
                {bills.slice(0, 12).map((b, i) => (
                  <div key={i} className="bill-row" style={{ cursor: "default" }}>
                    <span className="ico" style={{ width: 30, height: 30, color: "var(--accent)" }}><Icon name={b.icon} size={15} /></span>
                    <div className="meta"><div className="p">{b.provider}</div><div className="d">{b.cat} · {b.due}</div></div>
                    <span className="mono amt">{cur}{fmt(b.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* breather + save point between groups */}
          {mode === "breather" && (() => {
            const g = VGROUPS[breatherGroup] || VGROUPS[0];
            const total = bills.reduce((s, b) => s + (b.amount || 0), 0);
            return (
              <div className="va-done">
                <PersonaAvatar persona={persona} size={68} state="speaking" />
                <div className="kicker" style={{ marginTop: 12 }}>{g.label} ✓</div>
                <h2 className="title" style={{ fontSize: 22, marginTop: 2 }}>{g.done}</h2>
                <div className="va-total">
                  <div className="low" style={{ fontSize: 12 }}>Logged so far · {bills.length} bills</div>
                  <div className="mono" style={{ fontSize: 30, fontWeight: 700 }}>{cur}{fmt(total)}<span className="low" style={{ fontSize: 13, fontWeight: 400 }}>/mo</span></div>
                </div>
                <div className="va-ask">
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{g.askTitle}</div>
                  <div className="low" style={{ fontSize: 12, marginTop: 2 }}>{g.askSub}</div>
                </div>
                <div className="exp-save" style={{ marginTop: 10 }}><Icon name="check" size={14} /> Saved — you can stop here and pick up later.</div>
              </div>
            );
          })()}

          {mode === "more" && (() => {
            const total = bills.reduce((s, b) => s + (b.amount || 0), 0);
            return (
              <div className="va-done">
                <PersonaAvatar persona={persona} size={68} state="speaking" />
                <div className="judith-line bubble-in" style={{ marginTop: 12 }}>That’s {bills.length} so far — {cur}{fmt(total)}/mo. Any more cards, loans, or anything else? Gym, insurance, tuition? Let’s not miss any.</div>
              </div>
            );
          })()}

          {/* manual category picker */}
          {mode === "manualCats" && (
            <div style={{ alignSelf: "stretch", marginTop: 4 }}>
              <p className="lede" style={{ marginTop: 0 }}>Pick a category to log.</p>
              <div className="grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9 }}>
                {MANUAL_CATS.map((c) => (
                  <div key={c.cat} className="card" onClick={() => openForm(c)} style={{ cursor: "pointer", padding: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 7, textAlign: "center" }}>
                    <span className="ico" style={{ color: "var(--accent)" }}><Icon name={c.icon} size={17} /></span>
                    <div style={{ fontSize: 12 }}>{c.cat}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* manual log-a-bill form */}
          {mode === "manualForm" && formCat && (
            <div style={{ alignSelf: "stretch", marginTop: 4 }}>
              <div className="va-formhead">
                <span className="ico" style={{ width: 34, height: 34, color: "var(--accent)" }}><Icon name={formCat.icon} size={18} /></span>
                <div><div style={{ fontWeight: 600 }}>Log a {formCat.cat.toLowerCase()} bill</div><div className="low" style={{ fontSize: 12 }}>{formCat.cat}</div></div>
              </div>
              <div className="field" style={{ marginTop: 14 }}><label>Provider</label>
                <input className="search" placeholder={"e.g. " + (formCat.cat === "Electricity" ? "Meralco" : formCat.cat === "Water" ? "Maynilad" : "your provider")} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
              </div>
              <div className="two" style={{ marginTop: 10 }}>
                <div className="field"><label>Amount</label>
                  <input className="search mono" inputMode="numeric" placeholder={cur + " 0"} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^0-9.]/g, "") })} />
                </div>
                <div className="field"><label>Due date</label>
                  <input className="search" placeholder="e.g. 15th" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
                </div>
              </div>
              <div className="two" style={{ marginTop: 10 }}>
                <div className="field"><label>Category</label>
                  <select className="search" value={formCat.cat} onChange={(e) => { const c = MANUAL_CATS.find((x) => x.cat === e.target.value) || formCat; setFormCat(c); setForm({ ...form, kind: kindFor(c.cat), subtype: c.cat === "Rent / Mortgage" ? (form.subtype || "Rent") : undefined }); }}>
                    {MANUAL_CATS.map((c) => <option key={c.cat} value={c.cat}>{c.cat}</option>)}
                  </select>
                </div>
                <div className="field"><label>Type</label>
                  <div className="seg-ctl wide">
                    <button className={form.kind === "Fixed" ? "on" : ""} onClick={() => setForm({ ...form, kind: "Fixed" })}>Fixed</button>
                    <button className={form.kind === "Variable" ? "on" : ""} onClick={() => setForm({ ...form, kind: "Variable" })}>Variable</button>
                  </div>
                </div>
              </div>
              {formCat.cat === "Rent / Mortgage" && (
                <div className="field" style={{ marginTop: 10 }}><label>Rent or mortgage?</label>
                  <div className="seg-ctl wide">
                    <button className={form.subtype === "Rent" ? "on" : ""} onClick={() => setForm({ ...form, subtype: "Rent" })}>Rent</button>
                    <button className={form.subtype === "Mortgage" ? "on" : ""} onClick={() => setForm({ ...form, subtype: "Mortgage" })}>Mortgage</button>
                  </div>
                </div>
              )}
              {typeof HOUSES !== "undefined" && HOUSES.length > 1 && (
                <div className="field" style={{ marginTop: 10 }}><label>Which home?</label>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {HOUSES.map((h) => (
                      <button key={h} className={"chip" + (form.house === h ? " sel" : "")} onClick={() => setForm({ ...form, house: h })}>{h}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* control zone (mic states) */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 6 }}>
          {mode === "listening" && <p className="lede" style={{ textAlign: "center", margin: 0, color: "var(--accent)" }}>{T("listening")}</p>}
        </div>
      </div>

      {/* CTA zone */}
      <div className="cta-bar">
        {mode === "prompt" && (
          <div style={{display:"contents"}}>
            <button className="mic-btn" onClick={() => setMode("listening")}><Icon name="mic" size={28} /></button>
            <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 2 }}>
              <span className="btn-ghost" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }} onClick={() => { setManualReturn("prompt"); setMode("manualCats"); }}><Icon name="keyboard" size={15} /> {T("tapInstead")}</span>
              <span className="btn-ghost" style={{ cursor: "pointer" }} onClick={skipOne}>I don’t have this →</span>
            </div>
          </div>
        )}
        {mode === "listening" && <button className="mic-btn live"><Icon name="mic" size={28} /></button>}
        {mode === "parsed" && (
          <div style={{display:"contents"}}>
            <p style={{ textAlign: "center", margin: "0 0 2px", fontSize: 14, color: "var(--txt-mid)" }}>{T("confirmQ")}</p>
            <button className="btn btn-primary" onClick={confirm}>{T("yes")}</button>
            <button className="btn btn-soft" onClick={() => { setMode("listening"); }}>{T("edit")}</button>
          </div>
        )}
        {mode === "manualCats" && (
          <button className="btn btn-ghost" onClick={() => setMode(manualReturn)}>← Back</button>
        )}
        {mode === "manualForm" && (
          <div style={{display:"contents"}}>
            <button className="btn btn-primary" onClick={saveForm}>Log this bill</button>
            <button className="btn btn-ghost" onClick={() => setMode("manualCats")}>← Categories</button>
          </div>
        )}
        {mode === "breather" && (() => {
          const g = VGROUPS[breatherGroup] || VGROUPS[0];
          return (
            <div style={{display:"contents"}}>
              <button className="btn btn-soft" onClick={() => { setManualReturn("breather"); setMode("manualCats"); }}><Icon name="plus" size={17} /> {g.addLabel}</button>
              <button className="btn btn-primary" onClick={() => { if (breatherGroup === 1) startCards(); else setMode("prompt"); }}>Keep going →</button>
            </div>
          );
        })()}
        {mode === "more" && (
          <div style={{display:"contents"}}>
            <button className="btn btn-primary" onClick={() => { setManualReturn("more"); setMode("manualCats"); }}><Icon name="plus" size={18} /> Yes, add another</button>
            <button className="btn btn-soft" onClick={() => { try { localStorage.removeItem("judith_voice_idx"); } catch (e) {} setMode("done"); }}>No, that’s everything</button>
          </div>
        )}
        {mode === "done" && (
          <button className="btn btn-primary" onClick={() => { try { localStorage.removeItem("judith_voice_idx"); } catch (e) {} next(); }}>See my bill picture →</button>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { ScreenProblem, ScreenStakes, ScreenIntro, ScreenVoiceAdd, SAMPLES });

/* Last problem-staging beat: "keep going this way?" — a stark fork before the
   solution. Tapping the resolve CTA fires a dramatic transition to the intro. */
function ScreenStakes({ ctx }) {
  const { next, record } = ctx;
  const cur = (ctx.country && ctx.country.cur) || "₱";
  return (
    <div style={{ display: "contents" }}>
      <div className="scroll center screen-anim" style={{ textAlign: "center", alignItems: "center", gap: 0 }}>
        <div className="kicker">The fork</div>
        <h1 className="title" style={{ maxWidth: 300 }}>What if you keep going this way?</h1>
        <div className="fork-split">
          <div className="fork-side bad">
            <div className="fork-label">Keep going</div>
            <span className="ico" style={{ color: "var(--urgent)", borderColor: "color-mix(in oklab,var(--urgent) 40%,transparent)" }}><Icon name="trenddown" size={20} /></span>
            <div className="fork-amt mono">−{cur}4,800+</div>
            <div className="fork-sub">more fees, every year</div>
            <div className="fork-face anx"><Icon name="faceAnxious" size={30} /></div>
            <div className="fork-mood">Anxious, always behind</div>
          </div>
          <div className="fork-or">or</div>
          <div className="fork-side good">
            <div className="fork-label">Start today</div>
            <span className="ico" style={{ color: "var(--ok)", borderColor: "color-mix(in oklab,var(--ok) 40%,transparent)" }}><Icon name="check" size={20} /></span>
            <div className="fork-amt mono" style={{ color: "var(--ok)" }}>{cur}0</div>
            <div className="fork-sub">in late fees</div>
            <div className="fork-face calm"><Icon name="faceCalm" size={30} /></div>
            <div className="fork-mood">Calm, in control</div>
          </div>
        </div>
      </div>
      <div className="cta-bar">
        <button className="btn btn-primary" onClick={() => { record && record("committed", true); next(); }}>No — let’s fix this</button>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenStakes });
