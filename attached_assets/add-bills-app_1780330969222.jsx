/* add-bills-app.jsx — Judith · Add Bills (hi-fi, Option A) */
const { useState, useEffect, useRef } = React;

/* ---- accent candidates: matched lightness/chroma, varied hue ---- */
const ACCENTS = [
  "oklch(0.74 0.16 295)", // electric violet
  "oklch(0.78 0.15 168)", // acid mint
  "oklch(0.72 0.16 245)"  // signal blue
];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "oklch(0.74 0.16 295)",
  "glow": 100,
  "density": "regular",
  "motion": true,
  "sheetOpen": true
}/*EDITMODE-END*/;

/* ---- monoline icons (lucide-style paths) ---- */
function Icon({ name }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    zap: <path d="M13 2 3 14h9l-1 8 10-12h-9z" />,
    droplet: <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />,
    wifi: <g><path d="M2 8.5a16 16 0 0 1 20 0" /><path d="M5 12.5a11 11 0 0 1 14 0" /><path d="M8.5 16.2a6 6 0 0 1 7 0" /><circle cx="12" cy="20" r="0.6" fill="currentColor" stroke="none" /></g>,
    smartphone: <g><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></g>,
    phone: <path d="M14 16.5a1 1 0 0 0 1.2-.3l.4-.5a2 2 0 0 1 1.6-.7h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.5.4a1 1 0 0 0-.3 1.2 14 14 0 0 0 6.4 6.3z" />,
    card: <g><rect x="2" y="5" width="20" height="14" rx="2.5" /><path d="M2 10h20" /></g>,
    plus: <g><path d="M12 5v14" /><path d="M5 12h14" /></g>
  };
  return <svg {...common}>{paths[name]}</svg>;
}

/* ---- count-up for the ₱ amount ---- */
function useCountUp(target, run) {
  const [v, setV] = useState(run ? 0 : target);
  useEffect(() => {
    if (!run) { setV(target); return; }
    let raf, start;
    const dur = 900;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, run]);
  return v;
}

const CATEGORIES = [
  { name: "Electricity", icon: "zap", count: 1, sub: "Meralco" },
  { name: "Water", icon: "droplet" },
  { name: "Internet", icon: "wifi", count: 2, sub: "PLDT · Converge" },
  { name: "Mobile", icon: "smartphone" },
  { name: "Landline", icon: "phone" },
  { name: "Credit card", icon: "card" }
];

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [sheetCat, setSheetCat] = useState("Electricity");
  const [open, setOpen] = useState(t.sheetOpen);

  /* apply theme tweaks to document */
  useEffect(() => {
    document.documentElement.style.setProperty("--accent", t.accent);
    document.documentElement.style.setProperty("--glow", String(t.glow / 100));
    document.body.dataset.density = t.density;
    document.body.classList.toggle("reduce-motion", !t.motion);
  }, [t.accent, t.glow, t.density, t.motion]);

  useEffect(() => { setOpen(t.sheetOpen); }, [t.sheetOpen]);

  const amount = useCountUp(3450, open && t.motion);
  const fmt = (n) => n.toLocaleString("en-PH");

  const openSheet = (name) => { setSheetCat(name); setOpen(true); };

  return (
    <React.Fragment>
      <div className="phone">
        <div className="screen">
          {/* status bar */}
          <div className="statusbar">
            <span>9:41</span>
            <span className="ico-row">
              <span className="bars"><i></i><i></i><i></i><i></i></span>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".02em" }}>5G</span>
              <span className="batt"></span>
            </span>
          </div>

          {/* nav + progress */}
          <div className="nav">
            <div className="iconbtn">‹</div>
            <div className="progress"><i className="done"></i><i className="done"></i><i className="now"></i><i></i></div>
            <span className="skip">Skip</span>
          </div>

          {/* scroll content */}
          <div className="scroll">
            <div className="head">
              <div className="orb-wrap">
                <div className="orb-glow"></div>
                <div className="ring"></div>
                <div className="ring r2"></div>
                <div className="orb"></div>
              </div>
              <div className="htext">
                <div className="kicker">Step 3 · Bills</div>
                <div className="t">Anong bills ang babantayan natin?</div>
                <div className="s">Pwede mahigit isa bawat category — i-tap lang.</div>
              </div>
            </div>

            <div className="grid">
              {CATEGORIES.map((c, i) => (
                <div
                  key={c.name}
                  className={"tile" + (c.count ? " sel" : "")}
                  style={{ animationDelay: (0.05 + i * 0.05) + "s" }}
                  onClick={() => openSheet(c.name)}
                >
                  {c.count ? <span className="badge">{c.count}</span> : null}
                  <div className="ico"><Icon name={c.icon} /></div>
                  <div>
                    <div className="lbl">{c.name}</div>
                    <div className="sub">{c.count ? c.sub : "Tap to add"}</div>
                  </div>
                </div>
              ))}
              <div
                className="tile add"
                style={{ animationDelay: (0.05 + CATEGORIES.length * 0.05) + "s" }}
                onClick={() => openSheet("Custom")}
              >
                <div className="ico"><Icon name="plus" /></div>
                <div className="lbl">Custom</div>
              </div>
            </div>

            <div className="scrollcue">3 bills added · ₱4,340 / buwan</div>
          </div>

          {/* bottom sheet */}
          <div className={"scrim" + (open ? " show" : "")} onClick={() => setOpen(false)}></div>
          <div className={"sheet" + (open ? " show" : "")}>
            <div className="grab"></div>
            <div className="sheet-head">
              <div className="title">
                Magdagdag ng bill
                <span className="ctx-pill">{sheetCat}</span>
              </div>
              <div className="close" onClick={() => setOpen(false)}>✕</div>
            </div>

            <div className="field">
              <label>Provider</label>
              <div className="control placeholder">
                <span>e.g. Meralco</span>
                <span className="chev">⌄</span>
              </div>
            </div>

            <div className="two">
              <div className="field">
                <label>Amount</label>
                <div className="control amount-control active">
                  <span className="peso">₱</span>
                  <span className="val mono">{fmt(amount)}</span>
                </div>
              </div>
              <div className="field">
                <label>Due date</label>
                <div className="control">
                  <span>Every 15th</span>
                  <span className="chev">⌄</span>
                </div>
              </div>
            </div>

            <div className="field">
              <label>Remind me</label>
              <div className="control">
                <span>3 days before</span>
                <span className="chev">⌄</span>
              </div>
            </div>

            <div className="due-preview">
              <span className="dot near"></span>
              Next due Jun 15 · <span className="mono" style={{ marginLeft: 4 }}>6 days away</span>
            </div>

            <button className="save" onClick={() => setOpen(false)}>I-save ang bill</button>
          </div>

          <div className="homebar"></div>
        </div>
      </div>

      <div className="caption">
        Judith · <b>Add Bills</b> — hi-fi from wireframe A &nbsp;·&nbsp; pick an accent in Tweaks
      </div>

      <TweaksPanel>
        <TweakSection label="Brand accent" />
        <TweakColor
          label="Electric accent"
          value={t.accent}
          options={ACCENTS}
          onChange={(v) => setTweak("accent", v)}
        />
        <TweakSlider label="Orb glow" value={t.glow} min={0} max={160} unit="%"
          onChange={(v) => setTweak("glow", v)} />

        <TweakSection label="Layout & motion" />
        <TweakRadio label="Density" value={t.density}
          options={["compact", "regular", "comfy"]}
          onChange={(v) => setTweak("density", v)} />
        <TweakToggle label="Animations" value={t.motion}
          onChange={(v) => setTweak("motion", v)} />
        <TweakToggle label="Add-bill sheet open" value={t.sheetOpen}
          onChange={(v) => setTweak("sheetOpen", v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
