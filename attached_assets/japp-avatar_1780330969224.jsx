/* japp-avatar.jsx — Judith as a female persona avatar (replaces the orb).
   A clean, designed silhouette portrait on a persona-tinted disc — same
   face/body, wardrobe + hair differ per persona. No upload dropzone. */

const PERSONA_LOOKS = {
  pro:   { g1: "oklch(0.72 0.13 280)", g2: "oklch(0.4 0.12 285)", hair: "bun",   label: "Professional" },
  funny: { g1: "oklch(0.79 0.14 65)",  g2: "oklch(0.52 0.15 35)", hair: "waves", label: "Funny friend" },
  sib:   { g1: "oklch(0.75 0.11 195)", g2: "oklch(0.44 0.09 220)", hair: "down",  label: "Sarcastic" },
  mama:  { g1: "oklch(0.77 0.1 12)",   g2: "oklch(0.48 0.12 350)", hair: "clip",  label: "Mama mo" }
};

/* simple white silhouette built from basic shapes; hair variant per persona */
function JudithFigure({ hair }) {
  const W = "rgba(255,255,255,0.92)";   // skin/face mass
  const C = "rgba(255,255,255,0.82)";   // clothing
  const H = "rgba(255,255,255,0.6)";    // hair layer
  return (
    <g>
      {/* shoulders / clothing */}
      <path d="M14 102 C14 80 30 71 50 71 C70 71 86 80 86 102 Z" fill={C} />
      {/* collar hint */}
      <path d="M42 72 L50 84 L58 72 Z" fill="rgba(0,0,0,0.10)" />
      {/* neck */}
      <rect x="44.5" y="56" width="11" height="17" rx="5.5" fill={W} />
      {/* hair back layer (varies) */}
      {hair === "down" && <path d="M28 46 C28 28 38 22 50 22 C62 22 72 28 72 46 L72 66 L66 66 L66 44 C66 32 60 28 50 28 C40 28 34 32 34 44 L34 66 L28 66 Z" fill={H} />}
      {hair === "waves" && <path d="M27 44 C27 27 37 21 50 21 C63 21 73 27 73 44 C73 52 70 56 70 56 C72 46 68 31 50 31 C32 31 28 46 30 56 C30 56 27 52 27 44 Z" fill={H} />}
      {/* head */}
      <circle cx="50" cy="42" r="18.5" fill={W} />
      {/* hair top (varies) */}
      <path d="M31 42 C31 26 40 22 50 22 C60 22 69 26 69 42 C64 31 57 28 50 28 C43 28 36 31 31 42 Z" fill={H} />
      {hair === "bun" && <circle cx="50" cy="21" r="6.5" fill={H} />}
      {hair === "clip" && <rect x="64" y="33" width="6" height="6" rx="1.5" fill="rgba(255,255,255,0.85)" />}
      {hair === "waves" && <g><circle cx="30" cy="48" r="5.5" fill={H} /><circle cx="70" cy="48" r="5.5" fill={H} /></g>}
      {hair === "down" && <circle cx="66" cy="46" r="2.6" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.6" />}
    </g>
  );
}

/* Curated FEMALE avatar looks (DiceBear, license-free, render as <img>).
   Each look pins a style + a seed verified to render feminine, so Judith
   always reads as a woman. Photo looks get a colorful gradient backdrop so
   she feels friendly + bright. "minimal" = the CSS silhouette (no network). */
const JUDITH_LOOKS = [
  { id: "warm",    label: "Warm",    style: "adventurer", seed: "Valentina", bg: "ffdfbf,ffd5dc" },
  { id: "classic", label: "Classic", style: "lorelei",    seed: "Valentina", bg: "d1d4f9,b6e3f4" },
  { id: "bright",  label: "Bright",  style: "avataaars",  seed: "Jocelyn",   bg: "ffd5dc,b6e3f4" },
  { id: "orchid",  label: "Orchid",  style: "personas",   seed: "Destiny",   bg: "ffd5dc,c0aede" },
  { id: "aqua",    label: "Aqua",    style: "micah",      seed: "Amaya",     bg: "b6e3f4,d1d4f9" },
  { id: "modern",  label: "Modern",  style: "dylan",      seed: "Maria",     bg: "ffdfbf,d1fae5" },
  { id: "inked",   label: "Inked",   style: "notionists", seed: "Nala",      bg: "d1d4f9,ffd5dc" },
  { id: "blossom", label: "Blossom", style: "avataaars",  seed: "Eliza",     bg: "ffd5dc,c0aede" },
  { id: "bold",    label: "Bold",    style: "open-peeps", seed: "Destiny",   bg: "ffdfbf,b6e3f4" },
  { id: "cool",    label: "Cool",    style: "personas",   seed: "Maya",      bg: "c0aede,b6e3f4" },
  { id: "minimal", label: "Minimal", style: "minimal",    seed: "",          bg: "" }
];
if (typeof window.__judithLook === "undefined") window.__judithLook = "aqua";

function lookById(id) { return JUDITH_LOOKS.find((l) => l.id === id) || JUDITH_LOOKS[0]; }

function dicebearURL(look) {
  const bg = look.bg || "transparent";
  const type = look.bg ? "&backgroundType=gradientLinear" : "";
  return "https://api.dicebear.com/9.x/" + look.style + "/svg?seed=" + encodeURIComponent(look.seed) +
    "&backgroundColor=" + bg + type + "&radius=50";
}

function JudithAvatar({ persona = "pro", size = 56, state = "idle", badge }) {
  const look = PERSONA_LOOKS[persona] || PERSONA_LOOKS.pro;
  const chosen = lookById(window.__judithLook || "elegant");
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  style["--pg1"] = look.g1;
  style["--pg2"] = look.g2;
  const usePhoto = chosen.style !== "minimal" && !failed;
  return (
    <div className={"javatar " + state} style={style}>
      <span className="javatar-halo"></span>
      {state === "listening" && <span className="javatar-pulse"></span>}
      {state === "listening" && <span className="javatar-pulse p2"></span>}
      <span className="javatar-disc">
        {usePhoto ? (
          <img className="javatar-photo" src={dicebearURL(chosen)} alt="Judith"
            onError={() => setFailed(true)} draggable="false" />
        ) : (
          <svg className="javatar-fig" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <JudithFigure hair={look.hair} />
          </svg>
        )}
      </span>
      {state === "speaking" && <span className="javatar-wave"><i></i><i></i><i></i><i></i><i></i></span>}
      {badge && <span className="javatar-badge"><Icon name="mic" size={Math.max(11, Math.round(size * 0.22))} /></span>}
    </div>
  );
}

Object.assign(window, { PERSONA_LOOKS, JUDITH_LOOKS, lookById, JudithFigure, JudithAvatar, dicebearURL });

/* Per-persona STYLING of the SAME Judith. We keep the chosen look's style +
   seed (so it's literally the same face) and only overlay persona params —
   expression, glasses, hair, shirt color. Same person, four moods. */
const PERSONA_PARAMS = {
  micah: { /* the locked "Aqua" Judith — keep her short hair (no hair override) */
    pro:   "mouth=smile&glasses=square&glassesProbability=100&shirt=collared&shirtColor=6690cc",
    funny: "mouth=laughing&eyes=smiling&shirt=crew&shirtColor=ff8a5b&glassesProbability=0",
    sib:   "mouth=smirk&eyes=eyesShadow&eyebrows=up&shirt=open&shirtColor=2fb39b&glassesProbability=0",
    mama:  "mouth=smile&glasses=round&glassesProbability=100&hairColor=b7b7b7&shirt=collared&shirtColor=c77dab"
  }
};
const PERSONA_BG = {
  pro: "d1d4f9,b6e3f4", funny: "ffdfbf,ffd5dc", sib: "b8e6dd,b6e3f4", mama: "ffd5dc,f3d1e6"
};
function personaFaceURL(persona, mood) {
  const look = lookById(window.__judithLook || "aqua");
  if (look.style === "minimal") return null;
  let overlay = (PERSONA_PARAMS[look.style] && PERSONA_PARAMS[look.style][persona]) || "";
  const moodExpr = (look.style === "micah" && MOOD_EXPR[mood]) || "";
  if (moodExpr) overlay = overlay.replace(/mouth=[^&]*/g, "").replace(/eyes=[^&]*/g, "") + "&" + moodExpr;
  overlay = overlay.replace(/&+/g, "&").replace(/^&|&$/g, "");
  const bg = PERSONA_BG[persona] || (look.bg || "transparent");
  return "https://api.dicebear.com/9.x/" + look.style + "/svg?seed=" + encodeURIComponent(look.seed) +
    "&radius=50&backgroundType=gradientLinear&backgroundColor=" + bg + (overlay ? "&" + overlay : "");
}

/* positive moods — same Judith, different angle + expression per screen so she
   never feels monotonous. Pass mood="joy"|"warm"|"proud"|"wink"|"gentle". */
const MOOD_EXPR = {
  joy:    "mouth=laughing&eyes=smiling",
  warm:   "mouth=smile&eyes=smiling",
  proud:  "mouth=smile&eyes=eyesShadow",
  wink:   "mouth=smirk&eyes=round",
  gentle: "mouth=smile&eyes=smilingShadow"
};
const MOOD_POSE = {
  joy:    { transform: "scale(1.16) rotate(-4deg) translateX(3%)", objectPosition: "44% 16%" },
  warm:   { transform: "scale(1.06)", objectPosition: "50% 20%" },
  proud:  { transform: "scale(1.1) rotate(3deg)", objectPosition: "54% 18%" },
  wink:   { transform: "scaleX(-1) scale(1.13) rotate(3deg)", objectPosition: "46% 18%" },
  gentle: { transform: "scale(1.2) translateY(3%)", objectPosition: "50% 28%" }
};

function PersonaAvatar({ persona = "pro", size = 64, state = "idle", mood }) {
  const look = PERSONA_LOOKS[persona] || PERSONA_LOOKS.pro;
  const url = personaFaceURL(persona, mood);
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  style["--pg1"] = look.g1;
  style["--pg2"] = look.g2;
  /* angle/stance — mood drives it if given, else persona default */
  const personaPose = {
    pro:   { transform: "scale(1.04)", objectPosition: "50% 22%" },
    funny: { transform: "scale(1.16) rotate(-5deg) translateX(4%)", objectPosition: "42% 18%" },
    sib:   { transform: "scaleX(-1) scale(1.12) rotate(4deg)", objectPosition: "55% 20%" },
    mama:  { transform: "scale(1.22) translateY(4%)", objectPosition: "50% 30%" }
  }[persona] || {};
  const pose = (mood && MOOD_POSE[mood]) || personaPose;
  const imgStyle = { transform: pose.transform, objectPosition: pose.objectPosition, transformOrigin: "center 30%" };
  return (
    <div className={"javatar " + state} style={style}>
      <span className="javatar-halo"></span>
      {state === "listening" && <span className="javatar-pulse"></span>}
      {state === "listening" && <span className="javatar-pulse p2"></span>}
      <span className="javatar-disc">
        {url && !failed ? (
          <img className="javatar-photo" src={url} alt="Judith" style={imgStyle} onError={() => setFailed(true)} draggable="false" />
        ) : (
          <svg className="javatar-fig" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><JudithFigure hair={look.hair} /></svg>
        )}
      </span>
      {state === "speaking" && <span className="javatar-wave"><i></i><i></i><i></i><i></i><i></i></span>}
    </div>
  );
}

Object.assign(window, { PERSONA_PARAMS, PERSONA_BG, MOOD_EXPR, MOOD_POSE, personaFaceURL, PersonaAvatar });
