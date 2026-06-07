/**
 * Category localization — multilingual display labels and country-specific
 * category presets.
 *
 * Internal category keys ("Electricity", "Water", etc.) are stored as-is in
 * bills and used for all filtering / grouping. Only the DISPLAY labels change
 * per language. Country code controls which categories appear in the add-bill
 * picker (e.g. Gas is relevant in Japan/US/Europe but not the Philippines).
 */

type LabelMap = Record<string, string>;

/** Per-language display labels keyed by the English category storage key. */
const CATEGORY_LABELS: Record<string, LabelMap> = {
  fil: {
    Electricity: "Kuryente",
    Water: "Tubig",
    Gas: "Gas",
    Internet: "Internet",
    Mobile: "Mobile",
    Landline: "Telepono",
    "Credit card": "Credit Card",
    Subscription: "Subscription",
    "Web app": "Web App",
    Insurance: "Seguro",
    Custom: "Iba pa",
  },
  ja: {
    Electricity: "電気",
    Water: "水道",
    Gas: "ガス",
    Internet: "インターネット",
    Mobile: "携帯",
    Landline: "固定電話",
    "Credit card": "クレジットカード",
    Subscription: "サブスク",
    "Web app": "Webアプリ",
    Insurance: "保険",
    Custom: "その他",
  },
  ko: {
    Electricity: "전기",
    Water: "수도",
    Gas: "가스",
    Internet: "인터넷",
    Mobile: "휴대폰",
    Landline: "유선전화",
    "Credit card": "신용카드",
    Subscription: "구독",
    "Web app": "웹 앱",
    Insurance: "보험",
    Custom: "기타",
  },
  zh: {
    Electricity: "电费",
    Water: "水费",
    Gas: "煤气",
    Internet: "宽带",
    Mobile: "手机",
    Landline: "固定电话",
    "Credit card": "信用卡",
    Subscription: "订阅",
    "Web app": "网页应用",
    Insurance: "保险",
    Custom: "其他",
  },
  yue: {
    Electricity: "電費",
    Water: "水費",
    Gas: "煤氣",
    Internet: "寬頻",
    Mobile: "手機",
    Landline: "固定電話",
    "Credit card": "信用卡",
    Subscription: "訂閱",
    "Web app": "網頁應用",
    Insurance: "保險",
    Custom: "其他",
  },
  es: {
    Electricity: "Electricidad",
    Water: "Agua",
    Gas: "Gas",
    Internet: "Internet",
    Mobile: "Móvil",
    Landline: "Tel. fijo",
    "Credit card": "Tarjeta",
    Subscription: "Suscripción",
    "Web app": "App web",
    Insurance: "Seguro",
    Custom: "Otro",
  },
  pt: {
    Electricity: "Eletricidade",
    Water: "Água",
    Gas: "Gás",
    Internet: "Internet",
    Mobile: "Celular",
    Landline: "Tel. fixo",
    "Credit card": "Cartão",
    Subscription: "Assinatura",
    "Web app": "App web",
    Insurance: "Seguro",
    Custom: "Outro",
  },
  fr: {
    Electricity: "Électricité",
    Water: "Eau",
    Gas: "Gaz",
    Internet: "Internet",
    Mobile: "Mobile",
    Landline: "Tel. fixe",
    "Credit card": "Carte bancaire",
    Subscription: "Abonnement",
    "Web app": "Appli web",
    Insurance: "Assurance",
    Custom: "Autre",
  },
  de: {
    Electricity: "Strom",
    Water: "Wasser",
    Gas: "Gas",
    Internet: "Internet",
    Mobile: "Handy",
    Landline: "Festnetz",
    "Credit card": "Kreditkarte",
    Subscription: "Abo",
    "Web app": "Web-App",
    Insurance: "Versicherung",
    Custom: "Sonstiges",
  },
  it: {
    Electricity: "Luce",
    Water: "Acqua",
    Gas: "Gas",
    Internet: "Internet",
    Mobile: "Cellulare",
    Landline: "Tel. fisso",
    "Credit card": "Carta di credito",
    Subscription: "Abbonamento",
    "Web app": "App web",
    Insurance: "Assicurazione",
    Custom: "Altro",
  },
  id: {
    Electricity: "Listrik",
    Water: "Air",
    Gas: "Gas",
    Internet: "Internet",
    Mobile: "Ponsel",
    Landline: "Tel. rumah",
    "Credit card": "Kartu kredit",
    Subscription: "Langganan",
    "Web app": "Aplikasi web",
    Insurance: "Asuransi",
    Custom: "Lainnya",
  },
  ms: {
    Electricity: "Elektrik",
    Water: "Air",
    Gas: "Gas",
    Internet: "Internet",
    Mobile: "Telefon",
    Landline: "Tel. rumah",
    "Credit card": "Kad kredit",
    Subscription: "Langganan",
    "Web app": "Apl web",
    Insurance: "Insurans",
    Custom: "Lain-lain",
  },
  vi: {
    Electricity: "Điện",
    Water: "Nước",
    Gas: "Gas",
    Internet: "Internet",
    Mobile: "Di động",
    Landline: "Điện thoại bàn",
    "Credit card": "Thẻ tín dụng",
    Subscription: "Đăng ký",
    "Web app": "Ứng dụng web",
    Insurance: "Bảo hiểm",
    Custom: "Khác",
  },
  ar: {
    Electricity: "كهرباء",
    Water: "ماء",
    Gas: "غاز",
    Internet: "إنترنت",
    Mobile: "جوّال",
    Landline: "هاتف أرضي",
    "Credit card": "بطاقة ائتمان",
    Subscription: "اشتراك",
    "Web app": "تطبيق ويب",
    Insurance: "تأمين",
    Custom: "أخرى",
  },
  hi: {
    Electricity: "बिजली",
    Water: "पानी",
    Gas: "गैस",
    Internet: "इंटरनेट",
    Mobile: "मोबाइल",
    Landline: "लैंडलाइन",
    "Credit card": "क्रेडिट कार्ड",
    Subscription: "सदस्यता",
    "Web app": "वेब ऐप",
    Insurance: "बीमा",
    Custom: "अन्य",
  },
  th: {
    Electricity: "ไฟฟ้า",
    Water: "น้ำประปา",
    Gas: "แก๊ส",
    Internet: "อินเทอร์เน็ต",
    Mobile: "มือถือ",
    Landline: "โทรศัพท์บ้าน",
    "Credit card": "บัตรเครดิต",
    Subscription: "สมัครสมาชิก",
    "Web app": "เว็บแอป",
    Insurance: "ประกัน",
    Custom: "อื่นๆ",
  },
};

/** Filipino-family language codes — all map to the same label set. */
const FILIPINO_CODES = new Set(["fil", "ceb", "ilo", "hil"]);

/**
 * Normalizes an app language code to the key used in CATEGORY_LABELS.
 * Returns "en" for codes with no dedicated translation (falls back to the
 * raw English category key, which is already perfectly readable).
 */
function normalizeLang(language?: string): string {
  if (!language) return "fil";
  const l = language.toLowerCase();
  if (FILIPINO_CODES.has(l)) return "fil";
  if (l.startsWith("en")) return "en";
  if (l === "yue") return "yue";
  if (l.startsWith("zh")) return "zh";
  if (l.startsWith("pt")) return "pt";
  if (["arz", "apc", "afb"].includes(l)) return "ar";
  return l;
}

/**
 * Returns the localized display label for a category storage key.
 * Falls back to the raw English key for unsupported languages — the English
 * keys ("Electricity", "Water" …) are universally readable as-is.
 */
export function getCategoryLabel(cat: string, language?: string): string {
  const lang = normalizeLang(language);
  return CATEGORY_LABELS[lang]?.[cat] ?? cat;
}

/**
 * Countries where piped natural gas is a standard household utility.
 * Used to decide whether to include "Gas" in the add-bill category picker.
 */
const GAS_COUNTRIES = new Set([
  "JP", "KR", "CN", "TW", "HK", "MO",
  "US", "CA", "MX", "BR", "AR", "CL", "CO",
  "GB", "IE", "FR", "DE", "AT", "CH", "NL", "BE", "LU",
  "ES", "PT", "IT", "GR", "TR",
  "SE", "NO", "DK", "FI",
  "PL", "CZ", "SK", "HU", "RO", "BG", "HR", "RS", "UA", "RU",
  "AU", "NZ",
  "IN", "AE", "SA", "QA", "KW", "BH", "IL", "EG",
]);

/**
 * Countries where Landline is worth showing as a preset category.
 * (Most SE-Asian and Philippine users have landlines; most EU/US users do too.)
 */
const LANDLINE_COUNTRIES = new Set([
  "PH", "SG", "MY", "ID", "TH", "VN", "MM", "KH",
  "JP", "KR", "CN", "TW", "HK",
  "US", "CA", "GB", "AU", "NZ",
  "FR", "DE", "AT", "CH", "NL", "BE", "IT", "ES", "PT",
  "TR", "AE", "SA", "EG",
]);

/**
 * Returns the ordered list of category keys to display in the add-bill picker
 * for a given country code. Callers should pass `country.code` from the store.
 */
export function getVisibleCategories(countryCode?: string): string[] {
  const cc = (countryCode ?? "").toUpperCase();
  const cats: string[] = ["Electricity", "Water"];
  if (GAS_COUNTRIES.has(cc)) cats.push("Gas");
  cats.push("Internet", "Mobile");
  if (LANDLINE_COUNTRIES.has(cc)) cats.push("Landline");
  cats.push("Credit card", "Subscription", "Web app", "Insurance", "Custom");
  return cats;
}
