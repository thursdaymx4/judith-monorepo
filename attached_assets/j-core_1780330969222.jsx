/* j-core.jsx — shared: Orb, Icon, i18n, personas, helpers */
const { useState, useEffect, useRef, Fragment } = React;

/* ---------------- Orb (idle / listening / speaking) ---------------- */
function Orb({ size = 120, state = "idle" }) {
  return (
    <div className={"orb-wrap " + state} style={{ width: size, height: size }}>
      <div className="orb-glow"></div>
      {state !== "speaking" && (
        <div style={{display:"contents"}}>
          <div className="orb-ring"></div>
          <div className="orb-ring r2"></div>
          {state === "listening" && <div className="orb-ring r3"></div>}
        </div>
      )}
      <div className="orb-core"></div>
      {state === "speaking" && (
        <div className="wave"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      )}
    </div>
  );
}

/* ---------------- Icons (monoline) ---------------- */
function Icon({ name, size = 22 }) {
  const c = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  const P = {
    zap: <path d="M13 2 3 14h9l-1 8 10-12h-9z" />,
    droplet: <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />,
    wifi: <g><path d="M2 8.5a16 16 0 0 1 20 0" /><path d="M5 12.5a11 11 0 0 1 14 0" /><path d="M8.5 16.2a6 6 0 0 1 7 0" /><circle cx="12" cy="20" r="0.6" fill="currentColor" stroke="none" /></g>,
    smartphone: <g><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></g>,
    phone: <path d="M14 16.5a1 1 0 0 0 1.2-.3l.4-.5a2 2 0 0 1 1.6-.7h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.5.4a1 1 0 0 0-.3 1.2 14 14 0 0 0 6.4 6.3z" />,
    card: <g><rect x="2" y="5" width="20" height="14" rx="2.5" /><path d="M2 10h20" /></g>,
    plus: <g><path d="M12 5v14" /><path d="M5 12h14" /></g>,
    mic: <g><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v4" /></g>,
    keyboard: <g><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" /></g>,
    check: <path d="M20 6 9 17l-5-5" />,
    bell: <g><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></g>,
    watch: <g><rect x="6" y="6" width="12" height="12" rx="3" /><path d="M9 6V3h6v3M9 18v3h6v-3M12 10v2.5l1.5 1" /></g>,
    grid: <g><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></g>,
    globe: <g><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18" /></g>,
    chart: <g><path d="M3 3v18h18" /><path d="M7 14v3M12 9v8M17 5v12" /></g>,
    spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
    arrow: <g><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></g>,
    cal: <g><rect x="3" y="4" width="18" height="17" rx="2.5" /><path d="M3 9h18M8 2v4M16 2v4" /></g>,
    lock: <g><rect x="4" y="11" width="16" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></g>,
    star: <path d="M12 3l2.6 6.3L21 10l-5 4 1.6 6.6L12 17l-5.6 3.6L8 14l-5-4 6.4-.7z" />
  };
  return <svg {...c}>{P[name] || P.spark}</svg>;
}

/* ---------------- personas ---------------- */
const PERSONAS = [
  { id: "pro", icon: "spark",
    name: { en: "Professional peer", fil: "Propesyonal", es: "Colega profesional" },
    vibe: { en: "Clear · calm", fil: "Malinaw · kalmado", es: "Claro · tranquilo" },
    line: {
      fil: "Ako si Judith. Ako na’ng bahala sa mga due date mo — malinaw, on time, walang stress.",
      en: "I’m Judith. I’ll keep your due dates handled — clear, on time, zero stress.",
      es: "Soy Judith. Yo me encargo de tus fechas de pago — claro, puntual, sin estrés." } },
  { id: "funny", icon: "star",
    name: { en: "Funny friend", fil: "Barkada", es: "Amigo gracioso" },
    vibe: { en: "Warm · playful", fil: "Warm · playful", es: "Cálido · juguetón" },
    line: {
      fil: "Hoy, ako si Judith! Ako ang personal reminder mo, para ’di ka na ma-surprise ng bill.",
      en: "Hey, I’m Judith! Your personal reminder so no bill ever catches you off guard.",
      es: "¡Hola, soy Judith! Tu recordatorio personal para que ninguna factura te sorprenda." } },
  { id: "sib", icon: "bell",
    name: { en: "Sarcastic sibling", fil: "Sarcastic kapatid", es: "Hermano sarcástico" },
    vibe: { en: "Cheeky · blunt", fil: "Pilyo · prangka", es: "Pícaro · directo" },
    line: {
      fil: "Ako si Judith. Ako na’ng magpapaalala ng mga bill mo… kasi alam nating dalawa, makakalimutan mo ’yan.",
      en: "I’m Judith. I’ll remind you about your bills… because we both know you’d forget.",
      es: "Soy Judith. Yo te recuerdo tus facturas… porque ambos sabemos que las olvidarías." } },
  { id: "mama", icon: "droplet",
    name: { en: "Your Mom", fil: "Mama mo", es: "Tu mamá" },
    vibe: { en: "Caring · a little naggy", fil: "Caring · konting kulit", es: "Cariñosa · insistente" },
    line: {
      fil: "Anak, si Judith ’to. Ako na’ng bahala sa mga bayarin mo. Basta ikaw, kumain ka lang nang maayos.",
      en: "Sweetheart, it’s Judith. I’ll handle the bills. You — just make sure you eat well.",
      es: "Mi amor, soy Judith. Yo me encargo de los pagos. Tú, solo come bien." } }
];

const LANGS = [
  { code: "fil", label: "Filipino", native: "Filipino / Taglish", flag: "🇵🇭" },
  { code: "en", label: "English", native: "English", flag: "🇬🇧" },
  { code: "es", label: "Spanish", native: "Español", flag: "🇪🇸" },
  { code: "id", label: "Indonesian", native: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "vi", label: "Vietnamese", native: "Tiếng Việt", flag: "🇻🇳" }
];

const COUNTRIES = [
  { code: "PH", name: "Philippines", flag: "🇵🇭", cur: "₱", lang: "fil" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", cur: "Rp", lang: "id" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳", cur: "₫", lang: "vi" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾", cur: "RM", lang: "en" },
  { code: "TH", name: "Thailand", flag: "🇹🇭", cur: "฿", lang: "en" },
  { code: "MX", name: "Mexico", flag: "🇲🇽", cur: "$", lang: "es" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", cur: "₦", lang: "en" },
  { code: "IN", name: "India", flag: "🇮🇳", cur: "₹", lang: "en" }
];

/* familiar comfort food per country — drives the "Judith only talks bills" joke */
const COUNTRY_FOOD = {
  PH: "sinigang", ID: "rendang", VN: "pho", MY: "nasi lemak", TH: "pad thai",
  MX: "tacos", NG: "jollof rice", IN: "biryani"
};
function countryFood(ctx) {
  const code = ctx && ctx.country && ctx.country.code;
  return (code && COUNTRY_FOOD[code]) || "dinner";
}

/* ---------------- i18n strings ---------------- */
const STR = {
  en: {
    getstarted: "Let’s begin", continue: "Continue", next: "Next", skip: "Skip", finish: "Enter Judith",
    welcomeK: "Meet Judith", welcomeT: "Your bills, handled — before they’re ever late.",
    welcomeL: "Judith tracks every due date and reminds you in your own voice, your own language.",
    countryT: "Where do you live?", countryL: "So Judith uses your currency, due-date norms, and providers.", countrySearch: "Search country",
    langT: "Pick your language", langL: "This sets everything you see in the app.",
    voiceNote: "Judith’s screen language. Her spoken voice always replies in English.",
    personaT: "Who should Judith be?", personaL: "Pick a personality — you can change it anytime.", play: "Play voice",
    problemK: "Sound familiar?", problemT: "Late fees, missed bills, and that 11 p.m. “did I pay that?” panic.",
    problemL: "Most people don’t forget on purpose — they just don’t have one calm voice keeping track.",
    introK: "How Judith works", introT: "Tell her once. She remembers forever.",
    introP1: "Add bills just by talking — naturally.", introP2: "Judith reminds you before every due date.", introP3: "Ask her anything, anytime, by voice.",
    voiceT: "Tell Judith your bills", voiceHint: "Tap and just talk — say it however feels natural.",
    listening: "Listening…", tapInstead: "Type instead", confirmQ: "Did I get that right?",
    yes: "Yes, that’s right", edit: "Fix it", another: "Add another", doneAdding: "I’m done",
    congratsT: "All set.", congratsL: "Judith now watches every due date for you.",
    persLines: ["Reading your bills…", "Setting smart reminders…", "Tuning Judith’s voice…", "Almost ready…"],
    summaryT: "Your money, this month", perMonth: "due per month", billsCount: "bills tracked",
    insBiggest: "Biggest bill", insNext: "Next due", insSaved: "Late fees avoided",
    f1K: "Voice-first", f1T: "Just ask Judith.", f1L: "Ask anything — she totals it across every card and bill, out loud, hands free.",
    f2K: "Reminders", f2T: "A nudge before, not a fine after.", f2L: "Lock-screen and widget reminders timed to each due date.",
    f3K: "Everywhere", f3T: "On your wrist and home screen.", f3L: "Glance at your next due bill on the widget or Apple Watch.",
    payT: "Judith Premium", payCta: "Start free trial", payTrial: "7 days free, then", per: "/month",
    payF1: "Unlimited bills & reminders", payF2: "All four personalities & voices", payF3: "Widget + Apple Watch", payF4: "Ask Judith by voice, anytime",
    bestValue: "Most popular"
  },
  fil: {
    getstarted: "Tara, simulan natin", continue: "Magpatuloy", next: "Susunod", skip: "Laktawan", finish: "Pasok na kay Judith",
    welcomeK: "Kilalanin si Judith", welcomeT: "Mga bill mo, bantay — bago pa ma-late.",
    welcomeL: "Binabantayan ni Judith ang bawat due date at pinapaalala ’yan sa boses at wika mo.",
    countryT: "Saan ka nakatira?", countryL: "Para tama ang currency, due dates, at providers na gagamitin ni Judith.", countrySearch: "Maghanap ng bansa",
    langT: "Pili ng wika mo", langL: "Ito ang gagamitin sa lahat ng makikita mo sa app.",
    voiceNote: "Ito ang wika sa screen. Ang boses ni Judith, palaging English magsasalita.",
    personaT: "Sino si Judith para sa’yo?", personaL: "Pumili ng personality — pwede mong palitan anytime.", play: "Pakinggan",
    problemK: "Pamilyar ba?", problemT: "Late fees, nakalimutang bill, at ’yung 11 p.m. na “nabayaran ko ba ’yon?”",
    problemL: "Hindi naman sinasadya — wala lang silang kalmadong boses na nagbabantay.",
    introK: "Paano gumagana si Judith", introT: "Sabihin mo isang beses. Tatandaan niya habambuhay.",
    introP1: "Magdagdag ng bill sa pagsasalita lang — natural.", introP2: "Paaalalahanan ka bago mag-due.", introP3: "Tanungin siya kahit kailan, gamit ang boses.",
    voiceT: "Sabihin kay Judith ang bills mo", voiceHint: "I-tap tapos magsalita lang — kahit pa-konversation.",
    listening: "Nakikinig…", tapInstead: "I-type na lang", confirmQ: "Tama ba ’yong narinig ko?",
    yes: "Oo, tama", edit: "Ayusin", another: "May iba pa", doneAdding: "Tapos na ako",
    congratsT: "Ayos na.", congratsL: "Babantayan na ni Judith ang bawat due date mo.",
    persLines: ["Binabasa ang bills mo…", "Inaayos ang reminders…", "Tinutunog ang boses ni Judith…", "Halos tapos na…"],
    summaryT: "Pera mo, ngayong buwan", perMonth: "due kada buwan", billsCount: "bills binabantayan",
    insBiggest: "Pinakamalaking bill", insNext: "Susunod na due", insSaved: "Late fees na-iwasan",
    f1K: "Voice-first", f1T: "Tanungin mo lang si Judith.", f1L: "“Kailan due ng Meralco?” Sasagot siya — hands free.",
    f2K: "Paalala", f2T: "Paalala bago, hindi multa pagkatapos.", f2L: "Lock-screen at widget reminders, naka-time sa bawat due date.",
    f3K: "Kahit saan", f3T: "Sa pulso at home screen mo.", f3L: "Silip lang sa widget o Apple Watch ang susunod mong due.",
    payT: "Judith Premium", payCta: "Simulan ang free trial", payTrial: "7 araw libre, tapos", per: "/buwan",
    payF1: "Walang limitasyong bills & reminders", payF2: "Lahat ng apat na personality & boses", payF3: "Widget + Apple Watch", payF4: "Tanungin si Judith anytime, by voice",
    bestValue: "Pinakasikat"
  },
  es: {
    getstarted: "Empecemos", continue: "Continuar", next: "Siguiente", skip: "Omitir", finish: "Entrar a Judith",
    welcomeK: "Conoce a Judith", welcomeT: "Tus facturas, controladas — antes de que se atrasen.",
    welcomeL: "Judith vigila cada fecha de pago y te recuerda con tu propia voz, en tu idioma.",
    countryT: "¿Dónde vives?", countryL: "Para usar tu moneda, fechas y proveedores.", countrySearch: "Buscar país",
    langT: "Elige tu idioma", langL: "Esto define todo lo que verás en la app.",
    voiceNote: "El idioma de la pantalla. La voz de Judith siempre responde en inglés.",
    personaT: "¿Quién quieres que sea Judith?", personaL: "Elige una personalidad — puedes cambiarla cuando quieras.", play: "Escuchar",
    problemK: "¿Te suena?", problemT: "Recargos, facturas olvidadas y ese “¿lo pagué?” a las 11 p.m.",
    problemL: "Nadie olvida a propósito — solo falta una voz tranquila que lleve la cuenta.",
    introK: "Cómo funciona Judith", introT: "Dílo una vez. Lo recuerda para siempre.",
    introP1: "Agrega facturas solo hablando — natural.", introP2: "Te recuerda antes de cada fecha.", introP3: "Pregúntale lo que sea, por voz.",
    voiceT: "Dile a Judith tus facturas", voiceHint: "Toca y habla — dilo como te salga natural.",
    listening: "Escuchando…", tapInstead: "Mejor escribir", confirmQ: "¿Lo entendí bien?",
    yes: "Sí, correcto", edit: "Corregir", another: "Agregar otra", doneAdding: "Ya terminé",
    congratsT: "Listo.", congratsL: "Judith ya vigila cada fecha de pago por ti.",
    persLines: ["Leyendo tus facturas…", "Programando recordatorios…", "Afinando la voz de Judith…", "Casi listo…"],
    summaryT: "Tu dinero, este mes", perMonth: "al mes", billsCount: "facturas vigiladas",
    insBiggest: "Factura mayor", insNext: "Próximo pago", insSaved: "Recargos evitados",
    f1K: "Voz primero", f1T: "Solo pregúntale a Judith.", f1L: "“¿Cuándo vence mi luz?” Responde en voz alta — manos libres.",
    f2K: "Recordatorios", f2T: "Un aviso antes, no una multa después.", f2L: "Recordatorios en pantalla y widget para cada fecha.",
    f3K: "En todas partes", f3T: "En tu muñeca y pantalla.", f3L: "Mira tu próxima factura en el widget o Apple Watch.",
    payT: "Judith Premium", payCta: "Probar gratis", payTrial: "7 días gratis, luego", per: "/mes",
    payF1: "Facturas y recordatorios ilimitados", payF2: "Las cuatro personalidades y voces", payF3: "Widget + Apple Watch", payF4: "Pregunta a Judith por voz, cuando sea",
    bestValue: "Más popular"
  }
};
function makeT(lang) {
  const base = STR[lang] || STR.en;
  return (k) => (base[k] !== undefined ? base[k] : (STR.en[k] !== undefined ? STR.en[k] : k));
}
function pick(obj, lang) { return obj[lang] || obj.en || obj.fil; }

Object.assign(window, { Orb, Icon, PERSONAS, LANGS, COUNTRIES, COUNTRY_FOOD, countryFood, STR, makeT, pick });
