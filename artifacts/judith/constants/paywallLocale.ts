/**
 * Per-country paywall localisation: late-fee amounts, provider names, and
 * conversion copy. Amounts are in local-currency major units (integers).
 * Rendered in the UI via `fmtFee` as `${cur}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.
 *
 * Sources: bank/utility fee schedules, regulator disclosures, and provider
 * terms as of 2024–2025. Amounts are representative averages, not quotes.
 */

export interface PaywallFee {
  /** Short label shown in the math card (left column). */
  label: string;
  /** Provider names + brief note (subscript). */
  sub: string;
  /** Amount in local-currency major units. */
  amount: number;
}

export interface PaywallLocale {
  cc: PaywallFee;
  telco: PaywallFee;
  utility: PaywallFee;
  /**
   * 2–3 sentence hero subtext under the headline.
   * Name the specific local providers so it feels real.
   */
  heroBody: string;
  /** Body for the "No service cutoffs" relief card. */
  cutoffBody: string;
  /** Optional override body for "No surprise late charges" relief card. */
  lateBody?: string;
}

/* ─── regional base locales ──────────────────────────────────────── */

const EURO_BASE: PaywallLocale = {
  cc: { label: "Credit card late fee", sub: "Major banks — charged automatically", amount: 20 },
  telco: { label: "Mobile line suspension", sub: "Network operators — reconnection fee", amount: 15 },
  utility: { label: "Utility reconnection", sub: "Energy supplier — after 30-day overdue", amount: 25 },
  heroBody: "Utilities disconnect at Day 30. Your bank charges a late fee automatically. Mobile operators suspend without notice. Judith is less than any single charge.",
  cutoffBody: "Energy suppliers and mobile operators disconnect after 30 days. Late fees are charged automatically with no grace period. Judith nudges you before it gets there.",
};

const NORDIC_BASE: PaywallLocale = {
  cc: { label: "Credit card late fee", sub: "Major banks — statutory limit applies", amount: 200 },
  telco: { label: "Mobile line suspension", sub: "Network operators — reconnection fee", amount: 100 },
  utility: { label: "Utility reconnection", sub: "Energy supplier — after 30-day overdue", amount: 200 },
  heroBody: "Energy suppliers suspend service after 30 days. Banks charge late fees automatically. Mobile operators disconnect without warning. Judith costs less than any of that.",
  cutoffBody: "Energy providers and mobile operators cut service after 30 days overdue. Late fees are charged automatically. Judith nudges you days before it reaches that point.",
};

const LATAM_BASE: PaywallLocale = {
  cc: { label: "Credit card late fee", sub: "Major banks — mora automática", amount: 500 },
  telco: { label: "Mobile suspension fee", sub: "Network operators — cargo por reconexión", amount: 100 },
  utility: { label: "Utility reconnection", sub: "Power company — after 30-day overdue", amount: 150 },
  heroBody: "The utility cuts service at Day 30. Your bank charges a late fee automatically. Your mobile operator suspends without notice. Judith costs less than one fee.",
  cutoffBody: "Utilities and mobile operators cut service at Day 30 — automatically, without a call. Late fees compound quickly. Judith nudges you before any of it starts.",
};

const CEE_BASE: PaywallLocale = {
  cc: { label: "Credit card late fee", sub: "Major banks — charged automatically", amount: 25 },
  telco: { label: "Mobile line suspension", sub: "Network operators — reconnection fee", amount: 15 },
  utility: { label: "Utility reconnection", sub: "Energy supplier — after 30-day overdue", amount: 20 },
  heroBody: "Energy suppliers disconnect at Day 30. Banks charge late fees without warning. Mobile operators suspend lines automatically. Judith costs less than any single charge.",
  cutoffBody: "Energy providers and mobile operators disconnect after 30 days. Late fees are automatic with no grace period. Judith reminds you before it ever reaches that point.",
};

const MIDDLE_EAST_BASE: PaywallLocale = {
  cc: { label: "Credit card late fee", sub: "Major banks — automatic charge", amount: 100 },
  telco: { label: "Mobile line suspension", sub: "Operators — reconnection charge", amount: 30 },
  utility: { label: "Utility reconnection", sub: "Electricity provider — after overdue", amount: 50 },
  heroBody: "Utility providers disconnect after 30 days. Your bank charges a late fee automatically. Mobile operators suspend without notice. Judith is a fraction of any of that.",
  cutoffBody: "Electricity and telecom providers disconnect after 30 days overdue. Late fees are charged automatically. Judith nudges you days before it gets there.",
};

const GENERIC: PaywallLocale = {
  cc: { label: "Credit card late fee", sub: "Standard bank — automatic charge", amount: 30 },
  telco: { label: "Mobile reconnection fee", sub: "Telecom operator — after suspension", amount: 15 },
  utility: { label: "Utility reconnection", sub: "Provider — after 30-day overdue", amount: 20 },
  heroBody: "Utilities disconnect at Day 30. Banks charge late fees automatically. Mobile operators suspend without calling first. Judith costs less than any single fee.",
  cutoffBody: "Utilities and mobile operators cut service after 30 days overdue — automatically, without warning. Judith nudges you days before it reaches that point.",
};

/* ─── per-country data ───────────────────────────────────────────── */

const LOCALES: Partial<Record<string, PaywallLocale>> = {
  /* ── Southeast Asia ────────────────────────────────────────────── */
  PH: {
    cc: { label: "Credit card late fee", sub: "BPI, BDO, Security Bank — no grace period", amount: 750 },
    telco: { label: "Postpaid reconnection fee", sub: "Globe, Smart, PLDT — automatic surcharge", amount: 200 },
    utility: { label: "Meralco reconnection", sub: "Service interruption after 30-day overdue", amount: 150 },
    heroBody: "Globe suspends your line at Day 30. BDO charges ₱750 automatically. Meralco disconnects without mercy. Judith costs less than any single one of those.",
    cutoffBody: "Globe and PLDT suspend lines at Day 30. Meralco sends a disconnection notice at Day 28 — and follows through. Judith nudges you days before it gets there.",
    lateBody: "BPI and BDO debit ₱750 automatically the moment you miss a CC due date — no call, no warning. Judith keeps every due date visible weeks in advance.",
  },
  ID: {
    cc: { label: "CC denda keterlambatan", sub: "BCA, Mandiri, BNI — dibebankan otomatis", amount: 150_000 },
    telco: { label: "Biaya reaktivasi nomor", sub: "Telkomsel, Indosat, XL — setelah blokir", amount: 50_000 },
    utility: { label: "Biaya penyambungan PLN", sub: "PLN — setelah pemutusan Day 30", amount: 75_000 },
    heroBody: "PLN memutus aliran listrik di Day 30. BCA mendebit denda otomatis. Telkomsel memblokir nomor tanpa peringatan. Judith lebih murah dari satu denda saja.",
    cutoffBody: "PLN memutus listrik dan Telkomsel memblokir nomor secara otomatis di Day 30 — tanpa pemberitahuan. Judith mengingatkan Anda jauh sebelum itu terjadi.",
    lateBody: "Denda keterlambatan kartu kredit dibebankan secara otomatis — Rp 150.000, tanpa konfirmasi. Judith menampilkan setiap jatuh tempo dengan jelas, jauh sebelum waktunya.",
  },
  MY: {
    cc: { label: "Credit card late fee", sub: "Maybank, CIMB, Public Bank — auto charge", amount: 25 },
    telco: { label: "Postpaid line suspension fee", sub: "Maxis, Celcom, Digi — after cut-off", amount: 10 },
    utility: { label: "TNB reconnection fee", sub: "Tenaga Nasional — after 30-day overdue", amount: 30 },
    heroBody: "TNB disconnects at Day 30. CIMB charges RM 25 automatically. Maxis suspends your line without notice. Judith is less than one of those charges.",
    cutoffBody: "TNB disconnects power and Maxis / Celcom suspend lines at Day 30 — automatically, no call. Judith nudges you days before it reaches that point.",
    lateBody: "Maybank and CIMB debit RM 25 the moment you miss a due date — no warning. Judith keeps every bill due date visible weeks ahead.",
  },
  SG: {
    cc: { label: "Credit card late fee", sub: "DBS, OCBC, UOB — standard charge", amount: 100 },
    telco: { label: "Postpaid suspension fee", sub: "Singtel, StarHub, M1 — reconnection", amount: 30 },
    utility: { label: "SP Group reconnection", sub: "After service interruption", amount: 40 },
    heroBody: "SP Group disconnects at Day 30. DBS charges S$100 automatically. Singtel suspends your line without a call. Judith is a fraction of that.",
    cutoffBody: "SP Group, Singtel, and StarHub all disconnect at Day 30 — without warning. Judith nudges you days before any of it happens.",
    lateBody: "DBS and OCBC debit S$100 the moment you miss a due date — no reminder, no grace. Judith shows every due date clearly, weeks in advance.",
  },
  TH: {
    cc: { label: "ค่าธรรมเนียมชำระล่าช้า", sub: "Kasikorn, Bangkok Bank, SCB — ตัดอัตโนมัติ", amount: 1_000 },
    telco: { label: "ค่าเปิดใช้งานซิมอีกครั้ง", sub: "AIS, DTAC, True Move — หลังระงับสาย", amount: 200 },
    utility: { label: "ค่าต่อไฟใหม่", sub: "PEA / MEA — หลังค้างชำระ 30 วัน", amount: 300 },
    heroBody: "MEA ตัดไฟที่วันที่ 30 Kasikorn หักค่าธรรมเนียมอัตโนมัติ AIS ระงับเลขหมายโดยไม่แจ้งเตือน Judith ถูกกว่าค่าธรรมเนียมเดียว",
    cutoffBody: "MEA, PEA, AIS และ DTAC ระงับบริการหลังค้างชำระ 30 วัน — โดยอัตโนมัติ Judith แจ้งเตือนคุณก่อนถึงวันนั้น",
  },
  VN: {
    cc: { label: "Phí trả chậm thẻ tín dụng", sub: "Vietcombank, Techcombank, VPBank — tự động", amount: 200_000 },
    telco: { label: "Phí kích hoạt lại số", sub: "Viettel, Mobifone, Vinaphone — sau khóa", amount: 50_000 },
    utility: { label: "Phí nối điện lại", sub: "EVN — sau 30 ngày quá hạn", amount: 100_000 },
    heroBody: "EVN cắt điện vào ngày 30. Vietcombank tự động trừ phí. Viettel khóa số mà không báo trước. Judith rẻ hơn bất kỳ khoản phí nào.",
    cutoffBody: "EVN, Viettel và Mobifone đều cắt dịch vụ sau 30 ngày — tự động, không cảnh báo. Judith nhắc bạn trước nhiều ngày.",
  },

  /* ── East & South Asia ─────────────────────────────────────────── */
  JP: {
    cc: { label: "クレジットカード遅延損害金", sub: "楽天カード、三菱UFJ、住友 — 自動引落し", amount: 3_300 },
    telco: { label: "携帯電話利用停止・再開手数料", sub: "NTTドコモ、au、SoftBank", amount: 3_300 },
    utility: { label: "電気再接続手数料", sub: "東京電力、関西電力 — 30日滞納後", amount: 2_200 },
    heroBody: "東京電力は30日後に電気を止めます。ドコモは警告なしに回線を停止します。楽天カードは自動的に遅延損害金を請求します。JudithはそれよりもはるかにLower",
    cutoffBody: "東京電力とNTTドコモは30日後に自動的にサービスを停止します。Judithは停止前に通知します。",
  },
  KR: {
    cc: { label: "신용카드 연체 수수료", sub: "현대카드, 신한카드, 삼성카드 — 자동 청구", amount: 20_000 },
    telco: { label: "휴대폰 정지 재개통 수수료", sub: "SK텔레콤, KT, LG U+ — 연체 후", amount: 10_000 },
    utility: { label: "한전 전기 재연결 수수료", sub: "KEPCO — 30일 연체 후", amount: 10_000 },
    heroBody: "한전은 30일 후 단전합니다. 신한카드는 자동으로 수수료를 청구합니다. SKT는 예고 없이 회선을 정지합니다. Judith는 그 중 어떤 청구보다 저렴합니다.",
    cutoffBody: "한전과 SKT는 30일 후 자동으로 서비스를 차단합니다. Judith는 그 전에 미리 알림을 드립니다.",
  },
  CN: {
    cc: { label: "信用卡逾期手续费", sub: "工商银行、建设银行、农业银行 — 自动扣款", amount: 200 },
    telco: { label: "手机停机恢复费", sub: "中国移动、中国联通 — 欠费停机后", amount: 50 },
    utility: { label: "电力恢复接通费", sub: "国家电网 — 逾期30天后", amount: 50 },
    heroBody: "国家电网在第30天停电。工商银行自动扣取手续费。中国移动无预警停机。Judith的费用远低于任何一项罚款。",
    cutoffBody: "国家电网和中国移动在逾期30天后自动停止服务。Judith会在此之前提醒您。",
  },
  HK: {
    cc: { label: "Credit card late charge", sub: "HSBC, Hang Seng, Standard Chartered", amount: 250 },
    telco: { label: "Mobile suspension fee", sub: "HKT, CSL, SmarTone — after cut-off", amount: 50 },
    utility: { label: "CLP/HK Electric reconnection", sub: "After service interruption", amount: 100 },
    heroBody: "CLP disconnects at Day 30. HSBC charges HK$250 automatically. HKT suspends your line without warning. Judith is less than any single charge.",
    cutoffBody: "CLP, HKT, and SmarTone all cut service after 30 days. Late fees are charged with no grace period. Judith nudges you before it gets there.",
  },
  TW: {
    cc: { label: "信用卡逾期違約金", sub: "中信、國泰、富邦 — 自動扣款", amount: 500 },
    telco: { label: "手機停話恢復費用", sub: "中華電信、台灣大哥大 — 停話後", amount: 100 },
    utility: { label: "台電重新供電費用", sub: "臺灣電力公司 — 逾期30天後", amount: 100 },
    heroBody: "台電在第30天停電。中信銀行自動收取違約金。中華電信無預警停話。Judith的費用遠低於任何一項罰款。",
    cutoffBody: "台電和中華電信在逾期30天後自動停止服務，不另行通知。Judith會在此之前提醒您。",
  },
  IN: {
    cc: { label: "Credit card late payment fee", sub: "HDFC, ICICI, SBI Card — auto-deducted", amount: 1_200 },
    telco: { label: "Mobile reactivation charge", sub: "Jio, Airtel, Vi — after suspension", amount: 200 },
    utility: { label: "Electricity reconnection fee", sub: "MSEDCL / BESCOM — after disconnection", amount: 300 },
    heroBody: "Your electricity board disconnects at Day 30. HDFC Bank debits ₹1,200 automatically. Jio suspends your number without notice. Judith costs less than any single fee.",
    cutoffBody: "MSEDCL, BESCOM, and Airtel all cut service after 30 days overdue — automatically. Judith reminds you days before it reaches that point.",
    lateBody: "HDFC and ICICI debit late fees automatically — ₹1,200, no warning. A missed CC payment also affects your CIBIL score. Judith keeps every due date clear weeks ahead.",
  },

  /* ── Oceania ────────────────────────────────────────────────────── */
  AU: {
    cc: { label: "Credit card late payment fee", sub: "CommBank, ANZ, Westpac — auto charged", amount: 20 },
    telco: { label: "Mobile plan suspension", sub: "Telstra, Optus, Vodafone — after overdue", amount: 15 },
    utility: { label: "Energy reconnection fee", sub: "AGL, Origin Energy — after disconnection", amount: 25 },
    heroBody: "AGL and Origin disconnect power after 30 days. CommBank charges $20 automatically. Telstra suspends plans without a call. Judith is less than one of those fees.",
    cutoffBody: "AGL, Origin Energy, Telstra, and Optus all disconnect after 30 days overdue. Reconnection fees and credit impacts follow. Judith nudges you before any of it happens.",
    lateBody: "CommBank and ANZ debit late fees automatically, and missed payments affect your credit file. Judith keeps every due date visible weeks in advance.",
  },
  NZ: {
    cc: { label: "Credit card late payment fee", sub: "ANZ, BNZ, Westpac NZ — auto charged", amount: 20 },
    telco: { label: "Mobile plan suspension", sub: "Spark, One NZ, 2degrees — after overdue", amount: 15 },
    utility: { label: "Power reconnection fee", sub: "Contact Energy, Mercury — after cut-off", amount: 25 },
    heroBody: "Contact Energy and Mercury disconnect power after 30 days. ANZ charges $20 automatically. Spark suspends plans without notice. Judith costs less than any single fee.",
    cutoffBody: "Contact Energy, Mercury, Spark, and One NZ all disconnect after 30 days. Reconnection fees follow. Judith nudges you days before it reaches that point.",
  },

  /* ── North America ──────────────────────────────────────────────── */
  US: {
    cc: { label: "Credit card late fee", sub: "Chase, Bank of America, Citi — auto charged", amount: 30 },
    telco: { label: "Internet/mobile late fee", sub: "Comcast, AT&T, Verizon — after overdue", amount: 10 },
    utility: { label: "Utility reconnection fee", sub: "Local utility — after service cut-off", amount: 25 },
    heroBody: "Your utility company disconnects at Day 30. Chase charges $30 automatically. AT&T suspends service without a call. Judith is a fraction of that.",
    cutoffBody: "Utilities, Comcast, and AT&T all cut service at Day 30 — automatically. Missed payments go to your credit report. Judith nudges you before either happens.",
    lateBody: "Chase and Bank of America charge $30 automatically — and a missed payment can drop your credit score 60–110 points. Judith keeps every due date visible weeks ahead.",
  },
  CA: {
    cc: { label: "Credit card late fee", sub: "TD, RBC, BMO, Scotiabank — auto charged", amount: 35 },
    telco: { label: "Mobile suspension fee", sub: "Rogers, Bell, Telus — after overdue", amount: 15 },
    utility: { label: "Hydro reconnection fee", sub: "Hydro One, BC Hydro, FortisBC", amount: 30 },
    heroBody: "Hydro One disconnects at Day 30. TD Bank charges $35 automatically. Rogers suspends your plan without a call. Judith costs less than any single fee.",
    cutoffBody: "Hydro One, Rogers, and Bell disconnect after 30 days overdue — with no grace period. Late fees and credit impacts follow. Judith nudges you before it reaches that point.",
  },
  MX: {
    cc: { label: "Comisión por pago tardío", sub: "BBVA, Banamex, Santander — cargo automático", amount: 500 },
    telco: { label: "Cargo por suspensión Telcel", sub: "Telcel, AT&T México, Movistar", amount: 100 },
    utility: { label: "Reconexión CFE", sub: "CFE — después de corte por mora", amount: 150 },
    heroBody: "CFE corta la luz al día 30. BBVA cobra $500 de comisión automáticamente. Telcel suspende tu línea sin aviso. Judith cuesta menos que cualquiera de esos cargos.",
    cutoffBody: "CFE, Telcel y AT&T México cortan el servicio al día 30 — automáticamente, sin llamar. Judith te avisa con días de anticipación.",
  },

  /* ── Latin America ──────────────────────────────────────────────── */
  BR: {
    cc: { label: "Multa por atraso no cartão", sub: "Nubank, Bradesco, Itaú — cobrado automaticamente", amount: 60 },
    telco: { label: "Taxa de reativação", sub: "Claro, Vivo, TIM — após suspensão", amount: 20 },
    utility: { label: "Taxa de religação de energia", sub: "Cemig, Enel, Light — após corte", amount: 30 },
    heroBody: "A CEMIG corta a energia no dia 30. O Bradesco cobra a multa automaticamente. A Vivo suspende sua linha sem aviso. Judith custa menos do que qualquer uma dessas cobranças.",
    cutoffBody: "CEMIG, Enel, Claro e Vivo cortam o serviço no dia 30 — automaticamente, sem ligar. Judith te avisa com antecedência.",
  },
  AR: {
    ...LATAM_BASE,
    cc: { label: "Cargo por pago tardío", sub: "Galicia, Santander, BBVA — automático", amount: 1_500 },
    telco: { label: "Cargo por suspensión", sub: "Personal, Claro, Movistar — tras corte", amount: 300 },
    utility: { label: "Reconexión Edenor/Edesur", sub: "Tras corte por mora", amount: 500 },
    heroBody: "Edenor corta la luz al día 30. Banco Galicia cobra automáticamente. Personal suspende tu línea sin aviso. Judith cuesta menos que cualquier cargo.",
    cutoffBody: "Edenor, Personal y Claro cortan el servicio al día 30 — automáticamente. Judith te avisa con días de anticipación.",
  },
  CO: {
    ...LATAM_BASE,
    cc: { label: "Cuota de mora tarjeta", sub: "Bancolombia, Davivienda, Bogotá — automático", amount: 35_000 },
    telco: { label: "Cargo reconexión celular", sub: "Claro, Movistar, Tigo — tras suspensión", amount: 8_000 },
    utility: { label: "Reconexión Codensa/EPM", sub: "Tras corte por mora de 30 días", amount: 15_000 },
    heroBody: "Codensa corta la luz al día 30. Bancolombia cobra mora automáticamente. Claro suspende tu línea sin aviso. Judith vale menos que cualquier cargo.",
    cutoffBody: "Codensa, EPM, Claro y Movistar cortan el servicio al día 30. Judith te avisa con días de anticipación.",
  },
  CL: {
    ...LATAM_BASE,
    cc: { label: "Comisión por atraso tarjeta", sub: "Banco de Chile, Santander, BCI — automático", amount: 5_000 },
    telco: { label: "Cargo reconexión celular", sub: "Entel, Movistar, Claro — tras suspensión", amount: 1_000 },
    utility: { label: "Reconexión Enel / CGE", sub: "Tras corte por mora de 30 días", amount: 2_000 },
    heroBody: "Enel corta la luz al día 30. Banco de Chile cobra automáticamente. Entel suspende tu línea sin aviso. Judith cuesta menos que cualquier cargo.",
    cutoffBody: "Enel, CGE, Entel y Movistar cortan el servicio al día 30. Judith te avisa con días de anticipación.",
  },

  /* ── United Kingdom & Ireland ───────────────────────────────────── */
  GB: {
    cc: { label: "Credit card late fee", sub: "HSBC, Barclays, Lloyds — statutory cap £12", amount: 12 },
    telco: { label: "Mobile line suspension fee", sub: "EE, O2, Vodafone — after overdue", amount: 10 },
    utility: { label: "Energy reconnection fee", sub: "British Gas, EDF, E.ON — after cut-off", amount: 25 },
    heroBody: "British Gas disconnects at Day 30. Barclays charges £12 automatically. EE suspends your plan without calling first. Judith is less than any of those.",
    cutoffBody: "British Gas, EDF, EE, and O2 all disconnect after 30 days. Reconnection fees and credit marker impacts follow. Judith nudges you days before any of that happens.",
    lateBody: "Barclays and Lloyds charge late fees automatically — and a missed payment marks your credit file. Judith keeps every due date visible well in advance.",
  },
  IE: {
    cc: { label: "Credit card late fee", sub: "AIB, Bank of Ireland, Ulster Bank — auto", amount: 12 },
    telco: { label: "Mobile suspension fee", sub: "Three, Vodafone, Eir — after overdue", amount: 10 },
    utility: { label: "Electric Ireland reconnection", sub: "Electric Ireland / Bord Gáis — after cut-off", amount: 25 },
    heroBody: "Electric Ireland disconnects at Day 30. AIB charges automatically. Vodafone suspends your plan without a call. Judith costs less than any single fee.",
    cutoffBody: "Electric Ireland, Bord Gáis, Three, and Vodafone all disconnect after 30 days overdue. Judith nudges you before it gets there.",
  },

  /* ── Western Europe ─────────────────────────────────────────────── */
  DE: {
    cc: { label: "Kreditkarten-Verzugsgebühr", sub: "Deutsche Bank, Commerzbank, DKB — automatisch", amount: 15 },
    telco: { label: "Mobilfunk-Sperrgebühr", sub: "Telekom, Vodafone, o2 — nach Sperre", amount: 15 },
    utility: { label: "Wiederanschlussgebühr Strom", sub: "E.ON, EnBW, RWE — nach Sperrung", amount: 25 },
    heroBody: "E.ON sperrt den Strom am Tag 30. Die Deutsche Bank berechnet Gebühren automatisch. Telekom sperrt ohne Vorwarnung. Judith kostet weniger als eine einzige Gebühr.",
    cutoffBody: "E.ON, EnBW, Telekom und Vodafone sperren nach 30 Tagen automatisch — ohne Anruf. Judith erinnert Sie Tage vorher.",
  },
  FR: {
    cc: { label: "Frais de retard carte bancaire", sub: "BNP Paribas, Crédit Agricole, SG — auto", amount: 12 },
    telco: { label: "Frais de suspension mobile", sub: "Orange, SFR, Bouygues — après suspension", amount: 10 },
    utility: { label: "Frais de remise en service EDF", sub: "EDF / Engie — après coupure", amount: 25 },
    heroBody: "EDF coupe l'électricité au jour 30. BNP Paribas débite automatiquement. Orange suspend sans préavis. Judith coûte moins qu'un seul frais.",
    cutoffBody: "EDF, Engie, Orange et SFR coupent le service après 30 jours — automatiquement. Judith vous rappelle avant d'en arriver là.",
  },
  ES: {
    cc: { label: "Comisión por pago tardío", sub: "CaixaBank, BBVA, Santander — automática", amount: 20 },
    telco: { label: "Cargo por suspensión móvil", sub: "Movistar, Vodafone, Orange — tras corte", amount: 15 },
    utility: { label: "Reconexión Iberdrola/Endesa", sub: "Tras corte por mora de 30 días", amount: 25 },
    heroBody: "Iberdrola corta la luz al día 30. CaixaBank cobra automáticamente. Movistar suspende sin aviso. Judith cuesta menos que cualquier cargo.",
    cutoffBody: "Iberdrola, Endesa, Movistar y Vodafone cortan el servicio al día 30 — automáticamente. Judith te avisa con días de anticipación.",
  },
  IT: {
    cc: { label: "Commissione per ritardo", sub: "Intesa Sanpaolo, UniCredit, Fineco — auto", amount: 20 },
    telco: { label: "Costo riattivazione SIM", sub: "TIM, Vodafone, Wind Tre — dopo sospensione", amount: 15 },
    utility: { label: "Costo riallaccio Enel", sub: "Enel / A2A — dopo distacco", amount: 25 },
    heroBody: "Enel stacca la corrente al giorno 30. Intesa Sanpaolo addebita automaticamente. TIM sospende senza preavviso. Judith costa meno di qualsiasi singola commissione.",
    cutoffBody: "Enel, A2A, TIM e Vodafone sospendono il servizio dopo 30 giorni — automaticamente. Judith ti ricorda prima che accada.",
  },
  PT: { ...EURO_BASE,
    cc: { label: "Comissão por pagamento em atraso", sub: "Millennium BCP, BPI, Caixa Geral — auto", amount: 15 },
    telco: { label: "Taxa de suspensão móvel", sub: "MEO, NOS, Vodafone Portugal — após corte", amount: 10 },
    utility: { label: "Custo de religação EDP", sub: "EDP — após corte por mora", amount: 25 },
    heroBody: "A EDP corta a eletricidade no dia 30. O Millennium BCP debita automaticamente. A MEO suspende sem aviso. Judith custa menos que qualquer encargo.",
    cutoffBody: "EDP, MEO e NOS cortam o serviço após 30 dias — automaticamente. Judith avisa-o dias antes de chegar a esse ponto.",
  },
  NL: { ...EURO_BASE,
    cc: { label: "Kredietkaart vertragingskosten", sub: "ING, ABN AMRO, Rabobank — automatisch", amount: 15 },
    telco: { label: "Afsluiting mobiele lijn", sub: "KPN, Vodafone, T-Mobile NL", amount: 15 },
    utility: { label: "Herverbinding Eneco/Vattenfall", sub: "Na afsluiting wegens achterstand", amount: 25 },
    heroBody: "Eneco sluit de stroom af op dag 30. ING debiteert automatisch. KPN sluit de lijn zonder waarschuwing. Judith kost minder dan een enkele vergoeding.",
    cutoffBody: "Eneco, Vattenfall, KPN en Vodafone NL sluiten na 30 dagen af — automatisch. Judith herinnert u dagen van tevoren.",
  },
  BE: { ...EURO_BASE },

  /* ── Nordics ────────────────────────────────────────────────────── */
  SE: { ...NORDIC_BASE,
    cc: { label: "Förseningsavgift kreditkort", sub: "SEB, Handelsbanken, Swedbank — automatisk", amount: 250 },
    telco: { label: "Avgift för spärrning mobil", sub: "Telia, Tele2, Tre — efter försenad betalning", amount: 100 },
    utility: { label: "Återkopplingsavgift el", sub: "Vattenfall, E.ON Sverige — efter frånkoppling", amount: 200 },
    heroBody: "Vattenfall kopplar från elen på dag 30. SEB debiterar automatiskt. Telia spärrar utan förvarning. Judith kostar mindre än en enda avgift.",
    cutoffBody: "Vattenfall, E.ON, Telia och Tele2 kopplar från efter 30 dagar. Judith påminner dig dagarna innan.",
  },
  DK: { ...NORDIC_BASE,
    cc: { label: "Rykkergebyr kreditkort", sub: "Danske Bank, Nordea, Jyske Bank — automatisk", amount: 250 },
    telco: { label: "Lukkebetaling mobilabonnement", sub: "TDC, Telenor, 3 — efter forsinket betaling", amount: 100 },
    utility: { label: "Genoptagelsesgebyr el", sub: "Ørsted, E.ON DK — efter afbrydelse", amount: 200 },
    heroBody: "Ørsted afbryder strømmen på dag 30. Danske Bank trækker automatisk. TDC lukker dit abonnement uden varsel. Judith koster mindre end ét enkelt gebyr.",
    cutoffBody: "Ørsted, E.ON, TDC og Telenor afbryder service efter 30 dage. Judith minder dig om det dagen i forvejen.",
  },
  NO: { ...NORDIC_BASE,
    cc: { label: "Purregebyr kredittkort", sub: "DNB, Nordea NO, SpareBank — automatisk", amount: 250 },
    telco: { label: "Sperregebyr mobilabonnement", sub: "Telenor, Telia NO, ice — etter forsinkelse", amount: 100 },
    utility: { label: "Gjenoppkoblingsgebyr strøm", sub: "Hafslund, Elvia — etter frakobling", amount: 200 },
    heroBody: "Hafslund kobler fra strømmen på dag 30. DNB trekker gebyr automatisk. Telenor sperrer uten forvarsel. Judith koster mindre enn ett enkelt gebyr.",
    cutoffBody: "Hafslund, Telenor og Telia kobler fra etter 30 dager. Judith minner deg på forhånd.",
  },
  FI: { ...EURO_BASE,
    cc: { label: "Myöhästymismaksu luottokortista", sub: "OP, Nordea FI, Danske Bank FI — automaattinen", amount: 15 },
    telco: { label: "Sulkemismaksu mobiililiittymä", sub: "Elisa, DNA, Telia FI — viivästyksen jälkeen", amount: 10 },
    utility: { label: "Kytkentämaksu sähkö", sub: "Helen, Fortum — katkaisun jälkeen", amount: 20 },
    heroBody: "Helen katkaisee sähkön päivänä 30. OP veloittaa automaattisesti. Elisa sulkee liittymän ilman varoitusta. Judith maksaa vähemmän kuin yksikin maksu.",
    cutoffBody: "Helen, Fortum, Elisa ja DNA katkaisevat palvelun 30 päivän jälkeen. Judith muistuttaa sinua hyvissä ajoin.",
  },

  /* ── Central & Eastern Europe ───────────────────────────────────── */
  PL: { ...CEE_BASE,
    cc: { label: "Opłata za spóźnioną płatność", sub: "PKO, mBank, Santander PL — automatyczna", amount: 25 },
    telco: { label: "Opłata za blokadę telefonu", sub: "Play, Orange PL, T-Mobile PL", amount: 15 },
    utility: { label: "Opłata za ponowne podłączenie", sub: "Energa, PGE — po 30 dniach zaległości", amount: 20 },
    heroBody: "Energa odcina prąd w dniu 30. PKO Bank pobiera opłatę automatycznie. Play blokuje linię bez ostrzeżenia. Judith kosztuje mniej niż jedna opłata.",
    cutoffBody: "Energa, PGE, Play i Orange PL odcinają usługi po 30 dniach. Judith przypomina ci wcześniej.",
  },
  CZ: { ...CEE_BASE,
    cc: { label: "Poplatek za pozdní platbu", sub: "ČSOB, Česká spořitelna, Komerční banka", amount: 500 },
    telco: { label: "Poplatek za obnovení SIM", sub: "O2 CZ, T-Mobile CZ, Vodafone CZ", amount: 200 },
    utility: { label: "Poplatek za obnovení energie", sub: "ČEZ, E.ON CZ — po 30 dnech prodlení", amount: 300 },
    heroBody: "ČEZ odpojí elektřinu 30. dne. ČSOB strží poplatek automaticky. O2 CZ zablokuje číslo bez varování. Judith stojí méně než jediný poplatek.",
    cutoffBody: "ČEZ, E.ON, O2 CZ a T-Mobile CZ přeruší služby po 30 dnech — automaticky. Judith vás upozorní dříve.",
  },
  RO: { ...CEE_BASE,
    cc: { label: "Comision întârziere card credit", sub: "BCR, BRD, Banca Transilvania — automat", amount: 25 },
    telco: { label: "Taxă reactivare linie mobilă", sub: "Orange RO, Vodafone RO, Digi Mobil", amount: 10 },
    utility: { label: "Taxă reconectare energie", sub: "Enel RO, Electrica — după 30 zile restanță", amount: 20 },
    heroBody: "Enel România întrerupe curentul în ziua 30. BCR percepe automat comisionul. Orange RO suspendă fără avertizare. Judith costă mai puțin decât orice taxă.",
    cutoffBody: "Enel, Electrica, Orange RO și Vodafone RO întrerup serviciile după 30 de zile. Judith te avertizează din timp.",
  },
  HU: { ...CEE_BASE,
    cc: { label: "Késedelmi díj hitelkártya", sub: "OTP, K&H, Raiffeisen HU — automatikus", amount: 3_000 },
    telco: { label: "Felfüggesztési díj mobilszám", sub: "Telekom HU, Vodafone HU, Yettel", amount: 1_500 },
    utility: { label: "Visszakapcsolási díj energia", sub: "MVM, E.ON HU — 30 napos késés után", amount: 2_000 },
    heroBody: "MVM 30. napon kikapcsolja az áramot. OTP Bank automatikusan terheli a díjat. Telekom HU figyelmeztetés nélkül felfüggeszt. Judith kevesebbe kerül, mint bármelyik díj.",
    cutoffBody: "MVM, E.ON HU, Telekom HU és Vodafone HU 30 nap után automatikusan lekapcsolják a szolgáltatást. Judith előre figyelmeztet.",
  },
  GR: { ...EURO_BASE,
    cc: { label: "Τόκος υπερημερίας κάρτας", sub: "Εθνική, Alpha Bank, Πειραιώς — αυτόματα", amount: 25 },
    telco: { label: "Χρέωση αναστολής κινητού", sub: "Cosmote, Vodafone GR, Wind — μετά αναστολή", amount: 10 },
    utility: { label: "Επανασύνδεση ΔΕΗ", sub: "ΔΕΗ — μετά από 30ήμερη οφειλή", amount: 20 },
    heroBody: "Η ΔΕΗ κόβει το ρεύμα την 30ή ημέρα. Η Εθνική Τράπεζα χρεώνει αυτόματα. Η Cosmote αναστέλλει χωρίς ειδοποίηση. Η Judith κοστίζει λιγότερο από οποιαδήποτε χρέωση.",
    cutoffBody: "ΔΕΗ, Cosmote και Vodafone GR διακόπτουν υπηρεσίες μετά από 30 ημέρες. Η Judith σας υπενθυμίζει εκ των προτέρων.",
  },
  HR: { ...EURO_BASE },
  SK: { ...EURO_BASE },
  BG: { ...CEE_BASE,
    cc: { label: "Такса за просрочено плащане", sub: "UniCredit BG, DSK, First Investment — авт.", amount: 20 },
    telco: { label: "Такса за спиране на линия", sub: "A1 BG, Telenor BG, Vivacom", amount: 10 },
    utility: { label: "Такса за повторно включване", sub: "ЧЕЗ, EVN BG — след 30-дневно забавяне", amount: 15 },
    heroBody: "ЧЕЗ спира тока на 30-ия ден. UniCredit таксува автоматично. A1 BG спира линията без предупреждение. Judith струва по-малко от една такса.",
    cutoffBody: "ЧЕЗ, EVN BG и A1 BG спират услугите след 30 дни. Judith ви напомня предварително.",
  },
  UA: { ...CEE_BASE,
    cc: { label: "Штраф за прострочення платежу", sub: "ПриватБанк, Ощадбанк, Укрсиббанк — авт.", amount: 150 },
    telco: { label: "Плата за відновлення лінії", sub: "Kyivstar, Vodafone UA, lifecell", amount: 50 },
    utility: { label: "Плата за підключення електрики", sub: "Обленерго — після відключення", amount: 100 },
    heroBody: "Обленерго відключає світло на 30-й день. ПриватБанк автоматично нараховує штраф. Kyivstar блокує без попередження. Judith коштує менше за один штраф.",
    cutoffBody: "Обленерго, Kyivstar і Vodafone UA відключають послуги після 30 днів. Judith нагадує заздалегідь.",
  },
  RU: { ...CEE_BASE,
    cc: { label: "Неустойка по кредитной карте", sub: "Сбербанк, ВТБ, Тинькофф — автоматически", amount: 900 },
    telco: { label: "Плата за восстановление SIM", sub: "МТС, Билайн, МегаФон — после блокировки", amount: 300 },
    utility: { label: "Плата за восстановление света", sub: "Мосэнерго / местные — после отключения", amount: 500 },
    heroBody: "Мосэнерго отключает свет на 30-й день. Сбербанк списывает неустойку автоматически. МТС блокирует без предупреждения. Judith стоит меньше любого штрафа.",
    cutoffBody: "Энергокомпании, МТС и Билайн отключают услуги после 30 дней. Judith напоминает заранее.",
  },
  TR: { ...MIDDLE_EAST_BASE,
    cc: { label: "Kredi kartı gecikme faizi", sub: "Ziraat, İş Bankası, Garanti — otomatik", amount: 150 },
    telco: { label: "Hat askıya alma ücreti", sub: "Turkcell, Vodafone TR, Türk Telekom", amount: 50 },
    utility: { label: "TEDAŞ yeniden bağlantı ücreti", sub: "TEDAŞ — 30 gün gecikme sonrası", amount: 80 },
    heroBody: "TEDAŞ 30. gün akımı kesiyor. Ziraat Bankası otomatik kesinti uyguluyor. Turkcell uyarı vermeden hattı askıya alıyor. Judith herhangi bir ücretten daha ucuz.",
    cutoffBody: "TEDAŞ, Turkcell ve Vodafone TR 30 gün sonra hizmeti kesiyor. Judith önceden hatırlatır.",
  },

  /* ── Middle East & Africa ───────────────────────────────────────── */
  SA: { ...MIDDLE_EAST_BASE,
    cc: { label: "رسوم تأخر سداد البطاقة", sub: "البنك الأهلي، الراجحي، سامبا — تلقائي", amount: 100 },
    telco: { label: "رسوم إعادة تفعيل الخط", sub: "STC، موبايلي، زين — بعد الإيقاف", amount: 30 },
    utility: { label: "رسوم إعادة وصل الكهرباء", sub: "شركة الكهرباء — بعد 30 يوم تأخر", amount: 50 },
    heroBody: "شركة الكهرباء تقطع الخدمة في اليوم 30. البنك الأهلي يخصم الرسوم تلقائياً. STC يوقف خطك دون إشعار. Judith أرخص من أي رسوم.",
    cutoffBody: "شركة الكهرباء وSTC وموبايلي يقطعون الخدمة بعد 30 يوماً — تلقائياً. Judith تذكرك قبل ذلك.",
  },
  AE: { ...MIDDLE_EAST_BASE,
    cc: { label: "رسوم تأخر سداد البطاقة", sub: "ENBD، Abu Dhabi Bank، Mashreq — تلقائي", amount: 100 },
    telco: { label: "رسوم إعادة تفعيل الخط", sub: "Etisalat (e&)، du — بعد الإيقاف", amount: 30 },
    utility: { label: "رسوم إعادة وصل DEWA/ADDC", sub: "بعد 30 يوم تأخر في السداد", amount: 50 },
    heroBody: "DEWA تقطع الكهرباء في اليوم 30. ENBD يخصم الرسوم تلقائياً. Etisalat يوقف خطك دون إشعار. Judith أقل تكلفة من أي رسوم.",
    cutoffBody: "DEWA وDu وEtisalat يقطعون الخدمة بعد 30 يوماً تلقائياً. Judith تذكرك قبل ذلك.",
  },
  EG: { ...MIDDLE_EAST_BASE,
    cc: { label: "غرامة تأخر سداد البطاقة", sub: "البنك الأهلي، CIB، بنك مصر — تلقائي", amount: 50 },
    telco: { label: "رسوم إعادة تفعيل الخط", sub: "فودافون مصر، أورانج، WE — بعد الإيقاف", amount: 20 },
    utility: { label: "رسوم إعادة وصل الكهرباء", sub: "شركات الكهرباء — بعد 30 يوم تأخر", amount: 30 },
    heroBody: "شركة الكهرباء تقطع الخدمة في اليوم 30. CIB يخصم الغرامة تلقائياً. فودافون مصر يوقف الخط دون إشعار. Judith أرخص من أي غرامة.",
    cutoffBody: "شركات الكهرباء وفودافون مصر وأورانج يقطعون الخدمة بعد 30 يوماً. Judith تذكرك قبل ذلك.",
  },
  NG: { ...GENERIC,
    cc: { label: "Credit card late fee", sub: "First Bank, Zenith, GTBank — auto-charged", amount: 5_000 },
    telco: { label: "Mobile line reactivation", sub: "MTN, Airtel NG, Glo — after suspension", amount: 500 },
    utility: { label: "DISCO reconnection fee", sub: "EKEDC/IKEDC — after service interruption", amount: 1_000 },
    heroBody: "EKEDC disconnects at Day 30. First Bank charges ₦5,000 automatically. MTN suspends your line without notice. Judith costs less than any single fee.",
    cutoffBody: "EKEDC, IKEDC, MTN, and Airtel NG all cut service after 30 days. Judith nudges you before it reaches that point.",
  },
  ZA: { ...GENERIC,
    cc: { label: "Credit card late payment fee", sub: "Absa, Standard Bank, FNB — auto-charged", amount: 150 },
    telco: { label: "Mobile suspension fee", sub: "Vodacom, MTN SA, Cell C — after overdue", amount: 50 },
    utility: { label: "Eskom reconnection fee", sub: "Eskom / municipality — after disconnection", amount: 80 },
    heroBody: "Eskom disconnects at Day 30. Absa charges R150 automatically. Vodacom suspends your plan without warning. Judith costs less than any single charge.",
    cutoffBody: "Eskom, Vodacom, and MTN SA cut service after 30 days — without calling first. Judith nudges you days before it happens.",
  },
};

/** Returns localised paywall data for a country code, falling back to the generic copy. */
export function getPaywallLocale(countryCode: string): PaywallLocale {
  return LOCALES[countryCode] ?? GENERIC;
}

/** Format a local fee amount for display in the math card. */
export function fmtFee(cur: string, amount: number): string {
  return cur + amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
