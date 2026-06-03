/**
 * voiceLines.ts — Single source of truth for all Judith voice content.
 *
 * Structure:
 *   JUDITH_VOICE.<screen>[persona].en   — English line
 *   JUDITH_VOICE.<screen>[persona].fil  — Tagalog / Taglish line
 *
 * To add a new language or persona, extend the PersonaId / VoiceLine types
 * and add the new key here — every screen picks it up automatically.
 *
 * Screens covered:
 *   intro · lateFee · problem · stakes · paywall · personalizing
 *   features · billTextPrompts · billVoice · billFlow
 */

import type { PersonaId } from "./personas";

/** A piece of copy available in both supported languages. */
export type VoiceLine = { en: string; fil: string };

/** A full set of voice lines keyed by persona. */
export type PersonaLines = Record<PersonaId, VoiceLine>;

/** Bill-flow transition set for one persona. */
export type BillFlow = {
  breather0:  VoiceLine;
  breather1:  VoiceLine;
  countCards: VoiceLine;
  countLoans: VoiceLine;
  more:       { en: (n: number) => string; fil: (n: number) => string };
  cardFirst:  VoiceLine;
  cardNext:   { en: (n: number) => string; fil: (n: number) => string };
  loanFirst:  VoiceLine;
  loanNext:   { en: (n: number) => string; fil: (n: number) => string };
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  SIMPLE ONBOARDING SCREENS                                                  */
/*  Pattern: JUDITH_VOICE.<screen>[persona][lang]                              */
/* ─────────────────────────────────────────────────────────────────────────── */

export const JUDITH_VOICE = {

  /* ── ScreenIntro ──────────────────────────────────────────────────────── */
  intro: {
    pro:     { en: "This usually takes 5 to 7 minutes. Let's map out every bill — I'll walk you through it.", fil: "Aabutin ito ng 5 hanggang 7 minuto. I-map natin ang lahat ng bills mo." },
    funny:   { en: "Okay! About 5 to 7 minutes and your whole bill life will make sense. Let's go!", fil: "5 hanggang 7 minuto lang at magiging maayos na ang lahat! Tara na!" },
    sib:     { en: "About 5 to 7 minutes. Just answer my questions — it'll be worth it.", fil: "5 hanggang 7 minuto lang to. Sagutin mo lang ang mga tanong ko." },
    mama:    { en: "Anak, this will only take 5 to 7 minutes. I'll walk you through everything, promise.", fil: "Anak, 5 hanggang 7 minuto lang ito. Sasamahan kita sa lahat, promise." },
    marites: { en: "Grabe besh, 5 to 7 minutes lang! Let's map all your bills — I cannot wait!", fil: "Grabe besh, 5 hanggang 7 minuto lang! I-map na natin ang lahat ng bills mo!" },
  } satisfies PersonaLines,

  /* ── ScreenLateFee ────────────────────────────────────────────────────── */
  lateFee: {
    pro:     { en: "We've all been there — missed a payment, surprise fee. I'm here to make sure that never happens again.", fil: "Nangyayari ito sa lahat — napalampas na bayad, biglang multa. Nandito ako para hindi na mangyari ulit." },
    funny:   { en: "Ugh, late fees — the worst! I'm here so you never have to deal with that again.", fil: "Ay ang sama ng late fees! Pero wag nang mag-alala — nandito na ako para hindi na maulit!" },
    sib:     { en: "Missed payment. Surprise fee. Happens to everyone. That's why I'm here.", fil: "Napalampas na bayad. Biglang multa. Nangyayari sa lahat. Kaya nandito ako." },
    mama:    { en: "Anak, don't worry — it happens to everyone. I'm here to make sure it doesn't happen to you again.", fil: "Huwag mag-alala anak. Nangyayari ito sa lahat. Nandito ako para hindi na maulit." },
    marites: { en: "Ay grabe, late fees! The absolute worst! But besh, that's why I'm here — hindi na maulit iyon!", fil: "Ay grabe, late fees! Ang pangit! Pero besh, nandito na ako — hindi na maulit 'yan!" },
  } satisfies PersonaLines,

  /* ── ScreenProblem ────────────────────────────────────────────────────── */
  problem: {
    pro:     { en: "Honestly, most people don't track their bills. Let's change that.", fil: "Honestly, karamihan sa tao ay hindi nag-ta-track ng bills nila. Palitan na natin iyon." },
    funny:   { en: "Surprise — most people don't track their bills. But you're not most people anymore!", fil: "Grabe, karamihan hindi nag-ta-track ng bills! Pero ikaw — ikaw ay magiging iba na!" },
    sib:     { en: "Most people don't track this. You're about to be different.", fil: "Karamihan hindi nag-ta-track. Ikaw ay magiging iba." },
    mama:    { en: "Anak, most people don't track their bills. But that's okay — we're changing that right now.", fil: "Anak, karamihan hindi nag-ta-track ng bills. Pero okay lang — palitan na natin iyon ngayon." },
    marites: { en: "Ay besh, most people don't track their bills! Pero tayo — we're changing that na!", fil: "Ay besh, karamihan hindi nag-ta-track ng bills! Pero tayo — we're changing that na!" },
  } satisfies PersonaLines,

  /* ── ScreenStakes ─────────────────────────────────────────────────────── */
  stakes: {
    pro:     { en: "This doesn't have to be your situation. Let's change it — right now.", fil: "Hindi na kailangang ganito ang sitwasyon mo. Palitan na natin ito — ngayon na." },
    funny:   { en: "Okay! Enough of that — let's flip the script! Right now, we change this!", fil: "Sige! Tapos na sa ganyan! Palitan na natin — ngayon na!" },
    sib:     { en: "This doesn't have to stay this way. Let's change it. Now.", fil: "Hindi na kailangang ganito. Palitan na natin. Ngayon." },
    mama:    { en: "Anak, we're going to change this together — starting right now.", fil: "Anak, magbabago na tayo — simula ngayon. Sama-sama tayo." },
    marites: { en: "Besh! No more of this! We're changing it right now! Let's go!", fil: "Besh! Tapos na! Palitan na natin ito ngayon! Let's go!" },
  } satisfies PersonaLines,

  /* ── ScreenAskPaywall ─────────────────────────────────────────────────── */
  paywall: {
    pro:     { en: "You've got eight free asks to start. When you're ready for more, pick a plan and I'm all yours.", fil: "May walong libreng tanong ka sa simula. Kapag gusto mo ng higit pa, pumili ng plano — nandito ako." },
    funny:   { en: "Eight free asks — on the house! Try me out, then come back when you're hooked. I'll wait.", fil: "Walong libreng tanong — regalo ko! Subukan mo ako, at kapag hooked ka na, bumalik ka!" },
    sib:     { en: "Eight free asks. Use them. If you want more, pick a plan.", fil: "Walong libreng tanong. Gamitin mo. Kung gusto mo pa, pumili ng plano." },
    mama:    { en: "Anak, you have eight free asks to start. Try them out — and when you want more, I'll be right here.", fil: "Anak, may walong libreng tanong ka. Subukan mo — at kapag gusto mo pa, nandito ako." },
    marites: { en: "Besh! Eight free asks — try me! And when you want to keep chatting, pick a plan! I'll be waiting!", fil: "Besh! Walong libreng tanong! Subukan mo ako! At kapag gusto mo pang makipag-chat — pick a plan! Waiting ako!" },
  } satisfies PersonaLines,

  /* ── ScreenPersonalizing (spoken while loading) ───────────────────────── */
  /*  Short, persona-voiced self-talk. Judith is working in the background —  */
  /*  lines should feel like a quiet aside, not a speech.                     */
  personalizing: {
    pro:     "Setting up your reminders now. Almost ready.",
    funny:   "Don't go anywhere — I'm doing very important things back here!",
    sib:     "Yeah yeah, I'm working on it. Give me a second.",
    mama:    "Almost ready anak — I'm making sure everything is just right for you.",
    marites: "Ay grabe, so many bills! But I got you besh — almost done!",
  } satisfies Record<PersonaId, string>,

  /* ─────────────────────────────────────────────────────────────────────── */
  /*  FEATURE SCREENS (3 screens, indexed 0-2)                               */
  /*  JUDITH_VOICE.features[persona].en[0..2]                               */
  /* ─────────────────────────────────────────────────────────────────────── */
  features: {
    pro: {
      en:  ["Go ahead — ask me anything. I'm listening.", "Try asking what's due this week. I'll give you the full picture.", "Ask me if it's safe to spend before payday. I'll check your bills and give you a straight answer."],
      fil: ["Sige, magtanong ka na. Nakinukinig ako.", "Try mo i-tanong kung ano ang due ngayong linggo. Sasabihin ko lahat.", "Tanungin mo ko kung ligtas mag-gastos. I-check ko lahat ng bills mo."],
    },
    funny: {
      en:  ["I'm all ears! Tap that mic and let's see what you've got.", "Try 'what's due this week?' — I'll spill everything, no holding back!", "Ask if it's safe to spend before payday. I'll be brutally honest — lovingly, of course!"],
      fil: ["Ready na ako! Magtanong ka na, curious rin ako kung ano ang sasabihin mo!", "I-try mo: 'Ano ang due this week?' — Isasabi ko lahat, walang tinatago!", "Tanungin mo: ligtas ba mag-gastos? Magsasabi ako ng totoo — mahal kita kaya!"],
    },
    sib: {
      en:  ["You can ask me things now. Go ahead.", "Ask what's due this week. I'll tell you.", "Ask if it's safe to spend. I'll check and give you the truth."],
      fil: ["Pwede ka nang magtanong. Sige.", "Tanungin mo kung ano ang due ngayong linggo. Sasabihin ko.", "Tanungin mo kung ligtas mag-gastos. Checkuhin ko at sasabihin ko."],
    },
    mama: {
      en:  ["Go ahead anak, ask me anything. I'm here.", "Try asking what's due this week anak. I'll tell you everything.", "Ask me if it's safe to spend anak. I'll check everything for you."],
      fil: ["Sige anak, magtanong ka na. Nandito ako.", "Try mo anak, tanungin ang due this week. Isasabi ko lahat sa iyo.", "Tanungin mo anak kung ligtas mag-gastos. I-check ko lahat para sa iyo."],
    },
    marites: {
      en:  ["Oh oh oh! Ask me na! I know everything about your bills besh!", "Ay! Ask me what's due this week! I'll tell you everything besh! Lahat!", "Ask me if it's safe to spend! I'll check your bills — all of them! Grabe besh!"],
      fil: ["Ay ay ay! Magtanong ka na besh! Alam ko lahat ng tungkol sa bills mo!", "Ay! Tanungin mo ako kung ano ang due ngayong linggo! Isasabi ko lahat besh!", "Tanungin mo ako kung ligtas mag-gastos! Checkuhin ko ang lahat besh! Grabe!"],
    },
  } satisfies Record<PersonaId, { en: [string, string, string]; fil: [string, string, string] }>,

  /* ─────────────────────────────────────────────────────────────────────── */
  /*  BILL-ASKING SCREEN — on-screen text prompts (shown in the UI)          */
  /*  JUDITH_VOICE.billTextPrompts["Electricity"].en                         */
  /* ─────────────────────────────────────────────────────────────────────── */
  billTextPrompts: ({
    "Rent / Mortgage":    { en: "Let's start with the big one — rent or mortgage. How much, and when's it due?", fil: "Simula tayo sa pinakamalaki — renta o mortgage. Magkano at kailan due?" },
    Electricity:          { en: "Now your electricity. Who's the provider, how much, and when's it due?", fil: "Yung kuryente — sino ang provider, magkano, at kailan due?" },
    Water:                { en: "Next, your water. Provider, amount, and the due date?", fil: "Tubig naman — provider, halaga, at petsa ng due?" },
    Internet:             { en: "And your internet. Provider, amount, due date?", fil: "Internet mo — provider, bayad, at due date?" },
    Mobile:               { en: "Now your phone plan — which carrier, how much, and when's it due?", fil: "Phone plan — anong network, magkano, at kailan bayaran?" },
    "Phone subscription": { en: "The fastest way is to screenshot your Subscriptions list in Settings, then upload it. Or tell me each one — iCloud, Spotify, Apple Music.", fil: "Pinaka-mabilis: mag-screenshot ng iyong Subscriptions sa Settings tapos i-upload. O sabihin mo sa akin isa-isa — iCloud, Spotify, at iba pa." },
    "TV / Streaming":     { en: "Streaming — Netflix, Disney+, HBO? Which one, how much, when?", fil: "Streaming — Netflix, Disney+? Alin, magkano, kelan?" },
    "Web app":            { en: "Any web apps? Canva, Notion, ChatGPT… name it, the cost, the date.", fil: "Mga web apps — Canva, Notion, ChatGPT? Pangalan, bayad, petsa." },
    "Credit card":        { en: "Now the heavy ones. A credit card — which bank, the amount due, and the date?", fil: "Yung credit cards — anong bangko, magkano ang due, at kailan?" },
    "Personal loan":      { en: "Any loans? Lender, the monthly amount, and the due date.", fil: "Mga loans — sinong nagpahiram, magkano monthly, at kailan due?" },
  }) as Record<string, VoiceLine>,

  /* ─────────────────────────────────────────────────────────────────────── */
  /*  BILL-ASKING SCREEN — persona voice lines per bill category             */
  /*  JUDITH_VOICE.billVoice[persona].en["Electricity"]                     */
  /* ─────────────────────────────────────────────────────────────────────── */
  billVoice: ({
    pro: {
      en: {
        "Rent / Mortgage":    "How much is rent, and what day's it due?",
        Electricity:          "Your electricity provider, and the usual monthly amount?",
        Water:                "Water — provider and how much a month?",
        Internet:             "Internet provider and monthly cost?",
        Mobile:               "Your mobile plan — which network and how much?",
        "Phone subscription": "Screenshot your Subscriptions in Settings — fastest way. Or list them one by one.",
        "TV / Streaming":     "Any streaming services? Which ones and how much?",
        "Web app":            "Any web subscriptions — Canva, Notion, anything like that?",
        "Credit card":        "Which bank, and what's the amount due?",
        "Personal loan":      "Who's the lender, and what's the monthly payment?",
      },
      fil: {
        "Rent / Mortgage":    "Magkano ang renta mo at tuwing kelan due?",
        Electricity:          "Sino ang provider ng kuryente mo at magkano monthly?",
        Water:                "Tubig — provider at magkano bawat buwan?",
        Internet:             "Internet — sino ang provider at magkano?",
        Mobile:               "Mobile plan — anong network at magkano?",
        "Phone subscription": "I-screenshot ang Subscriptions mo sa Settings — mas madali. O isa-isahin mo.",
        "TV / Streaming":     "May streaming ka ba? Alin-alin at magkano?",
        "Web app":            "May web subscriptions ka pa — Canva, Notion, ganyan?",
        "Credit card":        "Anong bangko at magkano ang due?",
        "Personal loan":      "Sino ang lender at magkano monthly?",
      },
    },
    funny: {
      en: {
        "Rent / Mortgage":    "Rent — the unavoidable one. How much and what day?",
        Electricity:          "Electricity! Who's eating your wallet here, and how much usually?",
        Water:                "Water bill — provider and the damage?",
        Internet:             "Internet — can't live without it. Which one and how much?",
        Mobile:               "Phone plan — which network, and how much a month?",
        "Phone subscription": "Screenshot your Subscriptions in Settings — easiest confession method. Or list them.",
        "TV / Streaming":     "Streaming — which ones are you guiltlessly paying for?",
        "Web app":            "Any web apps you're quietly funding? Canva, Notion, that sort of thing?",
        "Credit card":        "Which bank, and how much is this month's reality check?",
        "Personal loan":      "Who's the lender, and how much a month?",
      },
      fil: {
        "Rent / Mortgage":    "Renta — ang hindi maiiwasan! Magkano at kelan?",
        Electricity:          "Kuryente — sino kumukuha ng pera mo at magkano?!",
        Water:                "Tubig — provider at damage?",
        Internet:             "Internet — 'di mabubuhay nang wala. Sino at magkano?",
        Mobile:               "Phone plan — anong network at magkano bawat buwan?",
        "Phone subscription": "I-screenshot na lang ang Subscriptions — pinakamadaling paraan. O isa-isahin.",
        "TV / Streaming":     "Streaming — alin-alin ang binabayaran mo nang walang hiya?",
        "Web app":            "May mga web apps na tahimik na binabayaran? Canva, Notion, ganyan?",
        "Credit card":        "Anong bangko at magkano ang katotohanan ngayon?",
        "Personal loan":      "Sino ang inutangan at magkano monthly?",
      },
    },
    sib: {
      en: {
        "Rent / Mortgage":    "Rent. How much and when?",
        Electricity:          "Electricity — who and how much?",
        Water:                "Water. Provider and amount.",
        Internet:             "Internet — which one and how much?",
        Mobile:               "Phone plan. Network and cost.",
        "Phone subscription": "Screenshot Subscriptions in Settings. Or just list them.",
        "TV / Streaming":     "Streaming. Which ones?",
        "Web app":            "Web subscriptions you've been ignoring?",
        "Credit card":        "Bank and amount due.",
        "Personal loan":      "Lender and monthly payment.",
      },
      fil: {
        "Rent / Mortgage":    "Renta. Magkano at kelan?",
        Electricity:          "Kuryente. Sino at magkano?",
        Water:                "Tubig. Provider at halaga.",
        Internet:             "Internet. Sino at magkano?",
        Mobile:               "Phone plan. Network at halaga.",
        "Phone subscription": "I-screenshot ang Subscriptions. O ilista mo.",
        "TV / Streaming":     "Streaming. Alin-alin?",
        "Web app":            "May web subscriptions ka pa ba?",
        "Credit card":        "Bangko at halaga ng due.",
        "Personal loan":      "Sino ang lender at magkano monthly.",
      },
    },
    mama: {
      en: {
        "Rent / Mortgage":    "Anak, how much is rent and what day is it due?",
        Electricity:          "Your electricity anak — which provider and how much usually?",
        Water:                "Water bill anak — provider and how much a month?",
        Internet:             "Internet anak — which provider and how much?",
        Mobile:               "Your phone plan anak — which network and how much?",
        "Phone subscription": "Screenshot Subscriptions anak, from your phone Settings. Or tell me each one.",
        "TV / Streaming":     "Any streaming anak? Which ones?",
        "Web app":            "Any web subscriptions anak? Canva, Notion?",
        "Credit card":        "Which bank anak, and how much is due?",
        "Personal loan":      "Who's the lender anak, and how much a month?",
      },
      fil: {
        "Rent / Mortgage":    "Anak, magkano ang renta at tuwing kelan due?",
        Electricity:          "Kuryente anak — sino ang provider at magkano?",
        Water:                "Tubig anak — provider at magkano bawat buwan?",
        Internet:             "Internet anak — sino at magkano?",
        Mobile:               "Phone plan mo anak — anong network at magkano?",
        "Phone subscription": "I-screenshot ang Subscriptions mo anak. O isa-isa mo sa akin.",
        "TV / Streaming":     "May streaming ka ba anak? Alin-alin?",
        "Web app":            "May web subscriptions anak? Canva, Notion?",
        "Credit card":        "Anong bangko anak at magkano ang due?",
        "Personal loan":      "Sino ang lender anak at magkano monthly?",
      },
    },
    marites: {
      en: {
        "Rent / Mortgage":    "Renta! Magkano at kelan?! Tell me everything!",
        Electricity:          "Kuryente! Sino ang provider at magkano?!",
        Water:                "Tubig bill! Provider and amount — spill na!",
        Internet:             "Internet! Which provider and magkano?!",
        Mobile:               "Phone plan! Anong network, magkano?!",
        "Phone subscription": "I-screenshot mo na lang ang Subscriptions mo sa Settings! O isa-isa mo sa akin besh!",
        "TV / Streaming":     "Streaming! Alin-alin?! Netflix?! Disney?! Spill!",
        "Web app":            "May web apps ka pa?! Canva, Notion?! Grabe ang dami mo!",
        "Credit card":        "Credit card! Anong bangko at magkano ang utang?!",
        "Personal loan":      "Utang! Sinong nagpahiram at magkano monthly?!",
      },
      fil: {
        "Rent / Mortgage":    "Renta! Magkano at kelan?! Tell me everything!",
        Electricity:          "Kuryente, magkano at tuwing kelan? Meralco ka din ba?!",
        Water:                "Tubig mo magkano at kailan due?! Spill!",
        Internet:             "Internet! PLDT o Converge? Magkano?!",
        Mobile:               "Phone plan! Smart o Globe? Magkano at kelan ang due?!",
        "Phone subscription": "I-screenshot na ang Subscriptions mo sa Settings! O isa-isa mo sa akin besh!",
        "TV / Streaming":     "May streaming ka ba?! Alin-alin?! Grabe!",
        "Web app":            "Other web apps subscription pa?! Grabe ang dami mo besh!",
        "Credit card":        "Credit card! Anong bangko at magkano ang due?!",
        "Personal loan":      "May utang pa?! Sinong nagpahiram at magkano monthly?!",
      },
    },
  }) as Record<PersonaId, { en: Record<string, string>; fil: Record<string, string> }>,

  /* ─────────────────────────────────────────────────────────────────────── */
  /*  BILL-ASKING SCREEN — transition lines (breather, count, more, etc.)    */
  /*  JUDITH_VOICE.billFlow[persona].breather0.en                           */
  /* ─────────────────────────────────────────────────────────────────────── */
  billFlow: {
    pro: {
      breather0:  { en: "Essentials locked in — power, water, internet. All saved.", fil: "Essentials, naka-save na. Kuryente, tubig, internet — done." },
      breather1:  { en: "Subscriptions logged. The quiet drainers are all accounted for.", fil: "Mga subscriptions, naka-log na. Wala nang makakalimutan." },
      countCards: { en: "Now the credit cards. How many do you have?", fil: "Ngayon ang mga credit card. Ilan ang mayroon ka?" },
      countLoans: { en: "And loans — personal, car, housing. How many?", fil: "At mga loans — personal, car, bahay. Ilan?" },
      more:       { en: (n) => `${n} bills so far. Any more to add?`, fil: (n) => `${n} na bill na naka-log. May iba pa?` },
      cardFirst:  { en: "First card — which bank, and what's the amount due?", fil: "Sa una mong card, what's your bank, due date and amount due?" },
      cardNext:   { en: (n) => `Card ${n} — same details, which bank?`, fil: (n) => `Card ${n} — same details: bank, amount, at kelan due?` },
      loanFirst:  { en: "First loan — who's the lender, and what's the monthly payment?", fil: "Sinong nag pahiram sayo, magkano monthly at tuwing kelan mo kailangan bayaran?" },
      loanNext:   { en: (n) => `Loan ${n} — lender and monthly amount?`, fil: (n) => `Loan ${n} — sino pa, magkano monthly, at kelan?` },
    },
    funny: {
      breather0:  { en: "Essentials done! The boring-but-critical stuff — nailed it. Look at you.", fil: "Essentials logged na! Ang boring-but-critical — nailed! Proud of you!" },
      breather1:  { en: "Subscriptions saved! All your guilty pleasures — officially on the record.", fil: "Subscriptions, naka-save na rin! Lahat ng guilty pleasures — on record na!" },
      countCards: { en: "Okay, credit cards. How many are silently judging you right now?", fil: "Sige, credit cards! Ilan ba ang tahimik na naghahari sa'yo?" },
      countLoans: { en: "Loans — the long-term commitment kind. How many?", fil: "Loans — ang pangmatagalang pakikipagtulungan. Ilan?" },
      more:       { en: (n) => `${n} bills down! Any more to confess?`, fil: (n) => `${n} bills na! May iba pa bang gustong i-admit?` },
      cardFirst:  { en: "First card — which bank, and how much is the damage?", fil: "Una — anong bangko at magkano ang damage?" },
      cardNext:   { en: (n) => `Card ${n} — which bank and how much?`, fil: (n) => `Card ${n} — anong bangko at magkano?` },
      loanFirst:  { en: "First loan — who do you owe, and how much a month?", fil: "Sinong pinagkakautangan, at magkano monthly?" },
      loanNext:   { en: (n) => `Loan ${n} — who and how much?`, fil: (n) => `Loan ${n} — sino at magkano?` },
    },
    sib: {
      breather0:  { en: "Essentials noted. Power, water, internet — very predictable. Good.", fil: "Essentials. Naka-save. Ayos." },
      breather1:  { en: "Subscriptions. All logged. You're welcome.", fil: "Mga subscriptions. Naka-save. Tapos na." },
      countCards: { en: "Credit cards. Of course. How many?", fil: "Credit cards. Syempre. Ilan?" },
      countLoans: { en: "And loans. How deep does this go?", fil: "At mga loans. Hanggang saan ba to?" },
      more:       { en: (n) => `${n} bills. Anything else you've been avoiding?`, fil: (n) => `${n} na bills. May iba pa bang iniiwasan?` },
      cardFirst:  { en: "Which bank, and how much are you ignoring right now?", fil: "Anong bangko, at magkano ang iniiwan mo?" },
      cardNext:   { en: (n) => `Card ${n} — bank and amount.`, fil: (n) => `Card ${n} — bangko at halaga.` },
      loanFirst:  { en: "Who's the lender, and how much a month?", fil: "Sino ang nagpahiram at magkano monthly?" },
      loanNext:   { en: (n) => `Loan ${n} — who and how much.`, fil: (n) => `Loan ${n} — sino at magkano.` },
    },
    mama: {
      breather0:  { en: "Good anak, essentials are all saved — power, water, internet. Done.", fil: "Maganda anak, essentials naka-save na. Kuryente, tubig, internet — done." },
      breather1:  { en: "Subscriptions saved na anak. Good job keeping track.", fil: "Subscriptions naka-save na rin anak. Magaling ka talaga." },
      countCards: { en: "Now anak, the credit cards. How many do you have?", fil: "Ngayon anak, ang mga credit card. Ilan ang mayroon ka?" },
      countLoans: { en: "And any loans anak — personal, car, anything. How many?", fil: "At mga loans anak — personal, car, kahit ano. Ilan?" },
      more:       { en: (n) => `${n} bills na anak. Any more we should add?`, fil: (n) => `${n} bills na anak. May iba pa ba tayong idadagdag?` },
      cardFirst:  { en: "First card anak — which bank, and how much is due?", fil: "Sa una mong card anak, anong bangko, due date at magkano ang due?" },
      cardNext:   { en: (n) => `Card ${n} anak — same, which bank and amount?`, fil: (n) => `Card ${n} anak — anong bangko at magkano?` },
      loanFirst:  { en: "First loan anak — who's the lender and how much monthly?", fil: "Sinong nag pahiram sayo anak, magkano monthly at tuwing kelan mo kailangan bayaran?" },
      loanNext:   { en: (n) => `Loan ${n} anak — lender and monthly amount?`, fil: (n) => `Loan ${n} anak — sino at magkano monthly?` },
    },
    marites: {
      breather0:  { en: "Grabe! Essentials naka-save na! Power, water, internet — logged na lahat besh!", fil: "Grabe! Essentials naka-save na! Kuryente, tubig, internet — done na. Hinga muna." },
      breather1:  { en: "Ay! Subscriptions, saved na rin! Ang dami mo palang bayarin besh!", fil: "Mga subscriptions, naka-save! Wala nang makakalimutan." },
      countCards: { en: "Ay besh, credit cards na! Ilan ba?! Tell me everything!", fil: "Ngayon ang mga credit card. Ilan ang mayroon ka? Isa-isahin natin." },
      countLoans: { en: "At loans pa?! Grabe, may mga utang pa! Ilan?", fil: "At loans — personal, car, bahay, kahit ano. Ilan?" },
      more:       { en: (n) => `${n} bills na besh! May iba pa bang chismis — I mean, bills?`, fil: (n) => `${n} na bill na logged. May iba pa? Cards, loans, gym, insurance?` },
      cardFirst:  { en: "Sa una mong card, what's your bank, due date and amount due?", fil: "Sa una mong card, what's your bank, due date and amount due?" },
      cardNext:   { en: (n) => `Card ${n} — same details: bank, amount, due date?`, fil: (n) => `Card ${n} — same details: bank, amount, at kelan due?` },
      loanFirst:  { en: "Sinong nag pahiram sayo, magkano monthly at tuwing kelan mo kailangan bayaran?", fil: "Sinong nag pahiram sayo, magkano monthly at tuwing kelan mo kailangan bayaran?" },
      loanNext:   { en: (n) => `Loan ${n} — sino pa, magkano monthly, at kelan?`, fil: (n) => `Loan ${n} — sino pa, magkano monthly, at kelan?` },
    },
  } satisfies Record<PersonaId, BillFlow>,

} as const;
