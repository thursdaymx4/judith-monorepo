/**
 * Languages & dialects Judith can speak and transcribe.
 *
 * Scope = languages where ElevenLabs has excellent, production-grade voices
 * (the `eleven_multilingual_v2` / `eleven_flash_v2_5` set) plus a few strong
 * `eleven_v3` additions. Dialects are listed as sub-options only where the
 * spoken text genuinely differs (not just accent) and ElevenLabs handles them
 * well — e.g. Cebuano / Ilocano under Filipino, Cantonese under Chinese,
 * Egyptian / Levantine / Gulf under Arabic.
 *
 * `sttCode` is the best-effort ISO hint passed to ElevenLabs Scribe to improve
 * transcription accuracy. It is always optional — the server falls back to
 * auto-detection if the code is unsupported.
 */

export type LangTier = "excellent" | "good";

export interface Dialect {
  /** App-level language code (stored in the JudithStore). */
  code: string;
  /** English name. */
  label: string;
  /** Endonym (name in its own language). */
  native: string;
  /** Judith's reminder line, spoken to preview the voice. */
  sample: string;
  /** Short tagline shown under the row. */
  desc: string;
  /** ISO-639 hint for Scribe STT (optional). */
  sttCode?: string;
}

export interface Language {
  code: string;
  label: string;
  native: string;
  flag: string;
  sample: string;
  desc: string;
  tier: LangTier;
  sttCode?: string;
  dialects?: Dialect[];
}

const SAMPLE_EN = "Hi, I’m Judith. I’ll remind you before every bill is due.";

export const LANGUAGES: Language[] = [
  {
    code: "fil",
    label: "Filipino",
    native: "Filipino / Taglish",
    flag: "🇵🇭",
    sample: "Tara! Ayusin natin ang mga bills mo.",
    desc: "Parang kaibigan",
    tier: "excellent",
    sttCode: "fil",
    dialects: [
      {
        code: "fil",
        label: "Tagalog / Taglish",
        native: "Tagalog",
        sample: "Tara! Ayusin natin ang mga bills mo.",
        desc: "Manila standard",
        sttCode: "fil",
      },
      {
        code: "ceb",
        label: "Cebuano (Bisaya)",
        native: "Bisaya / Sinugboanon",
        sample: "Uy, si Judith ni. Pahinumduman tika sa dili pa ma-due ang imong bayranan.",
        desc: "Cebu · Visayas · Mindanao",
        sttCode: "ceb",
      },
      {
        code: "ilo",
        label: "Ilocano",
        native: "Ilokano",
        sample: "Kablaaw, siak ni Judith. Ipalagipko kenka sakbay ti aldaw ti panagbayadmo.",
        desc: "Northern Luzon",
        sttCode: "ilo",
      },
      {
        code: "hil",
        label: "Hiligaynon (Ilonggo)",
        native: "Ilonggo",
        sample: "Kumusta, si Judith ko. Pahibaluon ko ikaw antes mag-due ang imo bayaron.",
        desc: "Iloilo · Western Visayas",
        sttCode: "hil",
      },
    ],
  },
  {
    code: "en",
    label: "English",
    native: "English",
    flag: "🇬🇧",
    sample: SAMPLE_EN,
    desc: "Clear & warm",
    tier: "excellent",
    sttCode: "en",
    dialects: [
      {
        code: "en",
        label: "British English",
        native: "English (UK)",
        sample: SAMPLE_EN,
        desc: "UK · clear & warm",
        sttCode: "en",
      },
      {
        code: "en-US",
        label: "American English",
        native: "English (US)",
        sample: "Hi, I'm Judith. I'll remind you before every bill is due.",
        desc: "US · friendly & direct",
        sttCode: "en",
      },
    ],
  },
  {
    code: "es",
    label: "Spanish",
    native: "Español",
    flag: "🇪🇸",
    sample: "Hola, soy Judith. Te aviso antes de que venza cada factura.",
    desc: "Cálida y clara",
    tier: "excellent",
    sttCode: "es",
  },
  {
    code: "pt",
    label: "Portuguese",
    native: "Português",
    flag: "🇧🇷",
    sample: "Oi, sou a Judith. Eu te aviso antes de cada conta vencer.",
    desc: "Calorosa e clara",
    tier: "excellent",
    sttCode: "pt",
    dialects: [
      {
        code: "pt",
        label: "Brazilian",
        native: "Português (Brasil)",
        sample: "Oi, sou a Judith. Eu te aviso antes de cada conta vencer.",
        desc: "Brasil",
        sttCode: "pt",
      },
      {
        code: "pt-PT",
        label: "European",
        native: "Português (Portugal)",
        sample: "Olá, sou a Judith. Aviso-te antes de cada conta vencer.",
        desc: "Portugal",
        sttCode: "pt",
      },
    ],
  },
  {
    code: "fr",
    label: "French",
    native: "Français",
    flag: "🇫🇷",
    sample: "Bonjour, je suis Judith. Je vous préviens avant chaque échéance.",
    desc: "Chaleureuse et claire",
    tier: "excellent",
    sttCode: "fr",
  },
  {
    code: "de",
    label: "German",
    native: "Deutsch",
    flag: "🇩🇪",
    sample: "Hallo, ich bin Judith. Ich erinnere dich, bevor jede Rechnung fällig ist.",
    desc: "Warm & klar",
    tier: "excellent",
    sttCode: "de",
  },
  {
    code: "it",
    label: "Italian",
    native: "Italiano",
    flag: "🇮🇹",
    sample: "Ciao, sono Judith. Ti avviso prima della scadenza di ogni bolletta.",
    desc: "Calda e chiara",
    tier: "excellent",
    sttCode: "it",
  },
  {
    code: "nl",
    label: "Dutch",
    native: "Nederlands",
    flag: "🇳🇱",
    sample: "Hoi, ik ben Judith. Ik herinner je voordat elke rekening vervalt.",
    desc: "Warm & helder",
    tier: "excellent",
    sttCode: "nl",
  },
  {
    code: "pl",
    label: "Polish",
    native: "Polski",
    flag: "🇵🇱",
    sample: "Cześć, jestem Judith. Przypomnę ci przed każdym terminem płatności.",
    desc: "Ciepły i wyraźny",
    tier: "excellent",
    sttCode: "pl",
  },
  {
    code: "sv",
    label: "Swedish",
    native: "Svenska",
    flag: "🇸🇪",
    sample: "Hej, jag är Judith. Jag påminner dig innan varje räkning förfaller.",
    desc: "Varm & tydlig",
    tier: "excellent",
    sttCode: "sv",
  },
  {
    code: "da",
    label: "Danish",
    native: "Dansk",
    flag: "🇩🇰",
    sample: "Hej, jeg er Judith. Jeg minder dig om det, før hver regning forfalder.",
    desc: "Varm & tydelig",
    tier: "excellent",
    sttCode: "da",
  },
  {
    code: "no",
    label: "Norwegian",
    native: "Norsk",
    flag: "🇳🇴",
    sample: "Hei, jeg er Judith. Jeg minner deg på før hver regning forfaller.",
    desc: "Varm & tydelig",
    tier: "excellent",
    sttCode: "no",
  },
  {
    code: "fi",
    label: "Finnish",
    native: "Suomi",
    flag: "🇫🇮",
    sample: "Hei, olen Judith. Muistutan sinua ennen jokaisen laskun eräpäivää.",
    desc: "Lämmin & selkeä",
    tier: "excellent",
    sttCode: "fi",
  },
  {
    code: "cs",
    label: "Czech",
    native: "Čeština",
    flag: "🇨🇿",
    sample: "Ahoj, jsem Judith. Připomenu ti to před splatností každého účtu.",
    desc: "Vřelý & jasný",
    tier: "excellent",
    sttCode: "cs",
  },
  {
    code: "sk",
    label: "Slovak",
    native: "Slovenčina",
    flag: "🇸🇰",
    sample: "Ahoj, som Judith. Pripomeniem ti to pred splatnosťou každého účtu.",
    desc: "Vrelý & jasný",
    tier: "excellent",
    sttCode: "sk",
  },
  {
    code: "ro",
    label: "Romanian",
    native: "Română",
    flag: "🇷🇴",
    sample: "Bună, sunt Judith. Îți amintesc înainte de scadența fiecărei facturi.",
    desc: "Caldă și clară",
    tier: "excellent",
    sttCode: "ro",
  },
  {
    code: "bg",
    label: "Bulgarian",
    native: "Български",
    flag: "🇧🇬",
    sample: "Здравей, аз съм Джудит. Ще ти напомня преди всяка сметка да стане дължима.",
    desc: "Топъл и ясен",
    tier: "excellent",
    sttCode: "bg",
  },
  {
    code: "hr",
    label: "Croatian",
    native: "Hrvatski",
    flag: "🇭🇷",
    sample: "Bok, ja sam Judith. Podsjetit ću te prije dospijeća svakog računa.",
    desc: "Topao i jasan",
    tier: "excellent",
    sttCode: "hr",
  },
  {
    code: "el",
    label: "Greek",
    native: "Ελληνικά",
    flag: "🇬🇷",
    sample: "Γεια, είμαι η Τζούντιθ. Θα σου θυμίσω πριν λήξει κάθε λογαριασμός.",
    desc: "Ζεστή & καθαρή",
    tier: "excellent",
    sttCode: "el",
  },
  {
    code: "hu",
    label: "Hungarian",
    native: "Magyar",
    flag: "🇭🇺",
    sample: "Szia, Judith vagyok. Emlékeztetlek minden számla esedékessége előtt.",
    desc: "Meleg & tiszta",
    tier: "excellent",
    sttCode: "hu",
  },
  {
    code: "uk",
    label: "Ukrainian",
    native: "Українська",
    flag: "🇺🇦",
    sample: "Привіт, я Джудіт. Я нагадаю тобі перед кожним платежем.",
    desc: "Тепла та чітка",
    tier: "excellent",
    sttCode: "uk",
  },
  {
    code: "ru",
    label: "Russian",
    native: "Русский",
    flag: "🇷🇺",
    sample: "Привет, я Джудит. Я напомню тебе перед каждым платежом.",
    desc: "Тёплая и чёткая",
    tier: "excellent",
    sttCode: "ru",
  },
  {
    code: "tr",
    label: "Turkish",
    native: "Türkçe",
    flag: "🇹🇷",
    sample: "Merhaba, ben Judith. Her fatura ödenmeden önce sana hatırlatırım.",
    desc: "Sıcak & net",
    tier: "excellent",
    sttCode: "tr",
  },
  {
    code: "ar",
    label: "Arabic",
    native: "العربية",
    flag: "🇸🇦",
    sample: "مرحباً، أنا جوديث. سأذكّرك قبل موعد استحقاق كل فاتورة.",
    desc: "دافئة وواضحة",
    tier: "excellent",
    sttCode: "ar",
    dialects: [
      {
        code: "ar",
        label: "Modern Standard",
        native: "الفصحى",
        sample: "مرحباً، أنا جوديث. سأذكّرك قبل موعد استحقاق كل فاتورة.",
        desc: "MSA · pan-Arab",
        sttCode: "ar",
      },
      {
        code: "arz",
        label: "Egyptian",
        native: "مصري",
        sample: "أهلاً، أنا جوديث. هفكّرك قبل ميعاد كل فاتورة.",
        desc: "مصر",
        sttCode: "ar",
      },
      {
        code: "apc",
        label: "Levantine",
        native: "شامي",
        sample: "مرحبا، أنا جوديث. رح ذكّرك قبل ما تستحق كل فاتورة.",
        desc: "الشام",
        sttCode: "ar",
      },
      {
        code: "afb",
        label: "Gulf",
        native: "خليجي",
        sample: "هلا، أنا جوديث. بذكّرك قبل موعد كل فاتورة.",
        desc: "الخليج",
        sttCode: "ar",
      },
    ],
  },
  {
    code: "hi",
    label: "Hindi",
    native: "हिन्दी",
    flag: "🇮🇳",
    sample: "नमस्ते, मैं जूडिथ हूँ। हर बिल की देय तिथि से पहले आपको याद दिलाऊँगी।",
    desc: "गर्मजोशी और स्पष्ट",
    tier: "excellent",
    sttCode: "hi",
  },
  {
    code: "ta",
    label: "Tamil",
    native: "தமிழ்",
    flag: "🇮🇳",
    sample: "வணக்கம், நான் ஜூடித். ஒவ்வொரு பில் கட்டணத் தேதிக்கு முன் உங்களுக்கு நினைவூட்டுவேன்.",
    desc: "அன்பும் தெளிவும்",
    tier: "excellent",
    sttCode: "ta",
  },
  {
    code: "ja",
    label: "Japanese",
    native: "日本語",
    flag: "🇯🇵",
    sample: "こんにちは、ジュディスです。請求の期限が来る前にお知らせします。",
    desc: "温かく明瞭",
    tier: "excellent",
    sttCode: "ja",
  },
  {
    code: "ko",
    label: "Korean",
    native: "한국어",
    flag: "🇰🇷",
    sample: "안녕하세요, 저는 주디스예요. 청구서 납부일 전에 미리 알려드릴게요.",
    desc: "따뜻하고 또렷한",
    tier: "excellent",
    sttCode: "ko",
  },
  {
    code: "zh",
    label: "Chinese",
    native: "中文",
    flag: "🇨🇳",
    sample: "你好，我是茱迪丝。每张账单到期前我都会提醒你。",
    desc: "温暖清晰",
    tier: "excellent",
    sttCode: "zh",
    dialects: [
      {
        code: "zh",
        label: "Mandarin",
        native: "普通话",
        sample: "你好，我是茱迪丝。每张账单到期前我都会提醒你。",
        desc: "Mainland · Taiwan",
        sttCode: "zh",
      },
      {
        code: "yue",
        label: "Cantonese",
        native: "粵語",
        sample: "你好，我係茱迪絲。每張單到期之前我都會提你。",
        desc: "Hong Kong · Guangdong",
        sttCode: "yue",
      },
    ],
  },
  {
    code: "id",
    label: "Indonesian",
    native: "Bahasa Indonesia",
    flag: "🇮🇩",
    sample: "Hai, aku Judith. Aku ingatkan sebelum tagihanmu jatuh tempo.",
    desc: "Hangat & jelas",
    tier: "excellent",
    sttCode: "id",
  },
  {
    code: "ms",
    label: "Malay",
    native: "Bahasa Melayu",
    flag: "🇲🇾",
    sample: "Hai, saya Judith. Saya ingatkan anda sebelum setiap bil perlu dibayar.",
    desc: "Mesra & jelas",
    tier: "excellent",
    sttCode: "ms",
  },
  {
    code: "vi",
    label: "Vietnamese",
    native: "Tiếng Việt",
    flag: "🇻🇳",
    sample: "Chào, mình là Judith. Mình nhắc bạn trước khi hoá đơn đến hạn.",
    desc: "Ấm áp & rõ ràng",
    tier: "excellent",
    sttCode: "vi",
  },
  {
    code: "th",
    label: "Thai",
    native: "ไทย",
    flag: "🇹🇭",
    sample: "สวัสดีค่ะ ฉันชื่อจูดิธ ฉันจะเตือนคุณก่อนถึงกำหนดชำระทุกบิล",
    desc: "อบอุ่นและชัดเจน",
    tier: "good",
    sttCode: "th",
  },
];

/** Flat lookup across languages + dialects by app code. */
export function languageByCode(code: string): Language | Dialect | undefined {
  for (const l of LANGUAGES) {
    if (l.code === code && (!l.dialects || l.dialects.some((d) => d.code === code)))
      return l;
    if (l.dialects) {
      const d = l.dialects.find((x) => x.code === code);
      if (d) return d;
    }
    if (l.code === code) return l;
  }
  return undefined;
}

/** Sample line for any language/dialect code (falls back to English). */
export function langSample(code: string): string {
  return languageByCode(code)?.sample ?? SAMPLE_EN;
}

/** Tagline for any language/dialect code. */
export function langDesc(code: string): string {
  return languageByCode(code)?.desc ?? "Clear & warm";
}

/** Best-effort ISO hint for Scribe STT (undefined → auto-detect). */
export function sttHint(code: string): string | undefined {
  const l = languageByCode(code);
  return (l as { sttCode?: string } | undefined)?.sttCode;
}

const FILIPINO_FAMILY = new Set(["fil", "ceb", "ilo", "hil"]);

/** True for Tagalog and the Philippine regional dialects. */
export function isFilipino(code: string): boolean {
  return FILIPINO_FAMILY.has(code);
}
