/**
 * pregen-onb-voice.ts
 *
 * One-time script to pre-generate ALL Judith onboarding voice audio files and
 * store them in object storage (GCS) so that live ElevenLabs credits are never
 * consumed during user onboarding.
 *
 * Scope: 12 concepts × 5 personas × (1 en group + 1 fil group + 35 other langs)
 *         = 12 × 5 × 37 = 2,220 audio files
 *
 * Run:
 *   pnpm --filter @workspace/api-server run pregen-onb-voice
 *
 * The script is fully resumable — it checks GCS before generating and skips
 * anything already stored. Interrupt and re-run safely at any time.
 */

import { synthesize } from "../src/lib/elevenlabs.js";
import {
  DEFAULT_VOICE_IDS,
  FILIPINO_VOICE_IDS,
  getSpeakingSpeed,
  type PersonaId,
} from "../src/lib/personas.js";
import { setOnbAudio, hasOnbAudio } from "../src/lib/audioCache.js";

/* ── Personas ────────────────────────────────────────────────────────────── */

const PERSONAS: PersonaId[] = ["professional", "funny", "sarcastic", "mom", "marites", "britney"];

/* ── Concepts ────────────────────────────────────────────────────────────── */

const CONCEPTS = [
  "welcome", "language", "name",
  "lateFee", "problem", "stakes", "intro",
  "features0", "features1", "features2",
  "paywall", "personalizing",
] as const;

type Concept = typeof CONCEPTS[number];

/* ── English text per concept per persona ────────────────────────────────── */

const EN_TEXT: Record<Concept, Record<PersonaId, string>> = {
  welcome: {
    professional: "Hi \u2014 I\u2019m Judith. Your due date assistant. Let\u2019s take control of your bills, shall we?",
    funny:        "Hi \u2014 I\u2019m Judith. Your due date assistant. Let\u2019s take control of your bills, shall we?",
    sarcastic:    "Hi \u2014 I\u2019m Judith. Your due date assistant. Let\u2019s take control of your bills, shall we?",
    mom:          "Hi \u2014 I\u2019m Judith. Your due date assistant. Let\u2019s take control of your bills, shall we?",
    marites:      "Hi \u2014 I\u2019m Judith. Your due date assistant. Let\u2019s take control of your bills, shall we?",
    britney:      "Hi \u2014 I\u2019m Judith. Your due date assistant. Let\u2019s take control of your bills, shall we?",
  },
  language: {
    professional: "Take control of your bills, take control of your life.",
    funny:        "Take control of your bills, take control of your life.",
    sarcastic:    "Take control of your bills, take control of your life.",
    mom:          "Take control of your bills, take control of your life.",
    marites:      "Take control of your bills, take control of your life.",
    britney:      "Take control of your bills, take control of your life.",
  },
  name: {
    professional: "One more thing \u2014 what should I call you?",
    funny:        "One more thing \u2014 what should I call you?",
    sarcastic:    "One more thing \u2014 what should I call you?",
    mom:          "One more thing \u2014 what should I call you?",
    marites:      "One more thing \u2014 what should I call you?",
    britney:      "One more thing \u2014 what should I call you?",
  },
  lateFee: {
    professional: "We\u2019ve all been there \u2014 missed a payment, surprise fee. I\u2019m here to make sure that never happens again.",
    funny:        "Ugh, late fees \u2014 the worst! I\u2019m here so you never have to deal with that again.",
    sarcastic:    "Missed payment. Surprise fee. Happens to everyone. That\u2019s why I\u2019m here.",
    mom:          "Anak, don\u2019t worry \u2014 it happens to everyone. I\u2019m here to make sure it doesn\u2019t happen to you again.",
    marites:      "Ay grabe, late fees! The absolute worst! But besh, that\u2019s why I\u2019m here \u2014 hindi na maulit iyon!",
    britney:      "Missed payment. Late fee. It happens. I\u2019m here to make sure it doesn\u2019t happen again.",
  },
  problem: {
    professional: "Honestly, most people don\u2019t track their bills. Let\u2019s change that.",
    funny:        "Surprise \u2014 most people don\u2019t track their bills. But you\u2019re not most people anymore!",
    sarcastic:    "Most people don\u2019t track this. You\u2019re about to be different.",
    mom:          "Anak, most people don\u2019t track their bills. But that\u2019s okay \u2014 we\u2019re changing that right now.",
    marites:      "Ay besh, most people don\u2019t track their bills! Pero tayo \u2014 we\u2019re changing that na!",
    britney:      "Most people don\u2019t track their bills. You\u2019re changing that.",
  },
  stakes: {
    professional: "This doesn\u2019t have to be your situation. Let\u2019s change it \u2014 right now.",
    funny:        "Okay! Enough of that \u2014 let\u2019s flip the script! Right now, we change this!",
    sarcastic:    "This doesn\u2019t have to stay this way. Let\u2019s change it. Now.",
    mom:          "Anak, we\u2019re going to change this together \u2014 starting right now.",
    marites:      "Besh! No more of this! We\u2019re changing it right now! Let\u2019s go!",
    britney:      "This doesn\u2019t have to stay this way. Change it. Now.",
  },
  intro: {
    professional: "This usually takes 5 to 7 minutes. Let\u2019s map out every bill \u2014 I\u2019ll walk you through it.",
    funny:        "Okay! About 5 to 7 minutes and your whole bill life will make sense. Let\u2019s go!",
    sarcastic:    "About 5 to 7 minutes. Just answer my questions \u2014 it\u2019ll be worth it.",
    mom:          "Anak, this will only take 5 to 7 minutes. I\u2019ll walk you through everything, promise.",
    marites:      "Grabe besh, 5 to 7 minutes lang! Let\u2019s map all your bills \u2014 I cannot wait!",
    britney:      "About 5 to 7 minutes. Answer my questions. I\u2019ll walk you through it.",
  },
  features0: {
    professional: "Tap the question below — I’ll add up every bill you have this month.",
    funny:        "Ooh, the big question! Tap it — I’ll crunch every single bill right now!",
    sarcastic:    "Tap the question. I’ll total your bills for this month.",
    mom:          "Go ahead anak, tap the question — I’ll add everything up for you.",
    marites:      "Ay! Total bills this month?! Tap it besh — I know every single one!",
    britney:      "Tap the question. I’ll total your bills for this month.",
  },
  features1: {
    professional: "Now ask about your utilities and rent — tap the question below.",
    funny:        "Utilities AND rent?! Tap that question — I’ll add it all up for you!",
    sarcastic:    "Water, electricity, internet, rent. Tap the question. I’ll total it.",
    mom:          "Try asking about your utilities and rent anak — tap below and I’ll add it all up.",
    marites:      "Water! Electric! Internet! Rent! Tap the question besh — I’ll get the total!",
    britney:      "Utilities and rent. Tap the question. I’ll total it.",
  },
  features2: {
    professional: "Now let’s look ahead — tap below to see your estimated total for next month.",
    funny:        "Ooh, future planning! Tap it — I’ll project your entire next month for you!",
    sarcastic:    "Next month. Tap the question. I’ll estimate from what you’ve added.",
    mom:          "Let’s look at next month anak — tap the question and I’ll estimate everything for you.",
    marites:      "Next month na?! Ay besh, I’m already excited! Tap it — I’ll project it all!",
    britney:      "Tap the question. I’ll project your total bill for next month.",
  },
  paywall: {
    professional: "You\u2019ve got eight free asks to start. When you\u2019re ready for more, pick a plan and I\u2019m all yours.",
    funny:        "Eight free asks \u2014 on the house! Try me out, then come back when you\u2019re hooked. I\u2019ll wait.",
    sarcastic:    "Eight free asks. Use them. If you want more, pick a plan.",
    mom:          "Anak, you have eight free asks to start. Try them out \u2014 and when you want more, I\u2019ll be right here.",
    marites:      "Besh! Eight free asks \u2014 try me! And when you want to keep chatting, pick a plan! I\u2019ll be waiting!",
    britney:      "Eight free asks. Use them. Want more \u2014 pick a plan.",
  },
  personalizing: {
    professional: "Setting up your reminders now. Almost ready.",
    funny:        "Don\u2019t go anywhere \u2014 I\u2019m doing very important things back here!",
    sarcastic:    "Yeah yeah, I\u2019m working on it. Give me a second.",
    mom:          "Almost ready anak \u2014 I\u2019m making sure everything is just right for you.",
    marites:      "Ay grabe, so many bills! But I got you besh \u2014 almost done!",
    britney:      "Setting up your reminders. Almost done.",
  },
};

/* ── Filipino text per concept per persona ───────────────────────────────── */
// Note: "personalizing" has no .fil variant — uses the same English text with Filipino voices.

const FIL_TEXT: Record<Concept, Record<PersonaId, string>> = {
  welcome: {
    professional: "Hi \u2014 I\u2019m Judith. Your due date assistant. Aabangan ko lahat ng bills mo para hindi ka mabigla. Let\u2019s take control of your bills, shall we?",
    funny:        "Hi \u2014 I\u2019m Judith. Your due date assistant. Aabangan ko lahat ng bills mo para hindi ka mabigla. Let\u2019s take control of your bills, shall we?",
    sarcastic:    "Hi \u2014 I\u2019m Judith. Your due date assistant. Aabangan ko lahat ng bills mo para hindi ka mabigla. Let\u2019s take control of your bills, shall we?",
    mom:          "Hi \u2014 I\u2019m Judith. Your due date assistant. Aabangan ko lahat ng bills mo para hindi ka mabigla. Let\u2019s take control of your bills, shall we?",
    marites:      "Hi \u2014 I\u2019m Judith. Your due date assistant. Aabangan ko lahat ng bills mo para hindi ka mabigla. Let\u2019s take control of your bills, shall we?",
    britney:      "Hi \u2014 I\u2019m Judith. Your due date assistant. Aabangan ko lahat ng bills mo para hindi ka mabigla. Let\u2019s take control of your bills, shall we?",
  },
  language: {
    professional: "kapag kontrolado mo ang bills mo, kontrolado mo ang buhay mo. Agree?",
    funny:        "kapag kontrolado mo ang bills mo, kontrolado mo ang buhay mo. Agree?",
    sarcastic:    "kapag kontrolado mo ang bills mo, kontrolado mo ang buhay mo. Agree?",
    mom:          "kapag kontrolado mo ang bills mo, kontrolado mo ang buhay mo. Agree?",
    marites:      "kapag kontrolado mo ang bills mo, kontrolado mo ang buhay mo. Agree?",
    britney:      "kapag kontrolado mo ang bills mo, kontrolado mo ang buhay mo. Agree?",
  },
  name: {
    professional: "Hi! Can I get your name po?",
    funny:        "Hi! Can I get your name po?",
    sarcastic:    "Hi! Can I get your name po?",
    mom:          "Hi! Can I get your name po?",
    marites:      "Hi! Can I get your name po?",
    britney:      "Hi! Can I get your name po?",
  },
  lateFee: {
    professional: "Nangyayari ito sa lahat \u2014 napalampas na bayad, biglang multa. Nandito ako para hindi na mangyari ulit.",
    funny:        "Ay ang sama ng late fees! Pero wag nang mag-alala \u2014 nandito na ako para hindi na maulit!",
    sarcastic:    "Napalampas na bayad. Biglang multa. Nangyayari sa lahat. Kaya nandito ako.",
    mom:          "Huwag mag-alala anak. Nangyayari ito sa lahat. Nandito ako para hindi na maulit.",
    marites:      "Ay grabe, late fees! Ang pangit! Pero besh, nandito na ako \u2014 hindi na maulit \u2018yan!",
    britney:      "Napalampas na bayad. Biglang multa. Nangyayari sa lahat. Kaya nandito ako.",
  },
  problem: {
    professional: "Honestly, karamihan sa tao ay hindi nag-ta-track ng bills nila. Palitan na natin iyon.",
    funny:        "Grabe, karamihan hindi nag-ta-track ng bills! Pero ikaw \u2014 ikaw ay magiging iba na!",
    sarcastic:    "Karamihan hindi nag-ta-track. Ikaw ay magiging iba.",
    mom:          "Anak, karamihan hindi nag-ta-track ng bills. Pero okay lang \u2014 palitan na natin iyon ngayon.",
    marites:      "Ay besh, karamihan hindi nag-ta-track ng bills! Pero tayo \u2014 we\u2019re changing that na!",
    britney:      "Karamihan hindi nag-ta-track. Ikaw ay magiging iba.",
  },
  stakes: {
    professional: "Hindi na kailangang ganito ang sitwasyon mo. Palitan na natin ito \u2014 ngayon na.",
    funny:        "Sige! Tapos na sa ganyan! Palitan na natin \u2014 ngayon na!",
    sarcastic:    "Hindi na kailangang ganito. Palitan na natin. Ngayon.",
    mom:          "Anak, magbabago na tayo \u2014 simula ngayon. Sama-sama tayo.",
    marites:      "Besh! Tapos na! Palitan na natin ito ngayon! Let\u2019s go!",
    britney:      "Hindi na kailangang ganito. Palitan na natin. Ngayon.",
  },
  intro: {
    professional: "Aabutin ito ng 5 hanggang 7 minuto. I-map natin ang lahat ng bills mo.",
    funny:        "5 hanggang 7 minuto lang at magiging maayos na ang lahat! Tara na!",
    sarcastic:    "5 hanggang 7 minuto lang to. Sagutin mo lang ang mga tanong ko.",
    mom:          "Anak, 5 hanggang 7 minuto lang ito. Sasamahan kita sa lahat, promise.",
    marites:      "Grabe besh, 5 hanggang 7 minuto lang! I-map na natin ang lahat ng bills mo!",
    britney:      "5 hanggang 7 minuto lang. Sagutin mo ang mga tanong ko.",
  },
  features0: {
    professional: "I-tap ang tanong sa baba — i-total ko ang lahat ng bills mo ngayong buwan.",
    funny:        "Ay, ang laki ng tanong! I-tap na — kukwentahin ko lahat ng bills mo ngayon!",
    sarcastic:    "I-tap ang tanong. I-total ko ang bills mo ngayong buwan.",
    mom:          "Sige anak, i-tap ang tanong — i-add ko lahat para sa iyo.",
    marites:      "Ay! Total bills this month?! I-tap na besh — alam ko lahat!",
    britney:      "I-tap ang tanong. I-total ko ang bills mo ngayong buwan.",
  },
  features1: {
    professional: "Tanungin mo na ang utilities at renta — i-tap ang tanong sa baba.",
    funny:        "Utilities AT renta?! I-tap na — itatotal ko lahat para sa iyo!",
    sarcastic:    "Tubig, kuryente, internet, renta. I-tap ang tanong. I-total ko.",
    mom:          "Tanungin mo ang utilities at renta mo anak — i-tap sa baba at itatotal ko lahat.",
    marites:      "Tubig! Kuryente! Internet! Renta! I-tap na besh — kukunin ko ang total!",
    britney:      "Utilities at renta. I-tap ang tanong. I-total ko.",
  },
  features2: {
    professional: "Tignan natin ang susunod na buwan — i-tap sa baba para makita ang estimated total mo.",
    funny:        "Future planning na?! I-tap na — iproprojekt ko ang buong susunod na buwan para sa iyo!",
    sarcastic:    "Susunod na buwan. I-tap ang tanong. I-e-estimate ko mula sa mga bills mo.",
    mom:          "Tignan natin ang susunod na buwan anak — i-tap at i-e-estimate ko lahat para sa iyo.",
    marites:      "Susunod na buwan na?! Ay besh, excited na ako! I-tap na — iproprojekt ko lahat!",
    britney:      "I-tap ang tanong. Iproprojekt ko ang total bill mo para sa susunod na buwan.",
  },
  paywall: {
    professional: "May walong libreng tanong ka sa simula. Kapag gusto mo ng higit pa, pumili ng plano \u2014 nandito ako.",
    funny:        "Walong libreng tanong \u2014 regalo ko! Subukan mo ako, at kapag hooked ka na, bumalik ka!",
    sarcastic:    "Walong libreng tanong. Gamitin mo. Kung gusto mo pa, pumili ng plano.",
    mom:          "Anak, may walong libreng tanong ka. Subukan mo \u2014 at kapag gusto mo pa, nandito ako.",
    marites:      "Besh! Walong libreng tanong! Subukan mo ako! At kapag gusto mo pang makipag-chat \u2014 pick a plan! Waiting ako!",
    britney:      "Walong libreng tanong. Gamitin mo. Gusto mo pa \u2014 pumili ng plano.",
  },
  personalizing: {
    // No .fil variant — these send English text through Filipino voices.
    professional: "Setting up your reminders now. Almost ready.",
    funny:        "Don\u2019t go anywhere \u2014 I\u2019m doing very important things back here!",
    sarcastic:    "Yeah yeah, I\u2019m working on it. Give me a second.",
    mom:          "Almost ready anak \u2014 I\u2019m making sure everything is just right for you.",
    marites:      "Ay grabe, so many bills! But I got you besh \u2014 almost done!",
    britney:      "Setting up your reminders. Almost done.",
  },
};

/* ── Other-language translations per concept ─────────────────────────────── */
// These are the same text for all personas of a given concept+language.
// Voice differs per persona (DEFAULT_VOICE_IDS).

const TRANS: Record<Concept, Record<string, string>> = {
  welcome: {
    es: "Hola \u2014 soy Judith, tu asistente de vencimientos. Tomemos el control de tus facturas.",
    pt: "Oi \u2014 eu sou Judith, sua assistente de vencimentos. Vamos tomar o controle das suas contas.",
    "pt-PT": "Ol\u00e1 \u2014 sou a Judith, a tua assistente de datas de vencimento. Vamos tomar o controlo das tuas faturas.",
    fr: "Bonjour \u2014 je suis Judith, votre assistante de dates d\u2019\u00e9ch\u00e9ance. Prenons le contr\u00f4le de vos factures.",
    de: "Hallo \u2014 ich bin Judith, Ihre F\u00e4lligkeitsdaten-Assistentin. Lassen Sie uns Ihre Rechnungen unter Kontrolle bringen.",
    it: "Ciao \u2014 sono Judith, la tua assistente per le scadenze. Prendiamo il controllo delle tue bollette.",
    nl: "Hoi \u2014 ik ben Judith, uw vervaldatum-assistente. Laten we uw rekeningen onder controle brengen.",
    pl: "Cze\u015b\u0107 \u2014 jestem Judith, twoja asystentka termin\u00f3w p\u0142atno\u015bci. Przejmijmy kontrol\u0119 nad twoimi rachunkami.",
    sv: "Hej \u2014 jag \u00e4r Judith, din assistent f\u00f6r f\u00f6rfallodatum. L\u00e5t oss ta kontroll \u00f6ver dina r\u00e4kningar.",
    da: "Hej \u2014 jeg er Judith, din assistent for forfaldsdatoer. Lad os tage kontrol over dine regninger.",
    no: "Hei \u2014 jeg er Judith, din assistent for forfallsdatoer. La oss ta kontroll over regningene dine.",
    fi: "Hei \u2014 olen Judith, er\u00e4p\u00e4iv\u00e4avustajasi. Otetaan laskusi hallintaan.",
    cs: "Ahoj \u2014 jsem Judith, va\u0161e asistentka pro term\u00edny splatnosti. P\u0159evezm\u011bme kontrolu nad va\u0161imi \u00fa\u010dty.",
    sk: "Ahoj \u2014 som Judith, va\u0161a asistentka pre term\u00edny splatnosti. Prevezmime kontrolu nad va\u0161imi \u00fa\u010dtami.",
    ro: "Bun\u0103 \u2014 sunt Judith, asistenta ta pentru scaden\u021be. Hai s\u0103 prel\u0103u\u0103m controlul asupra facturilor tale.",
    bg: "\u0417\u0434\u0440\u0430\u0432\u0435\u0439 \u2014 \u0430\u0437 \u0441\u044a\u043c \u0414\u0436\u0443\u0434\u0438\u0442, \u0442\u0432\u043e\u044f\u0442 \u0430\u0441\u0438\u0441\u0442\u0435\u043d\u0442 \u0437\u0430 \u043f\u0430\u0434\u0435\u0436\u0438. \u041d\u0435\u043a\u0430 \u043f\u043e\u0435\u043c\u0435\u043c \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u0430 \u043d\u0430\u0434 \u0441\u043c\u0435\u0442\u043a\u0438\u0442\u0435 \u0442\u0438.",
    hr: "Bok \u2014 ja sam Judith, tvoja asistentka za rokove pla\u0107anja. Preuzimimo kontrolu nad tvojim ra\u010dunima.",
    el: "\u0393\u03b5\u03b9\u03b1 \u2014 \u03b5\u03af\u03bc\u03b1\u03b9 \u03b7 \u03a4\u03b6\u03bf\u03cd\u03bd\u03c4\u03b9\u03b8, \u03b7 \u03b2\u03bf\u03b7\u03b8\u03cc\u03c2 \u03c3\u03bf\u03c5 \u03b3\u03b9\u03b1 \u03c4\u03b9\u03c2 \u03b7\u03bc\u03b5\u03c1\u03bf\u03bc\u03b7\u03bd\u03af\u03b5\u03c2 \u03bb\u03ae\u03be\u03b7\u03c2. \u0391\u03c2 \u03c0\u03ac\u03c1\u03bf\u03c5\u03bc\u03b5 \u03c4\u03bf\u03bd \u03ad\u03bb\u03b5\u03b3\u03c7\u03bf \u03c4\u03c9\u03bd \u03bb\u03bf\u03b3\u03b1\u03c1\u03b9\u03b1\u03c3\u03bc\u03ce\u03bd \u03c3\u03bf\u03c5.",
    hu: "Szia \u2014 Judith vagyok, a fizet\u00e9si hat\u00e1rid\u0151-asszisztensed. Vegy\u00fck k\u00e9zbe a sz\u00e1ml\u00e1idat.",
    uk: "\u041f\u0440\u0438\u0432\u0456\u0442 \u2014 \u044f \u0414\u0436\u0443\u0434\u0456\u0442, \u0432\u0430\u0448 \u043f\u043e\u043c\u0456\u0447\u043d\u0438\u043a \u0437 \u0442\u0435\u0440\u043c\u0456\u043d\u0456\u0432 \u043f\u043b\u0430\u0442\u0435\u0436\u0456\u0432. \u0414\u0430\u0432\u0430\u0439\u0442\u0435 \u0432\u0456\u0437\u044c\u043c\u0435\u043c\u043e \u0432\u0430\u0448\u0456 \u0440\u0430\u0445\u0443\u043d\u043a\u0438 \u043f\u0456\u0434 \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u044c.",
    ru: "\u041f\u0440\u0438\u0432\u0435\u0442 \u2014 \u044f \u0414\u0436\u0443\u0434\u0438\u0442, \u0432\u0430\u0448 \u043f\u043e\u043c\u043e\u0449\u043d\u0438\u043a \u043f\u043e \u0441\u0440\u043e\u043a\u0430\u043c \u043f\u043b\u0430\u0442\u0435\u0436\u0435\u0439. \u0414\u0430\u0432\u0430\u0439\u0442\u0435 \u0432\u043e\u0437\u044c\u043c\u0451\u043c \u0432\u0430\u0448\u0438 \u0441\u0447\u0435\u0442\u0430 \u043f\u043e\u0434 \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u044c.",
    tr: "Merhaba \u2014 ben Judith, vade tarihi asistan\u0131n\u0131z\u0131m. Faturalar\u0131n\u0131z\u0131 kontrol alt\u0131na alal\u0131m.",
    ar: "\u0645\u0631\u062d\u0628\u0627\u064b \u2014 \u0623\u0646\u0627 \u062c\u0648\u062f\u064a\u062b\u060c \u0645\u0633\u0627\u0639\u062f\u062a\u0643 \u0644\u0645\u0648\u0627\u0639\u064a\u062f \u0627\u0644\u0627\u0633\u062a\u062d\u0642\u0627\u0642. \u0644\u0646\u062a\u062d\u0643\u0645 \u0641\u064a \u0641\u0648\u0627\u062a\u064a\u0631\u0643 \u0645\u0639\u0627\u064b.",
    arz: "\u0623\u0647\u0644\u0627\u064b \u2014 \u0623\u0646\u0627 \u062c\u0648\u062f\u064a\u062b\u060c \u0627\u0644\u0645\u0633\u0627\u0639\u062f\u0629 \u0628\u062a\u0627\u0639\u062a\u0643 \u0644\u0645\u0648\u0627\u0639\u064a\u062f \u0627\u0644\u0627\u0633\u062a\u062d\u0642\u0627\u0642. \u062e\u0644\u064a\u0646\u0627 \u0646\u062a\u062d\u0643\u0645 \u0641\u064a \u0641\u0648\u0627\u062a\u064a\u0631\u0643 \u0645\u0639 \u0628\u0639\u0636.",
    apc: "\u0645\u0631\u062d\u0628\u0627 \u2014 \u0623\u0646\u0627 \u062c\u0648\u062f\u064a\u062b\u060c \u0645\u0633\u0627\u0639\u062f\u062a\u0643 \u0644\u0645\u0648\u0627\u0639\u064a\u062f \u0627\u0644\u0627\u0633\u062a\u062d\u0642\u0627\u0642. \u062e\u0644\u064a\u0646\u0627 \u0646\u062a\u062d\u0643\u0645 \u0628\u0641\u0648\u0627\u062a\u064a\u0631\u0643 \u0645\u0639 \u0628\u0639\u0636.",
    afb: "\u0647\u0644\u0627 \u2014 \u0623\u0646\u0627 \u062c\u0648\u062f\u064a\u062b\u060c \u0645\u0633\u0627\u0639\u062f\u062a\u0643 \u0644\u0645\u0648\u0627\u0639\u064a\u062f \u0627\u0644\u0627\u0633\u062a\u062d\u0642\u0627\u0642. \u0646\u0623\u062e\u0630 \u0628\u0632\u0645\u0627\u0645 \u0641\u0648\u0627\u062a\u064a\u0631\u0643 \u0645\u0639 \u0628\u0639\u0636.",
    hi: "\u0928\u092e\u0938\u094d\u0924\u0947 \u2014 \u092e\u0948\u0902 \u091c\u0942\u0921\u093f\u0925 \u0939\u0942\u0901, \u0906\u092a\u0915\u0940 \u0926\u0947\u092f \u0924\u093f\u0925\u093f \u0938\u0939\u093e\u092f\u0915\u0964 \u0906\u0907\u090f \u0905\u092a\u0928\u0947 \u092c\u093f\u0932\u094b\u0902 \u092a\u0930 \u0928\u093f\u092f\u0902\u0924\u094d\u0930\u0923 \u092a\u093e\u090f\u0902\u0964",
    ta: "\u0bb5\u0ba3\u0b95\u0bcd\u0b95\u0bae\u0bcd \u2014 \u0ba8\u0bbe\u0ba9\u0bcd \u0b9c\u0bc2\u0b9f\u0bbf\u0ba4\u0bcd, \u0b89\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0ba4\u0bb5\u0ba3\u0bc8 \u0ba4\u0bc7\u0ba4\u0bbf \u0b89\u0ba4\u0bb5\u0bbf\u0baf\u0bbe\u0bb3\u0bb0\u0bcd. \u0b89\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0b95\u0b9f\u0bcd\u0b9f\u0ba3\u0b99\u0bcd\u0b95\u0bb3\u0bc8 \u0b95\u0b9f\u0bcd\u0b9f\u0bc1\u0baa\u0bcd\u0baa\u0b9f\u0bc1\u0ba4\u0bcd\u0ba4\u0bc1\u0bb5\u0bcb\u0bae\u0bcd.",
    ja: "\u3053\u3093\u306b\u3061\u306f \u2014 \u30b8\u30e5\u30c7\u30a3\u30b9\u3067\u3059\u3002\u304a\u652f\u6255\u3044\u671f\u65e5\u306e\u30a2\u30b7\u30b9\u30bf\u30f3\u30c8\u3068\u3057\u3066\u3001\u4e00\u7dd2\u306b\u8acb\u6c42\u66f8\u3092\u7ba1\u7406\u3057\u307e\u3057\u3087\u3046\u3002",
    ko: "\uc548\ub155\ud558\uc138\uc694 \u2014 \uc800\ub294 \uc8fc\ub514\uc2a4\uc608\uc694, \ub0a9\ubd80\uc77c \ub3c4\uc6b0\ubbf8\uc785\ub2c8\ub2e4. \ud568\uaed8 \uccad\uad6c\uc11c\ub97c \uad00\ub9ac\ud574 \ubd10\uc694.",
    zh: "\u4f60\u597d \u2014 \u6211\u662f\u8339\u8fea\u4e1d\uff0c\u4f60\u7684\u8d26\u5355\u5230\u671f\u65e5\u52a9\u624b\u3002\u8ba9\u6211\u4eec\u4e00\u8d77\u7ba1\u7406\u4f60\u7684\u8d26\u5355\u3002",
    yue: "\u4f60\u597d \u2014 \u6211\u4fc2\u8339\u8fea\u7d72\uff0c\u4f60\u5605\u8cec\u55ae\u5230\u671f\u65e5\u52a9\u624b\u3002\u4e00\u9f4a\u7ba1\u597d\u4f60\u5605\u8cec\u55ae\u554a\u3002",
    id: "Halo \u2014 aku Judith, asisten tanggal jatuh tempo kamu. Yuk kita kendalikan tagihan kamu bersama.",
    ms: "Hai \u2014 saya Judith, pembantu tarikh matang anda. Jom kita kawal bil-bil anda bersama-sama.",
    vi: "Ch\u00e0o \u2014 t\u00f4i l\u00e0 Judith, tr\u1ee3 l\u00fd ng\u00e0y \u0111\u00e1o h\u1ea1n c\u1ee7a b\u1ea1n. H\u00e3y c\u00f9ng ki\u1ec3m so\u00e1t c\u00e1c h\u00f3a \u0111\u01a1n c\u1ee7a b\u1ea1n.",
    th: "\u0e2a\u0e27\u0e31\u0e2a\u0e14\u0e35 \u2014 \u0e09\u0e31\u0e19\u0e04\u0e37\u0e2d\u0e08\u0e39\u0e14\u0e34\u0e18 \u0e1c\u0e39\u0e49\u0e0a\u0e48\u0e27\u0e22\u0e14\u0e49\u0e32\u0e19\u0e27\u0e31\u0e19\u0e04\u0e23\u0e1a\u0e01\u0e33\u0e2b\u0e19\u0e14\u0e02\u0e2d\u0e07\u0e04\u0e38\u0e13 \u0e43\u0e2b\u0e49\u0e40\u0e23\u0e32\u0e08\u0e31\u0e14\u0e01\u0e32\u0e23\u0e1a\u0e34\u0e25\u0e02\u0e2d\u0e07\u0e04\u0e38\u0e13\u0e14\u0e49\u0e27\u0e22\u0e01\u0e31\u0e19",
  },
  language: {
    es: "Toma el control de tus facturas, toma el control de tu vida.",
    pt: "Tome o controle das suas contas, tome o controle da sua vida.",
    "pt-PT": "Toma o controlo das tuas faturas, toma o controlo da tua vida.",
    fr: "Ma\u00eetrisez vos factures, ma\u00eetrisez votre vie.",
    de: "Behalten Sie Ihre Rechnungen im Griff, behalten Sie Ihr Leben im Griff.",
    it: "Controlla le tue bollette, controlla la tua vita.",
    nl: "Beheer uw rekeningen, beheer uw leven.",
    pl: "Kontroluj swoje rachunki, kontroluj swoje \u017cycie.",
    sv: "Ta kontroll \u00f6ver dina r\u00e4kningar, ta kontroll \u00f6ver ditt liv.",
    da: "Tag kontrol over dine regninger, tag kontrol over dit liv.",
    no: "Ta kontroll over regningene dine, ta kontroll over livet ditt.",
    fi: "Hallitse laskusi, hallitse el\u00e4m\u00e4si.",
    cs: "Ovl\u00e1dn\u011bte sv\u00e9 \u00fa\u010dty, ovl\u00e1dn\u011bte sv\u016fj \u017eivot.",
    sk: "Ovl\u00e1dnite svoje \u00fa\u010dty, ovl\u00e1dnite svoj \u017eivot.",
    ro: "Controleaz\u0103-\u021bi facturile, controleaz\u0103-\u021bi via\u021ba.",
    bg: "\u0423\u043f\u0440\u0430\u0432\u043b\u044f\u0432\u0430\u0439 \u0441\u043c\u0435\u0442\u043a\u0438\u0442\u0435 \u0441\u0438, \u0443\u043f\u0440\u0430\u0432\u043b\u044f\u0432\u0430\u0439 \u0436\u0438\u0432\u043e\u0442\u0430 \u0441\u0438.",
    hr: "Kontroliraj svoje ra\u010dune, kontroliraj svoj \u017eivot.",
    el: "\u0388\u03bb\u03b5\u03b3\u03be\u03b5 \u03c4\u03bf\u03c5\u03c2 \u03bb\u03bf\u03b3\u03b1\u03c1\u03b9\u03b1\u03c3\u03bc\u03bf\u03cd\u03c2 \u03c3\u03bf\u03c5, \u03ad\u03bb\u03b5\u03b3\u03be\u03b5 \u03c4\u03b7 \u03b6\u03c9\u03ae \u03c3\u03bf\u03c5.",
    hu: "Vedd k\u00e9zbe a sz\u00e1ml\u00e1idat, vedd k\u00e9zbe az \u00e9letedet.",
    uk: "\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u044e\u0439\u0442\u0435 \u0441\u0432\u043e\u0457 \u0440\u0430\u0445\u0443\u043d\u043a\u0438 \u2014 \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u044e\u0439\u0442\u0435 \u0441\u0432\u043e\u0454 \u0436\u0438\u0442\u0442\u044f.",
    ru: "\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u0438\u0440\u0443\u0439\u0442\u0435 \u0441\u0432\u043e\u0438 \u0441\u0447\u0435\u0442\u0430 \u2014 \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u0438\u0440\u0443\u0439\u0442\u0435 \u0441\u0432\u043e\u044e \u0436\u0438\u0437\u043d\u044c.",
    tr: "Faturalar\u0131n\u0131z\u0131 kontrol edin, hayat\u0131n\u0131z\u0131 kontrol edin.",
    ar: "\u062a\u062d\u0643\u0645\u064a \u0641\u064a \u0641\u0648\u0627\u062a\u064a\u0631\u0643\u060c \u062a\u062d\u0643\u0645\u064a \u0641\u064a \u062d\u064a\u0627\u062a\u0643.",
    arz: "\u062a\u062d\u0643\u0645\u064a \u0641\u064a \u0641\u0648\u0627\u062a\u064a\u0631\u0643\u060c \u062a\u062d\u0643\u0645\u064a \u0641\u064a \u062d\u064a\u0627\u062a\u0643.",
    apc: "\u062a\u062d\u0643\u0645\u064a \u0628\u0641\u0648\u0627\u062a\u064a\u0631\u0643\u060c \u062a\u062d\u0643\u0645\u064a \u0628\u062d\u064a\u0627\u062a\u0643.",
    afb: "\u062a\u062d\u0643\u0645\u064a \u0628\u0641\u0648\u0627\u062a\u064a\u0631\u0643\u060c \u062a\u062d\u0643\u0645\u064a \u0628\u062d\u064a\u0627\u062a\u0643.",
    hi: "\u0905\u092a\u0928\u0947 \u092c\u093f\u0932\u094b\u0902 \u092a\u0930 \u0928\u093f\u092f\u0902\u0924\u094d\u0930\u0923 \u0930\u0916\u0947\u0902, \u0905\u092a\u0928\u0947 \u091c\u0940\u0935\u0928 \u092a\u0930 \u0928\u093f\u092f\u0902\u0924\u094d\u0930\u0923 \u0930\u0916\u0947\u0902\u0964",
    ta: "\u0b89\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0b95\u0b9f\u0bcd\u0b9f\u0ba3\u0b99\u0bcd\u0b95\u0bb3\u0bc8 \u0b95\u0b9f\u0bcd\u0b9f\u0bc1\u0baa\u0bcd\u0baa\u0b9f\u0bc1\u0ba4\u0bcd\u0ba4\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd, \u0b89\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0bb5\u0bbe\u0bb4\u0bcd\u0b95\u0bcd\u0b95\u0bc8\u0baf\u0bc8 \u0b95\u0b9f\u0bcd\u0b9f\u0bc1\u0baa\u0bcd\u0baa\u0b9f\u0bc1\u0ba4\u0bcd\u0ba4\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd.",
    ja: "\u652f\u6255\u3044\u3092\u7ba1\u7406\u3059\u308c\u3070\u3001\u751f\u6d3b\u3092\u7ba1\u7406\u3067\u304d\u307e\u3059\u3002",
    ko: "\uccad\uad6c\uc11c\ub97c \uad00\ub9ac\ud558\uba74, \uc0b6\uc744 \uad00\ub9ac\ud560 \uc218 \uc788\uc5b4\uc694.",
    zh: "\u7ba1\u7406\u597d\u8d26\u5355\uff0c\u5c31\u662f\u7ba1\u7406\u597d\u751f\u6d3b\u3002",
    yue: "\u7ba1\u597d\u8cec\u55ae\uff0c\u5c31\u4fc2\u7ba1\u597d\u751f\u6d3b\u3002",
    id: "Kendalikan tagihanmu, kendalikan hidupmu.",
    ms: "Kawal bil anda, kawal kehidupan anda.",
    vi: "Ki\u1ec3m so\u00e1t h\u00f3a \u0111\u01a1n c\u1ee7a b\u1ea1n, ki\u1ec3m so\u00e1t cu\u1ed9c s\u1ed1ng c\u1ee7a b\u1ea1n.",
    th: "\u0e04\u0e27\u0e1a\u0e04\u0e38\u0e21\u0e1a\u0e34\u0e25\u0e02\u0e2d\u0e07\u0e04\u0e38\u0e13 \u0e04\u0e27\u0e1a\u0e04\u0e38\u0e21\u0e0a\u0e35\u0e27\u0e34\u0e15\u0e02\u0e2d\u0e07\u0e04\u0e38\u0e13",
  },
  name: {
    es: "Una cosa m\u00e1s \u2014 \u00bfc\u00f3mo debo llamarte?",
    pt: "Mais uma coisa \u2014 como devo te chamar?",
    "pt-PT": "Mais uma coisa \u2014 como me devo dirigir a ti?",
    fr: "Encore une chose \u2014 comment dois-je vous appeler?",
    de: "Noch eine Sache \u2014 wie soll ich Sie nennen?",
    it: "Un\u2019ultima cosa \u2014 come devo chiamarti?",
    nl: "Nog \u00e9\u00e9n ding \u2014 hoe moet ik u noemen?",
    pl: "Jeszcze jedno \u2014 jak mam ci\u0119 nazywa\u0107?",
    sv: "En sak till \u2014 vad ska jag kalla dig?",
    da: "En ting til \u2014 hvad skal jeg kalde dig?",
    no: "En ting til \u2014 hva skal jeg kalle deg?",
    fi: "Viel\u00e4 yksi asia \u2014 kuinka minun pit\u00e4isi kutsua sinua?",
    cs: "Je\u0161t\u011b jedna v\u011bc \u2014 jak v\u00e1s m\u00e1m oslovovat?",
    sk: "E\u0161te jedna vec \u2014 ako v\u00e1s m\u00e1m oslova\u0165?",
    ro: "\u00cenc\u0103 un lucru \u2014 cum ar trebui s\u0103 te numesc?",
    bg: "\u041e\u0449\u0435 \u0435\u0434\u043d\u043e \u043d\u0435\u0449\u043e \u2014 \u043a\u0430\u043a \u0434\u0430 \u0442\u0435 \u043d\u0430\u0440\u0435\u043a\u0430?",
    hr: "Jo\u0161 jedna stvar \u2014 kako da te zovem?",
    el: "\u0391\u03ba\u03cc\u03bc\u03b1 \u03ad\u03bd\u03b1 \u03c0\u03c1\u03ac\u03b3\u03bc\u03b1 \u2014 \u03c0\u03ce\u03c2 \u03c0\u03c1\u03ad\u03c0\u03b5\u03b9 \u03bd\u03b1 \u03c3\u03b5 \u03c6\u03c9\u03bd\u03ac\u03b6\u03c9;",
    hu: "M\u00e9g egy dolog \u2014 hogyan sz\u00f3l\u00edtsalak?",
    uk: "\u0429\u0435 \u043e\u0434\u043d\u0435 \u2014 \u044f\u043a \u043c\u0435\u043d\u0456 \u0432\u0430\u0441 \u043d\u0430\u0437\u0438\u0432\u0430\u0442\u0438?",
    ru: "\u0415\u0449\u0451 \u043e\u0434\u043d\u043e \u2014 \u043a\u0430\u043a \u043c\u043d\u0435 \u0432\u0430\u0441 \u043d\u0430\u0437\u044b\u0432\u0430\u0442\u044c?",
    tr: "Bir \u015fey daha \u2014 sizi nas\u0131l \u00e7a\u011f\u0131rmal\u0131y\u0131m?",
    ar: "\u0634\u064a\u0621 \u0623\u062e\u064a\u0631 \u2014 \u0643\u064a\u0641 \u064a\u062c\u0628 \u0623\u0646 \u0623\u0646\u0627\u062f\u064a\u0643\u0650?",
    arz: "\u062d\u0627\u062c\u0629 \u062a\u0627\u0646\u064a\u0629 \u2014 \u0623\u0646\u0627 \u0623\u0646\u0627\u062f\u064a \u0639\u0644\u064a\u0643\u0650 \u0625\u0632\u0627\u064a?",
    apc: "\u0634\u064a \u062a\u0627\u0646\u064a \u2014 \u0643\u064a\u0641 \u0644\u0627\u0632\u0645 \u0623\u0646\u0627\u062f\u064a\u0643\u0650?",
    afb: "\u0634\u064a \u062b\u0627\u0646\u064a \u2014 \u0643\u064a\u0641 \u0644\u0627\u0632\u0645 \u0623\u0646\u0627\u062f\u064a\u0643\u0650?",
    hi: "\u090f\u0915 \u0914\u0930 \u092c\u093e\u0924 \u2014 \u092e\u0941\u091d\u0947 \u0906\u092a\u0915\u094b \u0915\u094d\u092f\u093e \u092c\u0941\u0932\u093e\u0928\u093e \u091a\u093e\u0939\u093f\u090f?",
    ta: "\u0b87\u0ba9\u0bcd\u0ba9\u0bca\u0bb0\u0bc1 \u0bb5\u0bbf\u0bb7\u0baf\u0bae\u0bcd \u2014 \u0b89\u0b99\u0bcd\u0b95\u0bb3\u0bc8 \u0ba8\u0bbe\u0ba9\u0bcd \u0b8e\u0ba9\u0bcd\u0ba9\u0bb5\u0bc6\u0ba9\u0bcd\u0bb1\u0bc1 \u0b85\u0bb4\u0bc8\u0b95\u0bcd\u0b95 \u0bb5\u0bc7\u0ba3\u0bcd\u0b9f\u0bc1\u0bae\u0bcd?",
    ja: "\u3082\u3046\u4e00\u3064 \u2014 \u3042\u306a\u305f\u306e\u3053\u3068\u3092\u3069\u3046\u547c\u3079\u3070\u3088\u3044\u3067\u3059\u304b?",
    ko: "\ud55c \uac00\uc9c0 \ub354 \u2014 \uc5b4\ub5bb\uac8c \ubd88\ub7ec \ub4dc\ub9b4\uae4c\uc694?",
    zh: "\u8fd8\u6709\u4e00\u4ef6\u4e8b \u2014 \u6211\u5e94\u8be5\u600e\u4e48\u79f0\u547c\u4f60?",
    yue: "\u4ef2\u6709\u4e00\u4ef6\u4e8b \u2014 \u6211\u61c9\u8a72\u9ede\u7a31\u547c\u4f60\uff1f",
    id: "Satu hal lagi \u2014 bagaimana aku harus memanggilmu?",
    ms: "Satu lagi perkara \u2014 bagaimana saya harus memanggil anda?",
    vi: "Th\u00eam m\u1ed9t \u0111i\u1ec1u n\u1eefa \u2014 t\u00f4i n\u00ean g\u1ecdi b\u1ea1n l\u00e0 g\u00ec?",
    th: "\u0e2d\u0e35\u0e01\u0e2a\u0e34\u0e48\u0e07\u0e2b\u0e19\u0e36\u0e48\u0e07 \u2014 \u0e09\u0e31\u0e19\u0e04\u0e27\u0e23\u0e40\u0e23\u0e35\u0e22\u0e01\u0e04\u0e38\u0e13\u0e27\u0e48\u0e32\u0e2d\u0e30\u0e44\u0e23?",
  },
  lateFee: {
    es: "Estoy aqu\u00ed para que nunca vuelvas a llevarte una sorpresa con una mora.",
    pt: "Estou aqui para que voc\u00ea nunca seja pega de surpresa por uma multa de atraso.",
    "pt-PT": "Estou aqui para que nunca sejas apanhada de surpresa por uma mora.",
    fr: "Je suis l\u00e0 pour que vous ne soyez plus jamais pris par surprise par des p\u00e9nalit\u00e9s de retard.",
    de: "Ich bin hier, damit Sie nie wieder von einer Verzugsgeb\u00fchr \u00fcberrascht werden.",
    it: "Sono qui perch\u00e9 tu non venga mai pi\u00f9 colta di sorpresa da una mora.",
    nl: "Ik ben hier zodat u nooit meer verrast wordt door een late betalingskosten.",
    pl: "Jestem tu, \u017cebyś nigdy więcej nie była zaskoczona op\u0142at\u0105 za sp\u00f3\u017anienie.",
    sv: "Jag \u00e4r h\u00e4r f\u00f6r att du aldrig mer ska bli \u00f6verraskad av en f\u00f6rseningsavgift.",
    da: "Jeg er her, s\u00e5 du aldrig mere bliver overrasket af et gebyr for forsinket betaling.",
    no: "Jeg er her slik at du aldri mer blir overrasket av et gebyr for forsinket betaling.",
    fi: "Olen t\u00e4\u00e4ll\u00e4, jotta et koskaan en\u00e4\u00e4 ylttyisi my\u00f6h\u00e4stymismaksusta.",
    cs: "Jsem tu, abyste nikdy neby\u010dte p\u0159ekvapena poplatkem za pozdní platbu.",
    sk: "Som tu, aby v\u00e1s nikdy neprekvapil poplatok za omeškanie.",
    ro: "Sunt aici ca s\u0103 nu fii niciodat\u0103 surprins\u0103 de o penalitate de \u00eent\u00e2rziere.",
    bg: "\u0422\u0443\u043a \u0441\u044a\u043c, \u0437\u0430 \u0434\u0430 \u043d\u0435 \u0442\u0435 \u0438\u0437\u043d\u0435\u043d\u0430\u0434\u0430 \u0442\u0430\u043a\u0441\u0430 \u0437\u0430 \u0437\u0430\u043a\u044a\u0441\u043d\u0435\u043d\u0438\u0435.",
    hr: "Ovdje sam da te nikada vi\u0161e ne iznenadi naknada za ka\u0161njenje.",
    el: "\u0395\u03af\u03bc\u03b1\u03b9 \u03b5\u03b4\u03ce \u03ce\u03c3\u03c4\u03b5 \u03bd\u03b1 \u03bc\u03b7\u03bd \u03c3\u03b5 \u03b5\u03ba\u03c0\u03bb\u03ae\u03be\u03b5\u03b9 \u03c0\u03bf\u03c4\u03ad \u03c0\u03ac\u03bb\u03b9 \u03bc\u03b9\u03b1 \u03c7\u03c1\u03ad\u03c9\u03c3\u03b7 \u03ba\u03b1\u03b8\u03c5\u03c3\u03c4\u03ad\u03c1\u03b7\u03c3\u03b7\u03c2.",
    hu: "Az\u00e9rt vagyok itt, hogy soha t\u00f6bb\u00e9 ne lepjen meg egy k\u00e9sedelmi d\u00edj.",
    uk: "\u042f \u0442\u0443\u0442, \u0449\u043e\u0431 \u0432\u0430\u0441 \u043d\u0456\u043a\u043e\u043b\u0438 \u0431\u0456\u043b\u044c\u0448\u0435 \u043d\u0435 \u0437\u0430\u0441\u0442\u0430\u0432 \u0437\u043d\u0435\u043d\u0430\u0446\u044c\u043a\u0430 \u0448\u0442\u0440\u0430\u0444 \u0437\u0430 \u043f\u0440\u043e\u0441\u0442\u0440\u043e\u0447\u0435\u043d\u043d\u044f.",
    ru: "\u042f \u0437\u0434\u0435\u0441\u044c, \u0447\u0442\u043e\u0431\u044b \u0432\u0430\u0441 \u043d\u0438\u043a\u043e\u0433\u0434\u0430 \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0435 \u0437\u0430\u0441\u0442\u0430\u043b \u0432\u0440\u0430\u0441\u043f\u043b\u043e\u0445 \u0448\u0442\u0440\u0430\u0444 \u0437\u0430 \u043f\u0440\u043e\u0441\u0440\u043e\u0447\u043a\u0443.",
    tr: "Bir daha asla ge\u00e7 \u00f6deme \u00fccret s\u00fcrpriziyle kar\u015f\u0131la\u015fmaman\u0131z i\u00e7in buradayim.",
    ar: "\u0623\u0646\u0627 \u0647\u0646\u0627 \u062d\u062a\u0649 \u0644\u0627 \u062a\u064f\u0641\u0627\u062c\u0626\u064a\u0643\u0650 \u0631\u0633\u0648\u0645 \u0627\u0644\u062a\u0623\u062e\u064a\u0631 \u0623\u0628\u062f\u0627\u064b \u0645\u0646 \u062c\u062f\u064a\u062f.",
    arz: "\u0623\u0646\u0627 \u0647\u0646\u0627 \u0639\u0634\u0627\u0646 \u0645\u0635\u0627\u0631\u064a\u0641 \u0627\u0644\u062a\u0623\u062e\u064a\u0631 \u0645\u0627 \u062a\u062a\u0641\u0627\u062c\u0626\u064a\u0643\u0650\u0634 \u062a\u0627\u0646\u064a.",
    apc: "\u0623\u0646\u0627 \u0647\u0648\u0646 \u062d\u062a\u0649 \u0645\u0627 \u064a\u0641\u0627\u062c\u0626\u0648\u0643\u0650 \u0631\u0633\u0648\u0645 \u0627\u0644\u062a\u0623\u062e\u064a\u0631 \u0645\u0646 \u062c\u062f\u064a\u062f.",
    afb: "\u0623\u0646\u0627 \u0647\u0646\u064a \u062d\u062a\u0649 \u0645\u0627 \u062a\u062a\u0641\u0627\u062c\u0626\u064a\u0646 \u0628\u0631\u0633\u0648\u0645 \u0627\u0644\u062a\u0623\u062e\u064a\u0631 \u062b\u0627\u0646\u064a.",
    hi: "\u092e\u0948\u0902 \u092f\u0939\u093e\u0901 \u0939\u0942\u0901 \u0924\u093e\u0915\u093f \u0906\u092a \u0915\u092d\u0940 \u092d\u0940 \u0935\u093f\u0932\u0902\u092c \u0936\u0941\u0932\u094d\u0915 \u0938\u0947 \u091a\u094c\u0902\u0915\u0947 \u0928\u0939\u0940\u0902\u0964",
    ta: "\u0ba4\u0bbe\u0bae\u0ba4\u0b95\u0bcd \u0b95\u0b9f\u0bcd\u0b9f\u0ba3\u0bae\u0bcd \u0b92\u0bb0\u0bc1\u0baa\u0bcb\u0ba4\u0bc1\u0bae\u0bcd \u0b89\u0b99\u0bcd\u0b95\u0bb3\u0bc8 \u0b86\u0b9a\u0bcd\u0b9a\u0bb0\u0bbf\u0baf\u0baa\u0bcd\u0baa\u0b9f\u0bc1\u0ba4\u0bcd\u0ba4\u0bbe\u0bae\u0bb2\u0bcd \u0baa\u0bbe\u0bb0\u0bcd\u0ba4\u0bcd\u0ba4\u0bc1\u0b95\u0bcd\u0b95\u0bca\u0bb3\u0bcd\u0b95\u0bbf\u0bb1\u0bc7\u0ba9\u0bcd.",
    ja: "\u4e8c\u5ea6\u3068\u9045\u5ef6\u6599\u91d1\u306b\u99c5\u304b\u3055\u308c\u306a\u3044\u305f\u3081\u306b\u3001\u3053\u3053\u306b\u3044\u307e\u3059\u3002",
    ko: "\ub2e4\uc2dc\ub294 \uc5f0\uccb4\ub8cc\uc5d0 \ub180\ub77c\uc9c0 \uc54a\ub3c4\ub85d \uc81c\uac00 \uc5ec\uae30 \uc788\uc5b4\uc694.",
    zh: "\u6211\u5728\u8fd9\u91cc\uff0c\u786e\u4fdd\u4f60\u6c38\u8fdc\u4e0d\u4f1a\u88ab\u6ede\u7eb3\u91d1\u6240\u60ca\u5230\u3002",
    yue: "\u6211\u55ba\u5ea6\uff0c\u78ba\u4fdd\u4f60\u6c38\u9060\u5594\u4f1a\u4fe3\u6ede\u7d0d\u91d1\u9a5a\u6bba\u3002",
    id: "Aku di sini agar kamu tidak pernah lagi terkejut oleh denda keterlambatan.",
    ms: "Saya di sini supaya anda tidak pernah lagi terkejut dengan caj lewat bayar.",
    vi: "T\u00f4i \u1edf \u0111\u00e2y \u0111\u1ec3 b\u1ea1n kh\u00f4ng bao gi\u1edd b\u1ecb b\u1ea5t ng\u1edd b\u1edfi ph\u00ed tr\u1ec5 h\u1ea1n n\u1eefa.",
    th: "\u0e09\u0e31\u0e19\u0e2d\u0e22\u0e39\u0e48\u0e17\u0e35\u0e48\u0e19\u0e35\u0e48\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e43\u0e2b\u0e49\u0e04\u0e38\u0e13\u0e44\u0e21\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e40\u0e0b\u0e2d\u0e23\u0e4c\u0e44\u0e1e\u0e23\u0e4c\u0e01\u0e31\u0e1a\u0e04\u0e48\u0e32\u0e1b\u0e23\u0e31\u0e1a\u0e25\u0e48\u0e32\u0e0a\u0e49\u0e2d\u0e35\u0e01\u0e15\u0e48\u0e2d\u0e44\u0e1b",
  },
  problem: {
    es: "La mayor\u00eda de la gente no lleva el control de sus facturas. Cambiemos eso.",
    pt: "A maioria das pessoas n\u00e3o acompanha suas contas. Vamos mudar isso.",
    "pt-PT": "A maioria das pessoas n\u00e3o acompanha as suas faturas. Vamos mudar isso.",
    fr: "La plupart des gens ne suivent pas leurs factures. Changeons \u00e7a.",
    de: "Die meisten Menschen behalten ihre Rechnungen nicht im Blick. \u00c4ndern wir das.",
    it: "La maggior parte delle persone non tiene traccia delle proprie bollette. Cambiamo le cose.",
    nl: "De meeste mensen houden hun rekeningen niet bij. Laten we dat veranderen.",
    pl: "Wi\u0119kszo\u015b\u0107 ludzi nie \u015bledzi swoich rachunk\u00f3w. Zmie\u0144my to.",
    sv: "De flesta h\u00e5ller inte koll p\u00e5 sina r\u00e4kningar. L\u00e5t oss \u00e4ndra p\u00e5 det.",
    da: "De fleste holder ikke styr p\u00e5 deres regninger. Lad os \u00e6ndre det.",
    no: "De fleste holder ikke oversikt over regningene sine. La oss forandre det.",
    fi: "Useimmat ihmiset eiv\u00e4t seuraa laskujaan. Muutetaan se.",
    cs: "V\u011bt\u0161ina lid\u00ed nesleduje sv\u00e9 \u00fa\u010dty. Poj\u010fme to zm\u011bnit.",
    sk: "V\u00e4\u010d\u0161ina \u013aud\u00ed nesleduje svoje \u00fa\u010dty. Po\u010fme to zmeni\u0165.",
    ro: "Cei mai mul\u021bi oameni nu \u00ee\u015bi urm\u0103resc facturile. Hai s\u0103 schimb\u0103m asta.",
    bg: "\u041f\u043e\u0432\u0435\u0447\u0435\u0442\u043e \u0445\u043e\u0440\u0430 \u043d\u0435 \u0441\u043b\u0435\u0434\u044f\u0442 \u0441\u043c\u0435\u0442\u043a\u0438\u0442\u0435 \u0441\u0438. \u041d\u0435\u043a\u0430 \u0434\u0430 \u0433\u043e \u043f\u0440\u043e\u043c\u0435\u043d\u0438\u043c.",
    hr: "Ve\u0107ina ljudi ne prati svoje ra\u010dune. Promijenimo to.",
    el: "\u039f\u03b9 \u03c0\u03b5\u03c1\u03b9\u03c3\u03c3\u03cc\u03c4\u03b5\u03c1\u03bf\u03b9 \u03b4\u03b5\u03bd \u03c0\u03b1\u03c1\u03b1\u03ba\u03bf\u03bb\u03bf\u03c5\u03b8\u03bf\u03cd\u03bd \u03c4\u03bf\u03c5\u03c2 \u03bb\u03bf\u03b3\u03b1\u03c1\u03b9\u03b1\u03c3\u03bc\u03bf\u03cd\u03c2 \u03c4\u03bf\u03c5\u03c2. \u0391\u03c2 \u03b1\u03bb\u03bb\u03ac\u03be\u03bf\u03c5\u03bc\u03b5 \u03b1\u03c5\u03c4\u03cc.",
    hu: "A legt\u00f6bb ember nem k\u00f6veti nyomon a sz\u00e1ml\u00e1it. V\u00e1ltoztassunk ezen.",
    uk: "\u0411\u0456\u043b\u044c\u0448\u0456\u0441\u0442\u044c \u043b\u044e\u0434\u0435\u0439 \u043d\u0435 \u0432\u0456\u0434\u0441\u0442\u0435\u0436\u0443\u044e\u0442\u044c \u0441\u0432\u043e\u0457 \u0440\u0430\u0445\u0443\u043d\u043a\u0438. \u0414\u0430\u0432\u0430\u0439\u0442\u0435 \u0437\u043c\u0456\u043d\u0438\u043c\u043e \u0446\u0435.",
    ru: "\u0411\u043e\u043b\u044c\u0448\u0438\u043d\u0441\u0442\u0432\u043e \u043b\u044e\u0434\u0435\u0439 \u043d\u0435 \u0441\u043b\u0435\u0434\u044f\u0442 \u0437\u0430 \u0441\u0432\u043e\u0438\u043c\u0438 \u0441\u0447\u0435\u0442\u0430\u043c\u0438. \u0414\u0430\u0432\u0430\u0439\u0442\u0435 \u0438\u0437\u043c\u0435\u043d\u0438\u043c \u044d\u0442\u043e.",
    tr: "\u00c7o\u011fu insan faturalar\u0131n\u0131 takip etmez. Bunu de\u011fi\u015ftirelim.",
    ar: "\u0645\u0639\u0638\u0645 \u0627\u0644\u0646\u0627\u0633 \u0644\u0627 \u064a\u062a\u0627\u0628\u0639\u0648\u0646 \u0641\u0648\u0627\u062a\u064a\u0631\u0647\u0645. \u0644\u0646\u063a\u064a\u0651\u0631 \u0630\u0644\u0643.",
    arz: "\u0645\u0639\u0638\u0645 \u0627\u0644\u0646\u0627\u0633 \u0645\u0634 \u0628\u064a\u062a\u0627\u0628\u0639\u0648\u0627 \u0641\u0648\u0627\u062a\u064a\u0631\u0647\u0645. \u062e\u0644\u064a\u0646\u0627 \u0646\u063a\u064a\u0651\u0631 \u062f\u0647.",
    apc: "\u0645\u0639\u0638\u0645 \u0627\u0644\u0646\u0627\u0633 \u0645\u0627 \u0628\u064a\u062a\u0627\u0628\u0639\u0648\u0627 \u0641\u0648\u0627\u062a\u064a\u0631\u0647\u0645. \u062e\u0644\u064a\u0646\u0627 \u0646\u063a\u064a\u0651\u0631 \u0647\u064a\u0643.",
    afb: "\u0623\u063a\u0644\u0628 \u0627\u0644\u0646\u0627\u0633 \u0645\u0627 \u064a\u062a\u0627\u0628\u0639\u0648\u0646 \u0641\u0648\u0627\u062a\u064a\u0631\u0647\u0645. \u0646\u063a\u064a\u0651\u0631 \u0647\u0630\u0627.",
    hi: "\u091c\u093c\u094d\u092f\u093e\u0926\u093e\u0924\u0930 \u0932\u094b\u0917 \u0905\u092a\u0928\u0947 \u092c\u093f\u0932\u094b\u0902 \u0915\u093e \u091f\u094d\u0930\u0948\u0915 \u0928\u0939\u0940\u0902 \u0930\u0916\u0924\u0947\u0964 \u0906\u0907\u090f \u0907\u0938\u0947 \u092c\u0926\u0932\u0947\u0902\u0964",
    ta: "\u0baa\u0bc6\u0bb0\u0bc1\u0bae\u0bcd\u0baa\u0bbe\u0bb2\u0bbe\u0ba9 \u0bae\u0b95\u0bcd\u0b95\u0bb3\u0bcd \u0ba4\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0b95\u0b9f\u0bcd\u0b9f\u0ba3\u0b99\u0bcd\u0b95\u0bb3\u0bc8 \u0b95\u0ba3\u0bcd\u0b95\u0bbe\u0ba3\u0bbf\u0baa\u0bcd\u0baa\u0ba4\u0bbf\u0bb2\u0bcd\u0bb2\u0bc8. \u0b87\u0ba4\u0bc8 \u0bae\u0bbe\u0bb1\u0bcd\u0bb1\u0bc1\u0bb5\u0bcb\u0bae\u0bcd.",
    ja: "\u307b\u3068\u3093\u3069\u306e\u4eba\u304c\u8acb\u6c42\u66f8\u3092\u8ffd\u8de1\u3057\u3066\u3044\u307e\u305b\u3093\u3002\u305d\u308c\u3092\u5909\u3048\u307e\u3057\u3087\u3046\u3002",
    ko: "\ub300\ubd80\ubd84\uc758 \uc0ac\ub78c\ub4e4\uc740 \uccad\uad6c\uc11c\ub97c \ucd94\uc801\ud558\uc9c0 \uc54a\uc544\uc694. \uadf8\uac78 \ubc14\uaffc\ubd10\uc694.",
    zh: "\u5927\u591a\u6570\u4eba\u4e0d\u8ffd\u8e2a\u81ea\u5df1\u7684\u8d26\u5355\u3002\u8ba9\u6211\u4eec\u6765\u6539\u53d8\u8fd9\u4e00\u70b9\u3002",
    yue: "\u5927\u90e8\u5206\u4eba\u5594\u4f1a\u8ffd\u8e2a\u81ea\u5df1\u5605\u8cec\u55ae\u3002\u6211\u54cb\u4e00\u9f4a\u6539\u8b8a\u5462\u500b\u60c5\u6cc1\u3002",
    id: "Kebanyakan orang tidak memantau tagihan mereka. Yuk kita ubah itu.",
    ms: "Kebanyakan orang tidak memantau bil mereka. Jom kita ubah itu.",
    vi: "H\u1ea7u h\u1ebft m\u1ecdi ng\u01b0\u1eddi kh\u00f4ng theo d\u00f5i h\u00f3a \u0111\u01a1n c\u1ee7a h\u1ecd. H\u00e3y thay \u0111\u1ed5i \u0111i\u1ec1u \u0111\u00f3.",
    th: "\u0e04\u0e19\u0e2a\u0e48\u0e27\u0e19\u0e43\u0e2b\u0e0d\u0e48\u0e44\u0e21\u0e48\u0e15\u0e34\u0e14\u0e15\u0e32\u0e21\u0e1a\u0e34\u0e25\u0e02\u0e2d\u0e07\u0e15\u0e19\u0e40\u0e2d\u0e07 \u0e43\u0e2b\u0e49\u0e40\u0e23\u0e32\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19\u0e2a\u0e34\u0e48\u0e07\u0e19\u0e31\u0e49\u0e19",
  },
  stakes: {
    es: "Cambiemos esto \u2014 ahora mismo.", pt: "Vamos mudar isso \u2014 agora mesmo.", "pt-PT": "Vamos mudar isto \u2014 agora mesmo.",
    fr: "Changeons \u00e7a \u2014 maintenant.", de: "\u00c4ndern wir das \u2014 jetzt sofort.", it: "Cambiamo questo \u2014 adesso.",
    nl: "Laten we dit veranderen \u2014 nu meteen.", pl: "Zmie\u0144my to \u2014 teraz.", sv: "L\u00e5t oss \u00e4ndra p\u00e5 det h\u00e4r \u2014 nu.",
    da: "Lad os \u00e6ndre det \u2014 nu.", no: "La oss forandre dette \u2014 n\u00e5.", fi: "Muutetaan t\u00e4m\u00e4 \u2014 heti nyt.",
    cs: "Poj\u010fme to zm\u011bnit \u2014 hned te\u010f.", sk: "Po\u010fme to zmeni\u0165 \u2014 hne\u010f teraz.", ro: "Hai s\u0103 schimb\u0103m asta \u2014 chiar acum.",
    bg: "\u041d\u0435\u043a\u0430 \u0434\u0430 \u0433\u043e \u043f\u0440\u043e\u043c\u0435\u043d\u0438\u043c \u2014 \u0441\u0435\u0433\u0430.", hr: "Promijenimo to \u2014 odmah.", el: "\u0391\u03c2 \u03b1\u03bb\u03bb\u03ac\u03be\u03bf\u03c5\u03bc\u03b5 \u03b1\u03c5\u03c4\u03cc \u2014 \u03c4\u03ce\u03c1\u03b1.",
    hu: "V\u00e1ltoztassunk ezen \u2014 most.", uk: "\u0414\u0430\u0432\u0430\u0439\u0442\u0435 \u0437\u043c\u0456\u043d\u0438\u043c\u043e \u0446\u0435 \u2014 \u043f\u0440\u044f\u043c\u043e \u0437\u0430\u0440\u0430\u0437.", ru: "\u0414\u0430\u0432\u0430\u0439\u0442\u0435 \u0438\u0437\u043c\u0435\u043d\u0438\u043c \u044d\u0442\u043e \u2014 \u043f\u0440\u044f\u043c\u043e \u0441\u0435\u0439\u0447\u0430\u0441.",
    tr: "Bunu de\u011fi\u015ftirelim \u2014 \u015fimdi.", ar: "\u0644\u0646\u063a\u064a\u0651\u0631 \u0647\u0630\u0627 \u2014 \u0627\u0644\u0622\u0646.", arz: "\u062e\u0644\u064a\u0646\u0627 \u0646\u063a\u064a\u0651\u0631 \u062f\u0647 \u2014 \u062f\u0644\u0648\u0642\u062a\u064a.",
    apc: "\u062e\u0644\u064a\u0646\u0627 \u0646\u063a\u064a\u0651\u0631 \u0647\u064a\u0643 \u2014 \u0647\u0644\u0642.", afb: "\u0646\u063a\u064a\u0651\u0631 \u0647\u0630\u0627 \u2014 \u0627\u0644\u062d\u064a\u0646.",
    hi: "\u0906\u0907\u090f \u0907\u0938\u0947 \u092c\u0926\u0932\u0947\u0902 \u2014 \u0905\u092d\u0940\u0964", ta: "\u0b87\u0ba4\u0bc8 \u0bae\u0bbe\u0bb1\u0bcd\u0bb1\u0bc1\u0bb5\u0bcb\u0bae\u0bcd \u2014 \u0b87\u0baa\u0bcd\u0baa\u0bcb\u0ba4\u0bc7.",
    ja: "\u3053\u308c\u3092\u5909\u3048\u307e\u3057\u3087\u3046 \u2014 \u4eca\u3059\u3050\u3002", ko: "\uc9c0\uae08 \ub2f9\uc7a5 \ubc14\uaffc\ubd10\uc694.",
    zh: "\u8ba9\u6211\u4eec\u6539\u53d8\u8fd9\u4e00\u5207 \u2014 \u5c31\u662f\u73b0\u5728\u3002", yue: "\u6211\u54cb\u800c\u5bb6\u5c31\u6539\u8b8a\u4f6e \u2014 \u4fc2\u6642\u5019\u5587\u3002",
    id: "Yuk kita ubah ini \u2014 sekarang juga.", ms: "Jom kita ubah ini \u2014 sekarang.",
    vi: "H\u00e3y thay \u0111\u1ed5i \u0111i\u1ec1u n\u00e0y \u2014 ngay b\u00e2y gi\u1edd.", th: "\u0e43\u0e2b\u0e49\u0e40\u0e23\u0e32\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19\u0e2a\u0e34\u0e48\u0e07\u0e19\u0e35\u0e49 \u2014 \u0e15\u0e2d\u0e19\u0e19\u0e35\u0e49\u0e40\u0e25\u0e22",
  },
  intro: {
    es: "Esto suele llevar entre 5 y 7 minutos. Te guiar\u00e9 en cada paso.", pt: "Isso normalmente leva de 5 a 7 minutos. Vou te guiar em tudo.", "pt-PT": "Isto normalmente demora entre 5 e 7 minutos. Vou guiar-te em tudo.",
    fr: "\u00c7a prend g\u00e9n\u00e9ralement entre 5 et 7 minutes. Je vous guide \u00e0 chaque \u00e9tape.", de: "Das dauert normalerweise 5 bis 7 Minuten. Ich f\u00fchre Sie durch alles.", it: "Di solito ci vogliono dai 5 ai 7 minuti. Ti guido in ogni passaggio.",
    nl: "Dit duurt meestal 5 tot 7 minuten. Ik begeleid u bij elke stap.", pl: "Zazwyczaj zajmuje to 5 do 7 minut. Przeprowadz\u0119 ci\u0119 przez wszystko.", sv: "Det brukar ta 5 till 7 minuter. Jag guidar dig genom allt.",
    da: "Det tager normalt 5 til 7 minutter. Jeg guider dig igennem det hele.", no: "Dette tar vanligvis 5 til 7 minutter. Jeg guider deg gjennom alt.", fi: "T\u00e4m\u00e4 kest\u00e4\u00e4 yleens\u00e4 5\u20137 minuuttia. Opastan sinua l\u00e4pi kaiken.",
    cs: "To obvykle trv\u00e1 5 a\u017e 7 minut. Provedu v\u00e1s v\u0161\u00edm.", sk: "Zvy\u010dajne to trv\u00e1 5 a\u017e 7 min\u00fat. Prevediem v\u00e1s v\u0161etk\u00fdm.", ro: "De obicei dureaz\u0103 5 p\u00e2n\u0103 la 7 minute. Te ghidez prin tot.",
    bg: "\u041e\u0431\u0438\u043a\u043d\u043e\u0432\u0435\u043d\u043e \u043e\u0442\u043d\u0435\u043c\u0430 5 \u0434\u043e 7 \u043c\u0438\u043d\u0443\u0442\u0438. \u0429\u0435 \u0442\u0435 \u043f\u0440\u0435\u0432\u0435\u0434\u0430 \u043f\u0440\u0435\u0437 \u0432\u0441\u0438\u0447\u043a\u043e.", hr: "Obi\u010dno traje 5 do 7 minuta. Provest \u0107u te kroz sve.", el: "\u03a3\u03c5\u03bd\u03ae\u03b8\u03c9\u03c2 \u03b4\u03b9\u03b1\u03c1\u03ba\u03b5\u03af 5 \u03ad\u03c9\u03c2 7 \u03bb\u03b5\u03c0\u03c4\u03ac. \u0398\u03b1 \u03c3\u03b5 \u03ba\u03b1\u03b8\u03bf\u03b4\u03b7\u03b3\u03ae\u03c3\u03c9 \u03c3\u03b5 \u03cc\u03bb\u03b1.",
    hu: "Ez \u00e1ltal\u00e1ban 5-7 percet vesz ig\u00e9nybe. V\u00e9gigvezetlek mindenen.", uk: "\u0417\u0430\u0437\u0432\u0438\u0447\u0430\u0439 \u0446\u0435 \u0437\u0430\u0439\u043c\u0430\u0454 5\u20137 \u0445\u0432\u0438\u043b\u0438\u043d. \u042f \u043f\u0440\u043e\u0432\u0435\u0434\u0443 \u0432\u0430\u0441 \u0447\u0435\u0440\u0435\u0437 \u0443\u0441\u0435.", ru: "\u041e\u0431\u044b\u0447\u043d\u043e \u044d\u0442\u043e \u0437\u0430\u043d\u0438\u043c\u0430\u0435\u0442 5\u20137 \u043c\u0438\u043d\u0443\u0442. \u042f \u043f\u0440\u043e\u0432\u0435\u0434\u0443 \u0432\u0430\u0441 \u0447\u0435\u0440\u0435\u0437 \u0432\u0441\u0451.",
    tr: "Bu genellikle 5 ila 7 dakika s\u00fcter. Her ad\u0131mda size rehberlik edece\u011fim.", ar: "\u0639\u0627\u062f\u0629\u064b \u0645\u0627 \u064a\u0633\u062a\u063a\u0631\u0642 \u0647\u0630\u0627 \u0645\u0646 5 \u0625\u0644\u0649 7 \u062f\u0642\u0627\u0626\u0642. \u0633\u0623\u0631\u0634\u062f\u0643\u0650 \u062e\u0644\u0627\u0644 \u0643\u0644 \u062e\u0637\u0648\u0629.", arz: "\u0639\u0627\u062f\u0629\u064b \u0628\u064a\u0627\u062e\u062f \u0645\u0646 5 \u0644\u0640 7 \u062f\u0642\u0627\u064a\u0642. \u0647\u0631\u0634\u062f\u0643 \u0641\u064a \u0643\u0644 \u062e\u0637\u0648\u0629.",
    apc: "\u0639\u0627\u062f\u0629\u064b \u0628\u064a\u0627\u062e\u062f \u0645\u0646 5 \u0644\u0640 7 \u062f\u0642\u0627\u064a\u0642. \u0631\u062d \u0623\u0631\u0634\u062f\u0643 \u0628\u0643\u0644 \u062e\u0637\u0648\u0629.", afb: "\u0639\u0627\u062f\u0629\u064b \u064a\u0623\u062e\u0630 \u0645\u0646 5 \u0644\u0640 7 \u062f\u0642\u0627\u064a\u0642. \u0631\u0627\u062d \u0623\u0631\u0634\u062f\u0643 \u0628\u0643\u0644 \u062e\u0637\u0648\u0629.",
    hi: "\u0907\u0938\u092e\u0947\u0902 \u0906\u092e\u0924\u094c\u0930 \u092a\u0930 5 \u0938\u0947 7 \u092e\u093f\u0928\u091f \u0932\u0917\u0924\u0947 \u0939\u0948\u0902\u0964 \u092e\u0948\u0902 \u0906\u092a\u0915\u094b \u0939\u0930 \u0915\u0926\u092e \u092a\u0930 \u0917\u093e\u0907\u0921 \u0915\u0930\u0942\u0901\u0917\u0940\u0964", ta: "\u0b87\u0ba4\u0bc1 \u0baa\u0bca\u0ba4\u0bc1\u0bb5\u0bbe\u0b95 5 \u0bae\u0bc1\u0ba4\u0bb2\u0bcd 7 \u0ba8\u0bbf\u0bae\u0bbf\u0b9f\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0b86\u0b95\u0bc1\u0bae\u0bcd. \u0ba8\u0bbe\u0ba9\u0bcd \u0b89\u0b99\u0bcd\u0b95\u0bb3\u0bc8 \u0bb5\u0bb4\u0bbf\u0ba8\u0b9f\u0ba4\u0bcd\u0ba4\u0bc1\u0bb5\u0bc7\u0ba9\u0bcd.",
    ja: "\u901a\u5e385\u301c7\u5206\u304b\u304b\u308a\u307e\u3059\u3002\u3059\u3079\u3066\u3092\u4e00\u7dd2\u306b\u78ba\u8a8d\u3057\u3066\u3044\u304d\u307e\u3057\u3087\u3046\u3002", ko: "\ubcf4\ud1b5 5~7\ubd84 \uc815\ub3c4 \uac78\ub824\uc694. \ubaa8\ub4e0 \uacfc\uc815\uc744 \uc548\ub0b4\ud574 \ub4dc\ub9b4\uac8c\uc694.",
    zh: "\u901a\u5e38\u9700\u89815\u523010\u5206\u949f\u3002\u6211\u4f1a\u4e00\u6b65\u4e00\u6b65\u5e26\u4f60\u5b8c\u6210\u3002", yue: "\u901a\u5e38\u9700\u89815\u81f37\u5206\u9418\u3002\u6211\u6703\u4e00\u6b65\u4e00\u6b65\u5e36\u4f60\u5b8c\u6210\u3002",
    id: "Ini biasanya membutuhkan 5 hingga 7 menit. Aku akan memandu kamu di setiap langkah.", ms: "Ini biasanya mengambil masa 5 hingga 7 minit. Saya akan membimbing anda di setiap langkah.",
    vi: "\u0110i\u1ec1u n\u00e0y th\u01b0\u1eddng m\u1ea5t t\u1eeb 5 \u0111\u1ebfn 7 ph\u00fat. T\u00f4i s\u1ebd h\u01b0\u1edbng d\u1eabn b\u1ea1n t\u1eebng b\u01b0\u1edbc.", th: "\u0e1b\u0e01\u0e15\u0e34\u0e43\u0e0a\u0e49\u0e40\u0e27\u0e25\u0e32 5 \u0e16\u0e36\u0e07 7 \u0e19\u0e32\u0e17\u0e35 \u0e09\u0e31\u0e19\u0e08\u0e30\u0e41\u0e19\u0e30\u0e19\u0e33\u0e04\u0e38\u0e13\u0e17\u0e38\u0e01\u0e02\u0e31\u0e49\u0e19\u0e15\u0e2d\u0e19",
  },
  features0: {
    es: "Toca la pregunta de abajo — voy a sumar todas tus facturas de este mes.", pt: "Toque na pergunta abaixo — vou somar todas as suas contas deste mês.", "pt-PT": "Toca na pregunta abaixo — vou totalizar todas as tuas faturas deste mês.",
    fr: "Appuyez sur la question ci-dessous — je vais additionner toutes vos factures du mois.", de: "Tippe auf die Frage unten — ich addiere alle Ihre Rechnungen für diesen Monat.", it: "Tocca la domanda qui sotto — summerò tutte le tue bollette di questo mese.",
    nl: "Tik op de vraag hieronder — ik tel al uw rekeningen voor deze maand bij elkaar op.", pl: "Dotknąż pytania poniżej — zsumuję wszystkie twoje rachunki za ten miesiąc.", sv: "Tryck på frågan nedan — jag summerar alla dina räkningar för den här månaden.",
    da: "Tryk på spørgsmålet nedenfor — jeg lægger alle dine regninger for denne måned sammen.", no: "Trykk på spørsmålet nedenfor — jeg legger sammen alle regningene dine for denne måneden.", fi: "Napauta alla olevaa kysymystä — lasken yhteen kaikki tämän kuun laskusi.",
    cs: "Klepněte na otázku níže — sečtu všechny vaše účty za tento měsíc.", sk: "Klepnite na otázku nižšie — spočítam všetky vaše účty za tento mesiac.", ro: "Atingeți întrebarea de mai jos — voi totaliza toate facturile tale din această lună.",
    bg: "Докоснете въпроса по-долу — ще сумирам всичките ви сметки за този месец.", hr: "Dodirni pitanje ispod — zbrojit ću sve tvoje račune za ovaj mjesec.", el: "Πατήστε την ερώτηση παρακάτω — θα αθροίσω όλους τους λογαριασμούς σας αυτό τον μήνα.",
    hu: "Koppints az alábbi kérdésre — összesítem az összes számládat ebben a hónapban.", uk: "Торкніться питання нижче — я підсумую всі ваші рахунки за цей місяць.", ru: "Нажмите на вопрос ниже — я суммирую все ваши счета за этот месяц.",
    tr: "Aşağıdaki soruya dokunun — bu ayki tüm faturalarınızı toplayağım.", ar: "اضغطي على السؤال أدناه — سأجمع كل فواتيرك هذا الشهر.", arz: "اضغطي على السؤال تحت — هجمع كل فواتيرك الشهر ده.",
    apc: "اضغطي على السؤال تحت — رح أجمع كل فواتيرك هاد الشهر.", afb: "اضغطي على السؤال أدناه — بجمع لك كل فواتيرك هالشهر.",
    hi: "नीचे दिए प्रश्न पर टैप करें — मैं इस महीने के सभी बिल जोड़ दूंगी।", ta: "கீழே உள்ள கேள்வியை தட்டுங்கள் — இந்த மாதம் உங்கள் அனைத்து கட்டணங்களையும் தொகுக்கிறேன்.",
    ja: "下の質問をタップしてください — 今月の請求書をすべて合計します。", ko: "아래 질문을 탭하세요 — 이번 달 청구서를 모두 합산해 드릴게요.",
    zh: "点击下面的问题 — 我将合计您这个月的所有账单。", yue: "點擊下面唖條問題 — 我會幫你加埋呢個月所有嘗賬單。",
    id: "Ketuk pertanyaan di bawah — aku akan menjumlahkan semua tagihanmu bulan ini.", ms: "Ketuk soalan di bawah — saya akan menjumlahkan semua bil anda bulan ini.",
    vi: "Nhấn vào câu hỏi bên dưới — tôi sẽ tổng hợp tất cả hóa đơn của bạn tháng này.", th: "แตะคำถามด้านล่าง — ฉันจะรวมบิลทั้งหมดของคุณเดือนนี้",
  },
  features1: {
    es: "Toca la pregunta de abajo — voy a sumar agua, luz, internet y alquiler de este mes.", pt: "Toque na pergunta abaixo — vou somar água, luz, internet e aluguel deste mês.", "pt-PT": "Toca na pergunta abaixo — vou totalizar água, luz, internet e renda deste mês.",
    fr: "Appuyez sur la question ci-dessous — je vais additionner eau, électricité, internet et loyer du mois.", de: "Tippe auf die Frage unten — ich addiere Wasser, Strom, Internet und Miete für diesen Monat.", it: "Tocca la domanda qui sotto — summerò acqua, luce, internet e affitto di questo mese.",
    nl: "Tik op de vraag hieronder — ik tel water, stroom, internet en huur voor deze maand op.", pl: "Dotknąż pytania poniżej — zsumuję wodę, prąd, internet i czynsz za ten miesiąc.", sv: "Tryck på frågan nedan — jag summerar vatten, el, internet och hyra för den här månaden.",
    da: "Tryk på spørgsmålet nedenfor — jeg lægger vand, el, internet og husleje for denne måned sammen.", no: "Trykk på spørsmålet nedenfor — jeg legger sammen vann, strøm, internett og husleie for denne måneden.", fi: "Napauta alla olevaa kysymystä — lasken vesi, sähkö, internet ja vuokra yhteen tältä kuulta.",
    cs: "Klepněte na otázku níže — sečtu vodu, elektřinu, internet a nájem za tento měsíc.", sk: "Klepnite na otázku nižšie — spočítam vodu, elektrinu, internet a nájom za tento mesiac.", ro: "Atingeți întrebarea de mai jos — voi totaliza apă, curent, internet şi chirie din această lună.",
    bg: "Докоснете въпроса по-долу — ще сумирам вода, ток, интернет и наем за този месец.", hr: "Dodirni pitanje ispod — zbrojit ću vodu, struju, internet i najam za ovaj mjesec.", el: "Πατήστε την ερώτηση παρακάτω — θα αθροίσω νερό, ρεύμα, ίντερνετ και ενοίκιο αυτό τον μήνα.",
    hu: "Koppints az alábbi kérdésre — összesítem a vizet, áramot, internetet és bérleti díjat ebben a hónapban.", uk: "Торкніться питання нижче — я підсумую воду, електрику, інтернет та оренду за цей місяць.", ru: "Нажмите на вопрос ниже — я суммирую воду, электричество, интернет и аренду за этот месяц.",
    tr: "Aşağıdaki soruya dokunun — su, elektrik, internet ve kirayı bu ay için toplayağım.", ar: "اضغطي على السؤال أدناه — سأجمع الماء والكهرباء والإنترنت والإيجار هذا الشهر.", arz: "اضغطي على السؤال تحت — هجمع مياه وكهرباء وإنترنت وإيجار الشهر ده.",
    apc: "اضغطي على السؤال تحت — رح أجمع مي وكهرباء وإنترنت وإيجار هاد الشهر.", afb: "اضغطي على السؤال أدناه — بجمع مي وكهرباء وإنترنت وإيجار هالشهر.",
    hi: "नीचे दिए प्रश्न पर टैप करें — मैं इस महीने पानी, बिजली, इंटरनेट और किराया जोड़ दूंगी।", ta: "கீழே உள்ள கேள்வியை தட்டுங்கள் — இந்த மாதம் தண்ணீர், மின்சாரம், இணையம் மற்றும் வாடகை தொகுக்கிறேன்.",
    ja: "下の質問をタップしてください — 今月の水道、電気、インターネット、家賌を合計します。", ko: "아래 질문을 탭하세요 — 이번 달 수도, 전기, 인터넷, 임대료를 합산해 드릴게요.",
    zh: "点击下面的问题 — 我将合计您这个月的水费、电费、网费和房租。", yue: "點擊下面唖條問題 — 我會幫你加埋呢個月嘗水費、電費、網費同租金。",
    id: "Ketuk pertanyaan di bawah — aku akan menjumlahkan air, listrik, internet dan sewa bulan ini.", ms: "Ketuk soalan di bawah — saya akan menjumlahkan air, elektrik, internet dan sewa bulan ini.",
    vi: "Nhấn vào câu hỏi bên dưới — tôi sẽ tổng hợp tiền nước, điện, internet và thuê nhà tháng này.", th: "แตะคำถามด้านล่าง — ฉันจะรวมค่าน้ำ ค่าไฟ อินเตอร์เน็ต และค่าเช่าเดือนนี้",
  },
  features2: {
    es: "Toca la pregunta de abajo — voy a estimar el total de tus facturas del próximo mes.", pt: "Toque na pergunta abaixo — vou estimar o total das suas contas do próximo mês.", "pt-PT": "Toca na pergunta abaixo — vou estimar o total das tuas faturas do próximo mês.",
    fr: "Appuyez sur la question ci-dessous — je vais estimer votre total de factures du mois prochain.", de: "Tippe auf die Frage unten — ich schätze Ihre gesamten Rechnungen für den nächsten Monat.", it: "Tocca la domanda qui sotto — stimerò il totale delle tue bollette del prossimo mese.",
    nl: "Tik op de vraag hieronder — ik schat uw totale rekeningen voor de volgende maand.", pl: "Dotknąż pytania poniżej — oszacuję łączne rachunki na przyszły miesiąc.", sv: "Tryck på frågan nedan — jag beräknar ditt totala räkningsbelopp för nästa månad.",
    da: "Tryk på spørgsmålet nedenfor — jeg beregner dit samlede regningsbeløb for næste måned.", no: "Trykk på spørsmålet nedenfor — jeg beregner ditt totale regningsbeløp for neste måned.", fi: "Napauta alla olevaa kysymystä — arvioin ensi kuun kokonaislaskusi.",
    cs: "Klepněte na otázku níže — odhadnu celkové účty pro příští měsíc.", sk: "Klepnite na otázku nižšie — odhadnem celkové účty na budúci mesiac.", ro: "Atingeți întrebarea de mai jos — voi estima totalul facturilor tale pentru luna viitoare.",
    bg: "Докоснете въпроса по-долу — ще оценя общите ви сметки за следващия месец.", hr: "Dodirni pitanje ispod — procijenit ću ukupne tvoje račune za sljedeći mjesec.", el: "Πατήστε την ερώτηση παρακάτω — θα εκτιμήσω τους συνολικούς λογαριασμούς σας για τον επόμενο μήνα.",
    hu: "Koppints az alábbi kérdésre — megbecsülöm a jövő havi összes számládat.", uk: "Торкніться питання нижче — я оціню загальні ваші рахунки на наступний місяць.", ru: "Нажмите на вопрос ниже — я оценю общую сумму ваших счетов на следующий месяц.",
    tr: "Aşağıdaki soruya dokunun — gelecek ay toplam faturalarınızı tahmin edeceğim.", ar: "اضغطي على السؤال أدناه — سأقدّر إجمالي فواتيرك للشهر القادم.", arz: "اضغطي على السؤال تحت — هقدّر مجموع فواتيرك الشهر الجاي.",
    apc: "اضغطي على السؤال تحت — رح أقدّر مجموع فواتيرك الشهر الجاي.", afb: "اضغطي على السؤال أدناه — بقدّر مجموع فواتيرك الشهر الياي.",
    hi: "नीचे दिए प्रश्न पर टैप करें — मैं अगले महीने के लिए आपके कुल बिल का अनुमान लगाऊँगी।", ta: "கீழே உள்ள கேள்வியை தட்டுங்கள் — அடுத்த மாதம் உங்கள் மொத்த கட்டணங்களை மதிப்பிடுகிறேன்.",
    ja: "下の質問をタップしてください — 来月の請求書の合計を見積もります。", ko: "아래 질문을 탭하세요 — 다음 달 요쫑서를 예측해 드릴게요.",
    zh: "点击下面的问题 — 我将估算您下个月的总账单。", yue: "點擊下面唖條問題 — 我會估算你下個月嘗總賬單。",
    id: "Ketuk pertanyaan di bawah — aku akan memperkirakan total tagihanmu bulan depan.", ms: "Ketuk soalan di bawah — saya akan menganggar jumlah bil anda bulan depan.",
    vi: "Nhấn vào câu hỏi bên dưới — tôi sẽ ước tính tổng hóa đơn của bạn tháng tới.", th: "แตะคำถามด้านล่าง — ฉันจะประมาณยอดรวมบิลของคุณสำหรับเดือนหน้า",
  },
  paywall: {
    es: "Tienes ocho preguntas gratuitas para empezar. Cuando quieras m\u00e1s, elige un plan.", pt: "Voc\u00ea tem oito perguntas gratuitas para come\u00e7ar. Quando quiser mais, escolha um plano.", "pt-PT": "Tens oito perguntas gratuitas para come\u00e7ar. Quando quiseres mais, escolhe um plano.",
    fr: "Vous avez huit questions gratuites pour commencer. Quand vous en voulez plus, choisissez un plan.", de: "Sie haben acht kostenlose Fragen zum Start. Wenn Sie mehr m\u00f6chten, w\u00e4hlen Sie einen Plan.", it: "Hai otto domande gratuite per iniziare. Quando vuoi di pi\u00f9, scegli un piano.",
    nl: "U heeft acht gratis vragen om mee te beginnen. Als u meer wilt, kies dan een abonnement.", pl: "Masz osiem darmowych pyta\u0144 na start. Kiedy b\u0119dziesz chcia\u0142a wi\u0119cej, wybierz plan.", sv: "Du har \u00e5tta gratisf\u00e5gor att b\u00f6rja med. N\u00e4r du vill ha mer, v\u00e4lj en plan.",
    da: "Du har otte gratis sp\u00f8rgsm\u00e5l at starte med. N\u00e5r du vil have mere, v\u00e6lg en plan.", no: "Du har \u00e5tte gratis sp\u00f8rsm\u00e5l \u00e5 starte med. N\u00e5r du vil ha mer, velg en plan.", fi: "Sinulla on kahdeksan ilmaista kysymyst\u00e4 aloittaaksesi. Kun haluat lis\u00e4\u00e4, valitse suunnitelma.",
    cs: "M\u00e1te osm bezplatn\u00fdch ot\u00e1zek pro za\u010d\u00e1tek. A\u017e budete cht\u00edt v\u00edce, vyberte si pl\u00e1n.", sk: "M\u00e1te osem bezplatn\u00fdch ot\u00e1zok na za\u010diatok. Ke\u010f budete chcie\u0165 viac, vyberte si pl\u00e1n.", ro: "Ai opt \u00eentreb\u0103ri gratuite pentru \u00eenceput. C\u00e2nd vrei mai mult, alege un plan.",
    bg: "\u0418\u043c\u0430\u0448 \u043e\u0441\u0435\u043c \u0431\u0435\u0437\u043f\u043b\u0430\u0442\u043d\u0438 \u0432\u044a\u043f\u0440\u043e\u0441\u0430 \u0437\u0430 \u043d\u0430\u0447\u0430\u043b\u043e. \u041a\u043e\u0433\u0430\u0442\u043e \u0438\u0441\u043a\u0430\u0448 \u043f\u043e\u0432\u0435\u0447\u0435, \u0438\u0437\u0431\u0435\u0440\u0438 \u043f\u043b\u0430\u043d.", hr: "Ima\u0161 osam besplatnih pitanja za po\u010detak. Kad bude\u0161 htjela vi\u0161e, odaberi plan.", el: "\u0388\u03c7\u03b5\u03b9\u03c2 \u03bf\u03ba\u03c4\u03ce \u03b4\u03c9\u03c1\u03b5\u03ac\u03bd \u03b5\u03c1\u03c9\u03c4\u03ae\u03c3\u03b5\u03b9\u03c2 \u03b3\u03b9\u03b1 \u03b1\u03c1\u03c7\u03ae. \u038c\u03c4\u03b1\u03bd \u03b8\u03ad\u03bb\u03b5\u03b9\u03c2 \u03c0\u03b5\u03c1\u03b9\u03c3\u03c3\u03cc\u03c4\u03b5\u03c1\u03b5\u03c2, \u03b5\u03c0\u03ad\u03bb\u03b5\u03be\u03b5 \u03ad\u03bd\u03b1 \u03c0\u03c1\u03cc\u03b3\u03c1\u03b1\u03bc\u03bc\u03b1.",
    hu: "Nyolc ingyenes k\u00e9rd\u00e9sed van a kezd\u00e9shez. Ha t\u00f6bbet szeretn\u00e9l, v\u00e1lassz egy csomagot.", uk: "\u0423 \u0432\u0430\u0441 \u0454 \u0432\u0456\u0441\u0456\u043c \u0431\u0435\u0437\u043a\u043e\u0448\u0442\u043e\u0432\u043d\u0438\u0445 \u0437\u0430\u043f\u0438\u0442\u0430\u043d\u044c \u0434\u043b\u044f \u043f\u043e\u0447\u0430\u0442\u043a\u0443. \u041a\u043e\u043b\u0438 \u0437\u0430\u0445\u043e\u0447\u0435\u0442\u0435 \u0431\u0456\u043b\u044c\u0448\u0435, \u043e\u0431\u0435\u0440\u0456\u0442\u044c \u043f\u043b\u0430\u043d.", ru: "\u0423 \u0432\u0430\u0441 \u0435\u0441\u0442\u044c \u0432\u043e\u0441\u0435\u043c\u044c \u0431\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u044b\u0445 \u0432\u043e\u043f\u0440\u043e\u0441\u043e\u0432 \u0434\u043b\u044f \u043d\u0430\u0447\u0430\u043b\u0430. \u041a\u043e\u0433\u0434\u0430 \u0437\u0430\u0445\u043e\u0442\u0438\u0442\u0435 \u0431\u043e\u043b\u044c\u0448\u0435, \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0430\u0440\u0438\u0444.",
    tr: "Ba\u015flamak i\u00e7in sekiz \u00fccretsiz sorunuz var. Daha fazlas\u0131n\u0131 istedi\u011finizde bir plan se\u00e7in.", ar: "\u0644\u062f\u064a\u0643\u0650 \u062b\u0645\u0627\u0646\u064a\u0629 \u0623\u0633\u0626\u0644\u0629 \u0645\u062c\u0627\u0646\u064a\u0629 \u0644\u0644\u0628\u062f\u0621. \u0639\u0646\u062f\u0645\u0627 \u062a\u0631\u064a\u062f\u064a\u0646 \u0627\u0644\u0645\u0632\u064a\u062f, \u0627\u062e\u062a\u0627\u0631\u064a \u062e\u0637\u0629.", arz: "\u0639\u0646\u062f\u0643 \u062a\u0645\u0627\u0646\u064a\u0629 \u0623\u0633\u0626\u0644\u0629 \u0645\u062c\u0627\u0646\u064a\u0629 \u062a\u0628\u062f\u0626\u064a \u0628\u064a\u0647\u0627. \u0644\u0645\u0627 \u062a\u064a\u062c\u064a \u062a\u0639\u0645\u0644\u064a \u0625\u064a\u0647\u060c \u0627\u062e\u062a\u0627\u0631\u064a \u062e\u0637\u0629.",
    apc: "\u0639\u0646\u062f\u0643 \u062a\u0645\u0627\u0646\u064a\u0629 \u0623\u0633\u0626\u0644\u0629 \u0645\u062c\u0627\u0646\u064a\u0629 \u0644\u062a\u0628\u062f\u0626\u064a. \u0644\u0645\u0627 \u0628\u062f\u0643 \u0623\u0643\u062b\u0631, \u0627\u062e\u062a\u0627\u0631\u064a \u062e\u0637\u0629.", afb: "\u0639\u0646\u062f\u0643 \u062b\u0645\u0627\u0646\u064a\u0629 \u0623\u0633\u0626\u0644\u0629 \u0645\u062c\u0627\u0646\u064a\u0629 \u062a\u0628\u062f\u0626\u064a\u0646 \u0641\u064a\u0647\u0627. \u0644\u0645\u0627 \u062a\u0628\u064a\u0646 \u0623\u0643\u062b\u0631, \u0627\u062e\u062a\u0627\u0631\u064a \u062e\u0637\u0629.",
    hi: "\u0906\u092a\u0915\u0947 \u092a\u093e\u0938 \u0936\u0941\u0930\u0941\u0906\u0924 \u0915\u0947 \u0932\u093f\u090f \u0906\u0920 \u092e\u0941\u092b\u093c\u094d\u0924 \u0938\u0935\u093e\u0932 \u0939\u0948\u0902\u0964 \u091c\u092c \u0914\u0930 \u091a\u093e\u0939\u093f\u090f, \u0915\u094b\u0908 \u092a\u094d\u0932\u093e\u0928 \u091a\u0941\u0928\u0947\u0902\u0964", ta: "\u0ba4\u0bca\u0b9f\u0b99\u0bcd\u0b95\u0bc1\u0bb5\u0ba4\u0bb1\u0bcd\u0b95\u0bc1 \u0b89\u0b99\u0bcd\u0b95\u0bb3\u0bbf\u0b9f\u0bae\u0bcd \u0b8e\u0b9f\u0bcd\u0b9f\u0bc1 \u0b87\u0bb2\u0bb5\u0b9a \u0b95\u0bc7\u0bb3\u0bcd\u0bb5\u0bbf\u0b95\u0bb3\u0bcd \u0b89\u0bb3\u0bcd\u0bb3\u0ba9. \u0bae\u0bc7\u0bb2\u0bc1\u0bae\u0bcd \u0bb5\u0bc7\u0ba3\u0bcd\u0b9f\u0bc1\u0bae\u0bcd\u0baa\u0bcb\u0ba4\u0bc1 \u0ba4\u0bbf\u0b9f\u0bcd\u0b9f\u0bae\u0bcd \u0ba4\u0bc7\u0bb0\u0bcd\u0ba8\u0bcd\u0ba4\u0bc6\u0b9f\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd.",
    ja: "\u6700\u521d\u306b8\u3064\u306e\u7121\u6599\u8cea\u554f\u304c\u3042\u308a\u307e\u3059\u3002\u3082\u3063\u3068\u4f7f\u3044\u305f\u3044\u3068\u304d\u306f\u30d7\u30e9\u30f3\u3092\u9078\u3093\u3067\u304f\u3060\u3055\u3044\u3002", ko: "\uc2dc\uc791\ud560 \ub54c 8\uac1c\uc758 \ubb34\ub8cc \uc9c8\ubb38\uc774 \uc788\uc5b4\uc694. \ub354 \uc6d0\ud558\uc2dc\uba74 \ud50c\ub79c\uc744 \uc120\ud0dd\ud574 \uc8fc\uc138\uc694.",
    zh: "\u4f60\u6709\u516b\u4e2a\u514d\u8d39\u95ee\u9898\u53ef\u4ee5\u5f00\u59cb\u4f7f\u7528\u3002\u60f3\u8981\u66f4\u591a\u65f6\uff0c\u8bf7\u9009\u62e9\u4e00\u4e2a\u65b9\u6848\u3002", yue: "\u4f60\u6709\u516b\u500b\u514d\u8cbb\u554f\u984c\u53ef\u4ee5\u958b\u59cb\u4f7f\u7528\u3002\u60f3\u8981\u66f4\u591a\u5605\u6642\u5019\uff0c\u63c1\u4e00\u500b\u65b9\u6848\u3002",
    id: "Kamu punya delapan pertanyaan gratis untuk memulai. Ketika mau lebih, pilih paket.", ms: "Anda mempunyai lapan soalan percuma untuk bermula. Apabila mahu lebih, pilih pelan.",
    vi: "B\u1ea1n c\u00f3 t\u00e1m c\u00e2u h\u1ecfi mi\u1ec5n ph\u00ed \u0111\u1ec3 b\u1eaft \u0111\u1ea7u. Khi mu\u1ed1n th\u00eam, h\u00e3y ch\u1ecdn m\u1ed9t g\u00f3i.", th: "\u0e04\u0e38\u0e13\u0e21\u0e35\u0e04\u0e33\u0e16\u0e32\u0e21\u0e1f\u0e23\u0e35\u0e41\u0e1b\u0e14\u0e02\u0e49\u0e2d\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e40\u0e23\u0e34\u0e48\u0e21\u0e15\u0e49\u0e19 \u0e40\u0e21\u0e37\u0e48\u0e2d\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e40\u0e15\u0e34\u0e21 \u0e40\u0e25\u0e37\u0e2d\u0e01\u0e41\u0e1c\u0e19",
  },
  personalizing: {
    es: "Configurando tus recordatorios. Ya casi est\u00e1.", pt: "Configurando seus lembretes. J\u00e1 quase pronto.", "pt-PT": "A configurar os teus lembretes. J\u00e1 est\u00e1 quase.",
    fr: "Configuration de vos rappels en cours. Presque pr\u00eat.", de: "Ich richte Ihre Erinnerungen ein. Gleich fertig.", it: "Sto configurando i tuoi promemoria. Quasi pronto.",
    nl: "Uw herinneringen worden ingesteld. Bijna klaar.", pl: "Konfiguruję twoje przypomnienia. Prawie gotowe.", sv: "Konfigurerar dina p\u00e5minnelser. Snart klar.",
    da: "Ops\u00e6tter dine p\u00e5minnelser. N\u00e6sten f\u00e6rdig.", no: "Setter opp p\u00e5minnelsene dine. Nesten ferdig.", fi: "Asetan muistutuksesi. Melkein valmis.",
    cs: "Nastavuji va\u0161e p\u0159ipom\u00ednky. T\u00e9m\u011b\u0159 hotovo.", sk: "Nastavujem va\u0161e pripomienky. Takmer hotovo.", ro: "Configurez mementourile tale. Aproape gata.",
    bg: "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u0432\u0430\u043c \u043d\u0430\u043f\u043e\u043c\u043d\u044f\u043d\u0438\u044f\u0442\u0430 \u0442\u0438. \u041f\u043e\u0447\u0442\u0438 \u0433\u043e\u0442\u043e\u0432\u043e.", hr: "Postavljam tvoje podsjetnicke. Skoro gotovo.", el: "\u03a1\u03c5\u03b8\u03bc\u03af\u03b6\u03c9 \u03c4\u03b9\u03c2 \u03c5\u03c0\u03b5\u03bd\u03b8\u03c5\u03bc\u03af\u03c3\u03b5\u03b9\u03c2 \u03c3\u03bf\u03c5. \u03a3\u03c7\u03b5\u03b4\u03cc\u03bd \u03ad\u03c4\u03bf\u03b9\u03bc\u03bf.",
    hu: "Be\u00e1ll\u00edtom az eml\u00e9keztet\u0151idet. Majdnem k\u00e9sz.", uk: "\u041d\u0430\u043b\u0430\u0448\u0442\u043e\u0432\u0443\u044e \u0432\u0430\u0448\u0456 \u043d\u0430\u0433\u0430\u0434\u0443\u0432\u0430\u043d\u043d\u044f. \u041c\u0430\u0439\u0436\u0435 \u0433\u043e\u0442\u043e\u0432\u043e.", ru: "\u041d\u0430\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u044e \u0432\u0430\u0448\u0438 \u043d\u0430\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u044f. \u041f\u043e\u0447\u0442\u0438 \u0433\u043e\u0442\u043e\u0432\u043e.",
    tr: "Hat\u0131rlatmalar\u0131n\u0131z ayarlan\u0131yor. Neredeyse haz\u0131r.", ar: "\u0623\u0642\u0648\u0645 \u0628\u0625\u0639\u062f\u0627\u062f \u062a\u0630\u0643\u064a\u0631\u0627\u062a\u0643. \u062a\u0642\u0631\u064a\u0628\u0627\u064b \u062c\u0627\u0647\u0632.", arz: "\u0628\u062c\u0647\u0651\u0632 \u062a\u0630\u0643\u064a\u0631\u0627\u062a\u0643. \u062a\u0642\u0631\u064a\u0628\u0627\u064b \u062e\u0644\u0635\u0646\u0627.",
    apc: "\u0639\u0645 \u0628\u062c\u0647\u0651\u0632 \u062a\u0630\u0643\u064a\u0631\u0627\u062a\u0643. \u062a\u0642\u0631\u064a\u0628\u0627\u064b \u062c\u0627\u0647\u0632.", afb: "\u0623\u062c\u0647\u0651\u0632 \u062a\u0630\u0643\u064a\u0631\u0627\u062a\u0643. \u062a\u0642\u0631\u064a\u0628\u0627\u064b \u062c\u0627\u0647\u0632.",
    hi: "\u0906\u092a\u0915\u0947 \u0930\u093f\u092e\u093e\u0907\u0902\u0921\u0930 \u0938\u0947\u091f \u0939\u094b \u0930\u0939\u0947 \u0939\u0948\u0902\u0964 \u0932\u0917\u092d\u0917 \u0924\u0948\u092f\u093e\u0930\u0964", ta: "\u0b89\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0ba8\u0bbf\u0ba9\u0bc8\u0bb5\u0bc2\u0b9f\u0bcd\u0b9f\u0bb2\u0bcd\u0b95\u0bb3\u0bc8 \u0b85\u0bae\u0bc8\u0b95\u0bcd\u0b95\u0bbf\u0bb1\u0bc7\u0ba9\u0bcd. \u0b95\u0bbf\u0b9f\u0bcd\u0b9f\u0ba4\u0bcd\u0ba4\u0b9f\u0bcd \u0ba4\u0baf\u0bbe\u0bb0\u0bcd.",
    ja: "\u30ea\u30de\u30a4\u30f3\u30c0\u30fc\u3092\u8a2d\u5b9a\u3057\u3066\u3044\u307e\u3059\u3002\u3082\u3046\u3059\u3050\u5b8c\u4e86\u3067\u3059\u3002", ko: "\uc54c\ub9bc\uc744 \uc124\uc815\ud558\uace0 \uc788\uc5b4\uc694. \uac70\uc758 \ub2e4 \ub410\uc5b4\uc694.",
    zh: "\u6b63\u5728\u8bbe\u7f6e\u4f60\u7684\u63d0\u9192\u3002\u5feb\u597d\u4e86\u3002", yue: "\u6b63\u5728\u8a2d\u5b9a\u4f60\u5605\u63d0\u9192\u3002\u5feb\u597d\u5561\u3002",
    id: "Mengatur pengingatmu. Hampir selesai.", ms: "Menetapkan peringatan anda. Hampir selesai.",
    vi: "\u0110ang thi\u1ebft l\u1eadp l\u1eddi nh\u1eafc c\u1ee7a b\u1ea1n. S\u1eafp xong r\u1ed3i.", th: "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e15\u0e31\u0e49\u0e07\u0e04\u0e48\u0e32\u0e01\u0e32\u0e23\u0e41\u0e08\u0e49\u0e07\u0e40\u0e15\u0e37\u0e2d\u0e19\u0e02\u0e2d\u0e07\u0e04\u0e38\u0e13 \u0e40\u0e01\u0e37\u0e2d\u0e1a\u0e40\u0e2a\u0e23\u0e47\u0e08\u0e41\u0e25\u0e49\u0e27",
  },
};

const OTHER_LANGS = Object.keys(TRANS.welcome);

/* ── Main ────────────────────────────────────────────────────────────────── */

async function main() {
  const total = CONCEPTS.length * PERSONAS.length * (2 + OTHER_LANGS.length);
  console.log(`\nJudith onboarding voice pre-generator`);
  console.log(`Target: ${CONCEPTS.length} concepts × ${PERSONAS.length} personas × ${2 + OTHER_LANGS.length} lang groups = ${total} files\n`);

  let done = 0;
  let skipped = 0;
  let failed = 0;

  const FORCE_CONCEPTS = new Set<Concept>(["features0", "features1", "features2"]);

  for (const concept of CONCEPTS) {
    for (const persona of PERSONAS) {
      const speed = getSpeakingSpeed(persona);

      // ── English group ──────────────────────────────────────────────────
      {
        const lang = "en";
        const text = EN_TEXT[concept][persona];
        const voiceId = DEFAULT_VOICE_IDS[persona];
        if (!FORCE_CONCEPTS.has(concept) && await hasOnbAudio(concept, persona, lang)) {
          skipped++;
          process.stdout.write(`  skip  ${concept}/${persona}/${lang}\r`);
        } else {
          try {
            const audio = await synthesize(text, voiceId, { live: false, speed });
            await setOnbAudio(concept, persona, lang, audio.base64);
            done++;
            console.log(`  [${done + skipped + failed}/${total}] ✓ ${concept}/${persona}/${lang}`);
          } catch (err) {
            failed++;
            console.error(`  [${done + skipped + failed}/${total}] ✗ ${concept}/${persona}/${lang}:`, (err as Error).message);
          }
        }
      }

      // ── Filipino group ─────────────────────────────────────────────────
      {
        const lang = "fil";
        const text = FIL_TEXT[concept][persona];
        const voiceId = FILIPINO_VOICE_IDS[persona];
        if (!FORCE_CONCEPTS.has(concept) && await hasOnbAudio(concept, persona, lang)) {
          skipped++;
          process.stdout.write(`  skip  ${concept}/${persona}/${lang}\r`);
        } else {
          try {
            const audio = await synthesize(text, voiceId, { live: false, speed });
            await setOnbAudio(concept, persona, lang, audio.base64);
            done++;
            console.log(`  [${done + skipped + failed}/${total}] ✓ ${concept}/${persona}/${lang}`);
          } catch (err) {
            failed++;
            console.error(`  [${done + skipped + failed}/${total}] ✗ ${concept}/${persona}/${lang}:`, (err as Error).message);
          }
        }
      }

      // ── Other languages ────────────────────────────────────────────────
      for (const lang of OTHER_LANGS) {
        const text = TRANS[concept]?.[lang];
        if (!text) { skipped++; continue; }
        const voiceId = DEFAULT_VOICE_IDS[persona];
        if (!FORCE_CONCEPTS.has(concept) && await hasOnbAudio(concept, persona, lang)) {
          skipped++;
          process.stdout.write(`  skip  ${concept}/${persona}/${lang}\r`);
          continue;
        }
        try {
          const audio = await synthesize(text, voiceId, { live: false, speed });
          await setOnbAudio(concept, persona, lang, audio.base64);
          done++;
          console.log(`  [${done + skipped + failed}/${total}] ✓ ${concept}/${persona}/${lang}`);
        } catch (err) {
          failed++;
          console.error(`  [${done + skipped + failed}/${total}] ✗ ${concept}/${persona}/${lang}:`, (err as Error).message);
        }
      }
    }
  }

  console.log(`\nDone. Generated: ${done}  Skipped: ${skipped}  Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
