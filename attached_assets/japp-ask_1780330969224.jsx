/* japp-ask.jsx — Ask Judith (live AI) */

const TONE = {
  pro: "professional, clear and calm",
  funny: "playful, warm and a little funny",
  sib: "cheeky, blunt and sarcastic but secretly caring",
  mama: "caring and warm, a little naggy like a Filipino mom"
};

/* persona-flavored deflection when the user asks something off-topic */
const DEFLECT = {
  pro: (food) => `That’s outside my lane — I only handle your bills and due dates. But ask me anything about those and I’m all yours.`,
  funny: (food) => `Ha! I’d love to help with ${food}, but I only know one thing: your bills. Ask me about those instead? 🍲`,
  sib: (food) => `A ${food} recipe? From your bill app? Nice try. Ask me about your due dates — that I can do.`,
  mama: (food) => `Anak, I’m here for your bills, not ${food} recipes. Ask me when your next one is due, ha?`
};

const BILL_WORDS = /bill|due|owe|owed|pay|paid|payment|total|month|week|today|tomorrow|balance|card|loan|rent|mortgage|electric|water|internet|mobile|subscription|netflix|spotify|meralco|when|how much|magkano|cost|charge|fee|money|budget|afford|salary|spend/i;

function buildPrompt(persona, bills, q, cur, food) {
  const due = bills.filter((b) => b.status !== "paid");
  const total = due.reduce((s, b) => s + b.amount, 0);
  const ctxStr = bills.map((b) => `${b.provider} (${b.cat}): ${cur}${b.amount}, due ${b.dueLabel} in ${b.dueDays} days, ${b.status}`).join("; ");
  return `You are Judith, a friendly bill-reminder voice assistant. Your personality is ${TONE[persona] || TONE.pro}. Today is June 1, 2026. Total still due this month: ${cur}${total}. The user's bills are: ${ctxStr}. Answer the user's question in 1-3 short spoken-style sentences, in English, conversational and on-brand for your personality. Always write money as ${cur} with no decimals. ONLY talk about the user's bills, due dates, totals, payments and money reminders. If the user asks anything unrelated (recipes like ${food}, weather, trivia, jokes), do NOT answer it — politely and in-character refuse and steer them back to their bills in one sentence. Do not use markdown. User asked: "${q}". Judith:`;
}

function AskTab({ ctx }) {
  const { bills, asks, subscribed, tier, persona, addAsks, openPacks } = ctx;
  const cur = (ctx.country && ctx.country.cur) || "₱";
  const food = (typeof countryFood === "function" ? countryFood(ctx) : "dinner");
  const unlimited = tier === "pro";
  const locked = !unlimited && asks <= 0;
  const lowAsks = !unlimited && asks > 0 && asks <= 3;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef(null);
  const started = messages.length > 0 || busy;
  const p = PERSONAS.find((x) => x.id === persona) || PERSONAS[0];
  const greeting = (p.line && (p.line.en || p.line.fil)) || "Hi, I’m Judith.";

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  const ask = async (text) => {
    const q = (text || "").trim();
    if (!q || busy) return;
    if (locked) { openPacks(); return; }
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    if (!unlimited) addAsks(-1);
    setBusy(true);
    let reply = "";
    try {
      reply = await window.claude.complete(buildPrompt(persona, bills, q, cur, food));
    } catch (e) {
      reply = "";
    }
    if (!reply || !reply.trim()) {
      /* offline fallback — deflect off-topic, else answer next-due */
      if (!BILL_WORDS.test(q)) {
        reply = (DEFLECT[persona] || DEFLECT.pro)(food);
      } else {
        const due = bills.filter((b) => b.status !== "paid").sort((a, b) => a.dueDays - b.dueDays)[0];
        reply = due ? `Your next bill is ${due.provider} — ${cur}${Math.round(due.amount).toLocaleString("en-US")}, due ${due.dueLabel}.` : "You're all caught up — nothing due right now.";
      }
    }
    setMessages((m) => [...m, { role: "judith", text: reply.trim() }]);
    setBusy(false);
  };

  const doMic = () => {
    if (busy || locked) { if (locked) openPacks(); return; }
    setListening(true);
    setTimeout(() => {
      setListening(false);
      const q = QUICK_ASKS[Math.floor(Math.random() * QUICK_ASKS.length)];
      ask(q);
    }, 1400);
  };

  const orbState = listening ? "listening" : busy ? "speaking" : "idle";

  return (
    <div style={{ display: "contents" }}>
      <div className="pagepad" style={{ display: "flex", flexDirection: "column", height: "100%", paddingBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, marginBottom: 6 }}>
          <h1 className="h">Ask Judith</h1>
          <span className={"pill" + (lowAsks ? " warn" : "")} onClick={openPacks}>{unlimited ? <React.Fragment><Icon name="star" size={13} /> <b>Unlimited</b></React.Fragment> : <React.Fragment><Icon name="spark" size={13} /> <b>{asks}</b> asks</React.Fragment>}</span>
        </div>

        {!started ? (
          locked ? (
            <div className="view-anim" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center", padding: "0 8px" }}>
              <div className="ask-lock-ring"><JudithAvatar persona={persona} size={108} state="idle" /><span className="ask-lock-badge"><Icon name="spark" size={15} /></span></div>
              <div>
                <div style={{ fontSize: 19, fontWeight: 700 }}>You’re out of free asks</div>
                <div className="muted" style={{ fontSize: 14, marginTop: 6, maxWidth: 270 }}>Reminders and bill tracking stay free forever. To keep asking Judith out loud, pick a plan.</div>
              </div>
              <button className="btn btn-primary" style={{ maxWidth: 280 }} onClick={openPacks}>See plans · {cur}99/mo</button>
            </div>
          ) : (
            <div className="view-anim" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, textAlign: "center" }}>
              <JudithAvatar persona={persona} size={132} state={orbState} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{listening ? "Listening…" : "Hi, I’m Judith"}</div>
                <div className="muted" style={{ fontSize: 14, marginTop: 4, maxWidth: 270 }}>{listening ? "Go ahead…" : greeting}</div>
                {!listening && <div className="low" style={{ fontSize: 12, marginTop: 10 }}>{unlimited ? "Ask as much as you like." : "Each answer uses one ask · " + asks + " left"}</div>}
              </div>
            </div>
          )
        ) : (
          <div ref={scrollRef} className="tabview" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 11, padding: "10px 2px" }}>
            {messages.map((m, i) => (
              m.role === "user"
                ? <div key={i} className="transcript bubble-in">{m.text}</div>
                : <div key={i} className="judith-msg bubble-in"><JudithAvatar persona={persona} size={30} state="idle" /><div className="judith-line">{m.text}</div></div>
            ))}
            {busy && <div className="judith-msg bubble-in"><JudithAvatar persona={persona} size={30} state="speaking" /><div className="judith-line typing"><i></i><i></i><i></i></div></div>}
            {locked && !busy && (
              <div className="ask-inline-lock">
                <div style={{ fontWeight: 600, fontSize: 14 }}>That was your last free ask</div>
                <div className="low" style={{ fontSize: 12.5, marginTop: 3 }}>Go Judith+ for more — {cur}99/mo for 50 asks, or {cur}199 unlimited.</div>
                <button className="btn btn-primary" style={{ marginTop: 11 }} onClick={openPacks}>See plans</button>
              </div>
            )}
          </div>
        )}

        {/* quick asks */}
        {!locked && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "10px 0", margin: "0 -2px" }}>
            {QUICK_ASKS.map((qa, i) => (
              <span key={i} className="chip" onClick={() => ask(qa)} style={{ flex: "0 0 auto", opacity: busy ? 0.5 : 1 }}>{qa}</span>
            ))}
          </div>
        )}

        {/* input + mic */}
        <div className="askinput">
          <input className="control" placeholder={locked ? "Out of asks — upgrade to keep asking" : "Type a question…"} value={input} disabled={locked}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") ask(input); }} />
          <button className={"mic-btn" + (listening ? " live" : "") + (locked ? " locked" : "")} onClick={doMic}><Icon name={locked ? "spark" : "mic"} size={24} /></button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AskTab });
