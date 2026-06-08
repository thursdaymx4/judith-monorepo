/**
 * pregen-persona-samples.ts
 *
 * Pre-generates persona voice sample audio files for the Settings personality
 * picker and stores them in object storage (GCS) so tapping a persona card
 * plays instantly without a live ElevenLabs call.
 *
 * Scope:
 *   6 personas × 2 language groups (en + fil) = 12 files
 *   5 personas × 35 other language codes       = 175 files
 *   Total: 187 files (resumable — skips already-cached files)
 *
 * Run:
 *   pnpm --filter @workspace/api-server run pregen-persona-samples
 */

import { synthesize } from "../src/lib/elevenlabs.js";
import {
  DEFAULT_VOICE_IDS,
  FILIPINO_VOICE_IDS,
  getSpeakingSpeed,
  type PersonaId,
} from "../src/lib/personas.js";
import { setSampleAudio, hasSampleAudio } from "../src/lib/audioCache.js";

const ALL_PERSONAS: PersonaId[] = [
  "professional",
  "funny",
  "sarcastic",
  "mom",
  "marites",
  "britney",
];

// All personas are global — include all in every language group.
const BASE_PERSONAS: PersonaId[] = [
  "professional",
  "funny",
  "sarcastic",
  "mom",
  "marites",
  "britney",
];

const EN_TEXT: Record<PersonaId, string> = {
  professional:
    "I'm Judith — your due date assistant. I track every bill so you're never hit with a late fee again.",
  funny:
    "Hi! I'm Judith — basically your most financially responsible friend. You're welcome, by the way.",
  sarcastic:
    "Judith here. I remind you about your bills. Because apparently that's something someone has to do.",
  mom:
    "Hi there — I'm Judith. I'll keep an eye on all your bills for you. Don't worry, I've got everything covered.",
  marites:
    "Oh my gosh, hi! It's Judith! I literally know everything about your bills — and trust me, we need to talk!",
  britney:
    "Judith. Bills, amounts, due dates — tracked. Pay them on time. That's the deal.",
};

const FIL_TEXT: Record<PersonaId, string> = {
  professional:
    "Si Judith 'to. Bantayan ko ang lahat ng due dates mo — wala kang mapapala sa late fees, so ayusin natin 'yan.",
  funny:
    "Uy! Si Judith — 'yung pinaka-responsible mong kaibigan pagdating sa bills. Hindi ka na late, promise. Mostly.",
  sarcastic:
    "Si Judith 'to. Oo, nagpapa-alaala ako ng bills mo. Kasi ikaw? Ikaw talaga. Sige, tara na.",
  mom:
    "Anak, si Judith 'to. Nandito na ako, 'wag kang mag-alala. Bantayan ko ang mga bayarin mo — walang makakalusot sa akin, ha.",
  marites:
    "Besh, chismis muna! Si Judith 'to — at alam ko na lahat ng bills mo! Grabe, 'di ba? Wala kang makakalimutan, promise. Mag-update ka ha!",
  britney:
    "Judith. Bills mo, due dates, amounts — naka-track na lahat. 'Yun lang.",
};

type BasePersonaText = Record<"professional" | "funny" | "sarcastic" | "mom" | "marites", string>;

const OTHER_LANG_TEXT: Record<string, BasePersonaText> = {
  es: {
    professional:
      "Soy Judith, tu asistente de fechas de vencimiento. Me encargo de que nunca te pille por sorpresa una mora.",
    funny:
      "¡Hola! Soy Judith — básicamente tu amiga más responsable con el dinero. De nada, por cierto.",
    sarcastic:
      "Judith aquí. Te recuerdo tus facturas. Porque al parecer alguien tiene que hacerlo.",
    mom: "Hola, soy Judith. Voy a vigilar todas tus facturas. No te preocupes, lo tengo todo bajo control.",
    marites:
      "¡Dios mío, hola! ¡Soy Judith! Literalmente sé todo sobre tus facturas — y tenemos que hablar.",
  },
  pt: {
    professional:
      "Sou a Judith, sua assistente de datas de vencimento. Cuido para que você nunca seja pega de surpresa por uma multa.",
    funny:
      "Oi! Sou a Judith — basicamente sua amiga mais responsável com dinheiro. De nada, aliás.",
    sarcastic:
      "Judith aqui. Te lembro das suas contas. Porque aparentemente alguém tem que fazer isso.",
    mom: "Oi, sou a Judith. Vou cuidar de todas as suas contas. Não se preocupe, tenho tudo sob controle.",
    marites:
      "Meu Deus, oi! Sou a Judith! Literalmente sei tudo sobre suas contas — e a gente precisa conversar.",
  },
  "pt-PT": {
    professional:
      "Sou a Judith, a tua assistente de datas de vencimento. Trato de que nunca sejas apanhada de surpresa por uma mora.",
    funny:
      "Olá! Sou a Judith — basicamente a tua amiga mais responsável a nível financeiro. De nada, por acaso.",
    sarcastic:
      "Judith aqui. Lembro-te das tuas faturas. Porque ao que parece alguém tem de o fazer.",
    mom: "Olá, sou a Judith. Vou vigiar todas as tuas faturas. Não te preocupes, tenho tudo sob controlo.",
    marites:
      "Meu Deus, olá! Sou a Judith! Literalmente sei tudo sobre as tuas faturas — e temos de falar.",
  },
  fr: {
    professional:
      "Je suis Judith, votre assistante de dates d'échéance. Je veille à ce que vous ne soyez jamais surpris par des pénalités de retard.",
    funny:
      "Bonjour! Je suis Judith — en gros votre amie la plus responsable côté finances. De rien, au passage.",
    sarcastic:
      "Judith ici. Je vous rappelle vos factures. Parce qu'apparemment quelqu'un doit le faire.",
    mom: "Bonjour, je suis Judith. Je vais surveiller toutes vos factures. Ne vous inquiétez pas, j'ai tout sous contrôle.",
    marites:
      "Mon Dieu, bonjour! C'est Judith! Je sais littéralement tout sur vos factures — et on doit vraiment parler.",
  },
  de: {
    professional:
      "Ich bin Judith, Ihre Fälligkeitsdaten-Assistentin. Ich sorge dafür, dass Sie nie von einem Zahlungsverzug überrascht werden.",
    funny:
      "Hi! Ich bin Judith — sozusagen Ihre finanziell verantwortungsvollste Freundin. Bitte sehr, übrigens.",
    sarcastic:
      "Judith hier. Ich erinnere Sie an Ihre Rechnungen. Weil das anscheinend jemand tun muss.",
    mom: "Hallo, ich bin Judith. Ich behalte all Ihre Rechnungen im Blick. Machen Sie sich keine Sorgen, ich habe alles unter Kontrolle.",
    marites:
      "Oh mein Gott, hallo! Ich bin Judith! Ich weiß buchstäblich alles über Ihre Rechnungen — und wir müssen reden.",
  },
  it: {
    professional:
      "Sono Judith, la tua assistente per le scadenze di pagamento. Mi assicuro che tu non venga mai colta di sorpresa da una mora.",
    funny:
      "Ciao! Sono Judith — praticamente la tua amica più responsabile con i soldi. Prego, tra l'altro.",
    sarcastic:
      "Qui Judith. Ti ricordo le tue bollette. Perché apparentemente qualcuno deve farlo.",
    mom: "Ciao, sono Judith. Terrò d'occhio tutte le tue bollette. Non preoccuparti, ho tutto sotto controllo.",
    marites:
      "Madonna, ciao! Sono Judith! Letteralmente so tutto delle tue bollette — e dobbiamo parlare.",
  },
  nl: {
    professional:
      "Ik ben Judith, uw assistent voor vervaldatums. Ik zorg ervoor dat u nooit verrast wordt door een late betaling.",
    funny:
      "Hoi! Ik ben Judith — eigenlijk uw meest financieel verantwoordelijke vriendin. Graag gedaan, trouwens.",
    sarcastic:
      "Judith hier. Ik herinner u aan uw rekeningen. Omdat dat blijkbaar iemand moet doen.",
    mom: "Hoi, ik ben Judith. Ik houd al uw rekeningen in de gaten. Maak u geen zorgen, ik heb alles onder controle.",
    marites:
      "Oh mijn god, hoi! Ik ben Judith! Ik weet letterlijk alles over uw rekeningen — en we moeten praten.",
  },
  pl: {
    professional:
      "Jestem Judith, twoją asystentką terminów płatności. Dbam o to, żebyś nigdy nie była zaskoczona opłatą za spóźnienie.",
    funny:
      "Cześć! Jestem Judith — w zasadzie twoja najbardziej odpowiedzialna finansowo przyjaciółka. Proszę bardzo, przy okazji.",
    sarcastic:
      "Judith tu. Przypominam ci o twoich rachunkach. Bo podobno ktoś musi to robić.",
    mom: "Cześć, jestem Judith. Będę pilnować wszystkich twoich rachunków. Nie martw się, mam wszystko pod kontrolą.",
    marites:
      "O Boże, cześć! Jestem Judith! Dosłownie wiem wszystko o twoich rachunkach — i musimy porozmawiać.",
  },
  sv: {
    professional:
      "Jag är Judith, din assistent för förfallodatum. Jag ser till att du aldrig överraskas av en förseningsavgift.",
    funny:
      "Hej! Jag är Judith — i princip din mest ekonomiskt ansvarsfulla vän. Varsågod, förresten.",
    sarcastic:
      "Judith här. Jag påminner dig om dina räkningar. För tydligen måste någon göra det.",
    mom: "Hej, jag är Judith. Jag håller koll på alla dina räkningar. Oroa dig inte, jag har allt under kontroll.",
    marites:
      "Åh vad kul, hej! Det är Judith! Jag vet bokstavligen allt om dina räkningar — och vi måste prata.",
  },
  da: {
    professional:
      "Jeg er Judith, din assistent for forfaldsdatoer. Jeg sørger for, at du aldrig overraskes af et gebyr for forsinket betaling.",
    funny:
      "Hej! Jeg er Judith — dybest set din mest økonom-ansvarlige veninde. Selv tak, i øvrigt.",
    sarcastic:
      "Judith her. Jeg minder dig om dine regninger. Fordi nogen åbenbart er nødt til det.",
    mom: "Hej, jeg er Judith. Jeg holder øje med alle dine regninger. Bekymr dig ikke, jeg har styr på det hele.",
    marites:
      "Åh gud, hej! Det er Judith! Jeg ved bogstaveligt talt alt om dine regninger — og vi er nødt til at tale.",
  },
  no: {
    professional:
      "Jeg er Judith, din assistent for forfallsdatoer. Jeg sørger for at du aldri overraskes av et gebyr for forsinket betaling.",
    funny:
      "Hei! Jeg er Judith — i bunn og grunn din mest økonomisk ansvarlige venn. Vær så god, forresten.",
    sarcastic:
      "Judith her. Jeg minner deg på regningene dine. For tilsynelatende må noen gjøre det.",
    mom: "Hei, jeg er Judith. Jeg holder øye med alle regningene dine. Ikke bekymre deg, jeg har alt under kontroll.",
    marites:
      "Å Gud, hei! Det er Judith! Jeg vet bokstavelig talt alt om regningene dine — og vi må snakke.",
  },
  fi: {
    professional:
      "Olen Judith, eräpäiväavustajasi. Huolehdin siitä, että sinulle ei tule koskaan yllätyksenä myöhästymismaksu.",
    funny:
      "Hei! Olen Judith — käytännössä taloudellisin vastuullisin ystäväsi. Ole hyvä, muuten.",
    sarcastic:
      "Judith täällä. Muistutan sinua laskuistasi. Koska ilmeisesti jonkun täytyy tehdä se.",
    mom: "Hei, olen Judith. Pidän silmällä kaikkia laskujasi. Älä huoli, minulla on kaikki hallinnassa.",
    marites:
      "Voi Luoja, hei! Judith täällä! Tiedän kirjaimellisesti kaiken laskuistasi — ja meidän täytyy puhua.",
  },
  cs: {
    professional:
      "Jsem Judith, vaše asistentka pro termíny splatnosti. Starám se o to, abyste nikdy nebyla překvapena poplatkem za pozdní platbu.",
    funny:
      "Ahoj! Jsem Judith — v podstatě vaše nejfinančně odpovědnější kamarádka. Prosím, mimochodem.",
    sarcastic:
      "Judith tady. Připomínám vám vaše účty. Protože to zjevně musí někdo dělat.",
    mom: "Ahoj, jsem Judith. Budu hlídat všechny vaše účty. Nebojte se, mám vše pod kontrolou.",
    marites:
      "Bože, ahoj! Jsem Judith! Doslova vím vše o vašich účtech — a musíme si promluvit.",
  },
  sk: {
    professional:
      "Som Judith, vaša asistentka pre termíny splatnosti. Starám sa o to, aby vás nikdy neprekvapil poplatok za oneskorenú platbu.",
    funny:
      "Ahoj! Som Judith — v podstate vaša najfinančne zodpovednejšia kamarátka. Prosím, mimochodom.",
    sarcastic:
      "Judith tu. Pripomínam vám vaše účty. Pretože to zjavne musí niekto robiť.",
    mom: "Ahoj, som Judith. Budem strážiť všetky vaše účty. Nebojte sa, mám všetko pod kontrolou.",
    marites:
      "Bože, ahoj! Som Judith! Doslova viem všetko o vašich účtoch — a musíme sa porozprávať.",
  },
  ro: {
    professional:
      "Sunt Judith, asistenta ta pentru termenele de plată. Mă asigur că nu ești niciodată surprinsă de o penalitate de întârziere.",
    funny:
      "Bună! Sunt Judith — practic prietena ta cea mai responsabilă financiar. Cu plăcere, apropo.",
    sarcastic:
      "Judith aici. Îți amintesc de facturile tale. Pentru că aparent cineva trebuie să o facă.",
    mom: "Bună, sunt Judith. Voi ține un ochi pe toate facturile tale. Nu te îngrijora, am totul sub control.",
    marites:
      "Doamne, bună! Sunt Judith! Știu literalmente totul despre facturile tale — și trebuie să vorbim.",
  },
  bg: {
    professional:
      "Аз съм Джудит, вашият асистент за падежи на плащане. Грижа се да не бъдете никога изненадана от такса за закъснение.",
    funny:
      "Здравей! Аз съм Джудит — на практика най-финансово отговорната ти приятелка. Моля, между другото.",
    sarcastic:
      "Джудит тук. Напомням ти за сметките ти. Защото очевидно някой трябва да го прави.",
    mom: "Здравей, аз съм Джудит. Ще следя всичките ти сметки. Не се притеснявай, имам всичко под контрол.",
    marites:
      "Боже мой, здравей! Аз съм Джудит! Буквално знам всичко за сметките ти — и трябва да поговорим.",
  },
  hr: {
    professional:
      "Ja sam Judith, vaša asistentka za rokove plaćanja. Brinem se da vas nikada ne iznenadi naknada za kašnjenje.",
    funny:
      "Bok! Ja sam Judith — u biti vaša najfinancijski odgovornija prijateljica. Nema na čemu, usput.",
    sarcastic:
      "Judith ovdje. Podsjećam vas na vaše račune. Jer očito netko to mora raditi.",
    mom: "Bok, ja sam Judith. Pazit ću na sve vaše račune. Ne brinite, sve imam pod kontrolom.",
    marites:
      "Bože moj, bok! Ja sam Judith! Doslovno znam sve o vašim računima — i moramo razgovarati.",
  },
  el: {
    professional:
      "Είμαι η Τζούντιθ, η βοηθός σου για τις ημερομηνίες λήξης. Φροντίζω να μην σε εκπλήσσει ποτέ μια χρέωση καθυστέρησης.",
    funny:
      "Γεια! Είμαι η Τζούντιθ — ουσιαστικά η πιο οικονομικά υπεύθυνη φίλη σου. Παρακαλώ, παρεμπιπτόντως.",
    sarcastic:
      "Τζούντιθ εδώ. Σου θυμίζω τους λογαριασμούς σου. Επειδή προφανώς κάποιος πρέπει να το κάνει.",
    mom: "Γεια, είμαι η Τζούντιθ. Θα παρακολουθώ όλους τους λογαριασμούς σου. Μην ανησυχείς, τα έχω όλα υπό έλεγχο.",
    marites:
      "Θεέ μου, γεια! Είμαι η Τζούντιθ! Ξέρω κυριολεκτικά τα πάντα για τους λογαριασμούς σου — και πρέπει να μιλήσουμε.",
  },
  hu: {
    professional:
      "Judith vagyok, a fizetési határidő-asszisztensed. Gondoskodom arról, hogy soha ne lepjen meg késedelmi díj.",
    funny:
      "Szia! Judith vagyok — lényegében a legjobban pénzügyileg felelős barátod. Szívesen, egyébként.",
    sarcastic:
      "Judith itt. Emlékeztetlek a számláidra. Mert nyilván valakinek meg kell tennie.",
    mom: "Szia, Judith vagyok. Szemmel tartom az összes számládat. Ne aggódj, mindent kézben tartok.",
    marites:
      "Istenem, szia! Judith vagyok! Szó szerint mindent tudok a számláidról — és beszélnünk kell.",
  },
  uk: {
    professional:
      "Я Джудіт, ваш помічник з термінів платежів. Стежу за тим, щоб вас ніколи не застав зненацька штраф за прострочення.",
    funny:
      "Привіт! Я Джудіт — по суті ваша найбільш фінансово відповідальна подруга. Будь ласка, до речі.",
    sarcastic:
      "Джудіт тут. Нагадую вам про ваші рахунки. Бо очевидно хтось це має робити.",
    mom: "Привіт, я Джудіт. Буду стежити за всіма вашими рахунками. Не хвилюйтеся, у мене все під контролем.",
    marites:
      "Боже мій, привіт! Я Джудіт! Буквально знаю все про ваші рахунки — і нам потрібно поговорити.",
  },
  ru: {
    professional:
      "Я Джудит, ваш помощник по срокам платежей. Слежу за тем, чтобы вас никогда не застали врасплох просроченные платежи.",
    funny:
      "Привет! Я Джудит — по сути ваша самая финансово ответственная подруга. Пожалуйста, кстати.",
    sarcastic:
      "Джудит здесь. Напоминаю вам о ваших счетах. Потому что очевидно кто-то должен это делать.",
    mom: "Привет, я Джудит. Буду следить за всеми вашими счетами. Не беспокойтесь, у меня всё под контролем.",
    marites:
      "Боже мой, привет! Я Джудит! Буквально знаю всё о ваших счетах — и нам нужно поговорить.",
  },
  tr: {
    professional:
      "Ben Judith, vade tarihi asistanınım. Asla geç ödeme ücreti sürpriziyle karşılaşmamanızı sağlıyorum.",
    funny:
      "Merhaba! Ben Judith — temelde en mali sorumlu arkadaşınız. Rica ederim, bu arada.",
    sarcastic:
      "Judith burada. Faturalarınızı hatırlatıyorum. Çünkü bunu birinin yapması gerekiyor.",
    mom: "Merhaba, ben Judith. Tüm faturalarınıza göz kulak olacağım. Merak etmeyin, her şey kontrol altında.",
    marites:
      "Tanrım, merhaba! Ben Judith! Faturalarınız hakkında kelimenin tam anlamıyla her şeyi biliyorum — ve konuşmamız gerek.",
  },
  ar: {
    professional:
      "أنا جوديث، مساعدتك لمواعيد الاستحقاق. أحرص على ألا تُفاجئك رسوم التأخير أبداً.",
    funny:
      "مرحباً! أنا جوديث — بالأساس صديقتك الأكثر مسؤولية مالياً. عفواً، بالمناسبة.",
    sarcastic:
      "جوديث هنا. أذكّرك بفواتيرك. لأن أحداً ما يجب أن يفعل ذلك.",
    mom: "مرحباً، أنا جوديث. سأتابع جميع فواتيرك. لا تقلقي، أنا أتحكم في كل شيء.",
    marites:
      "يا إلهي، مرحباً! أنا جوديث! أعرف حرفياً كل شيء عن فواتيرك — وعلينا أن نتحدث.",
  },
  arz: {
    professional:
      "أنا جوديث، المساعدة بتاعتك لمواعيد الاستحقاق. بتأكد إنك متتفاجئيش بمصاريف التأخير أبداً.",
    funny:
      "أهلاً! أنا جوديث — أساساً صاحبتك الأكثر مسؤولية مالياً. على إيه، بالمناسبة.",
    sarcastic:
      "جوديث هنا. بفكّرك بفواتيرك. لأن حد لازم يعمل كده.",
    mom: "أهلاً، أنا جوديث. هتابع كل فواتيرك. متقلقيش، أنا مسيطرة على كل حاجة.",
    marites:
      "يا سلام، أهلاً! أنا جوديث! بعرف حرفياً كل حاجة عن فواتيرك — ولازم نتكلم.",
  },
  apc: {
    professional:
      "أنا جوديث، مساعدتك لمواعيد الاستحقاق. بحرص إنك ما تتفاجئي بغرامات التأخير أبداً.",
    funny:
      "مرحبا! أنا جوديث — بالأساس رفيقتك الأكثر مسؤولية مالياً. عفواً، بالمناسبة.",
    sarcastic:
      "جوديث هون. عم بذكّرك بفواتيرك. لأنه واضح في حدا لازم يعمل هيك.",
    mom: "مرحبا، أنا جوديث. رح تابع كل فواتيرك. ما تقلقي، عندي كل شي تحت السيطرة.",
    marites:
      "يا إلهي، مرحبا! أنا جوديث! بعرف حرفياً كل شي عن فواتيرك — ولازم نحكي.",
  },
  afb: {
    professional:
      "أنا جوديث، مساعدتك لمواعيد الاستحقاق. أضمن ما تتفاجئين من رسوم التأخير أبداً.",
    funny:
      "هلا! أنا جوديث — بالأساس صديقتك الأكثر مسؤولية مالياً. عفواً، بالمناسبة.",
    sarcastic:
      "جوديث هني. أذكّرك بفواتيرك. لأنه واضح في أحد لازم يسوي هذا.",
    mom: "هلا، أنا جوديث. راح أتابع جميع فواتيرك. لا تقلقين، كل شي تحت السيطرة.",
    marites:
      "يا الله، هلا! أنا جوديث! أعرف حرفياً كل شي عن فواتيرك — ولازم نتكلم.",
  },
  hi: {
    professional:
      "मैं जूडिथ हूँ, आपकी देय तिथि सहायक। मैं सुनिश्चित करती हूँ कि आप कभी भी विलंब शुल्क से चौंके नहीं।",
    funny:
      "नमस्ते! मैं जूडिथ हूँ — basically आपकी सबसे financially जिम्मेदार दोस्त। वैसे, शुक्रिया।",
    sarcastic:
      "जूडिथ यहाँ। आपको बिलों की याद दिला रही हूँ। क्योंकि जाहिर है कोई तो यह करेगा।",
    mom: "नमस्ते, मैं जूडिथ हूँ। मैं आपके सभी बिलों पर नज़र रखूँगी। चिंता मत करो, सब कुछ मेरे हाथ में है।",
    marites:
      "भगवान, नमस्ते! मैं जूडिथ हूँ! मुझे आपके सभी बिलों के बारे में सच में सब कुछ पता है — और हमें बात करनी होगी।",
  },
  ta: {
    professional:
      "நான் ஜூடித், உங்கள் தவணை தேதி உதவியாளர். நீங்கள் தாமதக் கட்டணத்தால் ஒருபோதும் அதிர்ச்சியடையாமல் பார்த்துக்கொள்கிறேன்.",
    funny:
      "வணக்கம்! நான் ஜூடித் — basically உங்கள் மிகவும் நிதி பொறுப்பான தோழி. நன்றி சொல்ல வேண்டாம்!",
    sarcastic:
      "ஜூடித் இங்கே. உங்கள் கட்டணங்களை நினைவூட்டுகிறேன். ஏனெனில் யாராவது செய்ய வேண்டும்.",
    mom: "வணக்கம், நான் ஜூடித். உங்கள் அனைத்து கட்டணங்களையும் கவனிப்பேன். கவலைப்படாதீர்கள், எல்லாம் என் கட்டுப்பாட்டில் உள்ளது.",
    marites:
      "ஐயோ, வணக்கம்! நான் ஜூடித்! உங்கள் கட்டணங்களைப் பற்றி எல்லாம் தெரியும் — நாம் பேசவேண்டும்.",
  },
  ja: {
    professional:
      "ジュディスです。お支払い期日のアシスタントとして、延滞料金で驚かされることがないよう管理します。",
    funny:
      "こんにちは！ジュディスです — 基本的に、あなたの一番お金に責任感のある友達です。どういたしまして、ちなみに。",
    sarcastic:
      "ジュディスです。請求書を思い出させます。誰かがやらないといけないので。",
    mom: "こんにちは、ジュディスです。あなたの請求書をすべて見守ります。心配しないで、全部任せてください。",
    marites:
      "えー、こんにちは！ジュディスです！あなたの請求書について本当に全部知ってますよ — ちょっとお話しましょう！",
  },
  ko: {
    professional:
      "저는 주디스예요, 납부일 도우미입니다. 연체료에 절대 놀라지 않도록 챙겨드릴게요.",
    funny:
      "안녕하세요! 저는 주디스 — 기본적으로 당신의 가장 재정적으로 책임감 있는 친구예요. 천만에요, 참고로.",
    sarcastic:
      "주디스입니다. 청구서를 알려드리겠습니다. 누군가는 해야 하니까요.",
    mom: "안녕하세요, 주디스예요. 모든 청구서를 다 챙겨드릴게요. 걱정 마세요, 다 제가 알아서 할게요.",
    marites:
      "어머, 안녕하세요! 주디스예요! 청구서 관련해서 진짜 다 알고 있어요 — 우리 얘기 좀 해야 해요.",
  },
  zh: {
    professional:
      "我是茱迪丝，您的账单到期日助手。我会确保您永远不会被滞纳金所惊到。",
    funny:
      "你好！我是茱迪丝 — 基本上是您最有财务责任感的朋友。不客气，顺便一提。",
    sarcastic:
      "茱迪丝在这里。提醒您缴费。因为显然得有人来做这件事。",
    mom: "你好，我是茱迪丝。我会帮您盯着所有账单。别担心，一切尽在掌握之中。",
    marites:
      "天哪，你好！我是茱迪丝！我真的什么账单都知道 — 我们得好好聊聊。",
  },
  yue: {
    professional:
      "我係茱迪絲，你嘅賬單到期日助手。我會確保你永遠唔會俾滯納金嚇親。",
    funny:
      "你好！我係茱迪絲 — 基本上係你最有財務責任感嘅朋友。唔使客氣，順帶一提。",
    sarcastic:
      "茱迪絲喺度。提醒你交費。因為顯然要有人做呢件事。",
    mom: "你好，我係茱迪絲。我會幫你盯住所有賬單。唔使擔心，一切盡在掌握之中。",
    marites:
      "天啊，你好！我係茱迪絲！我真係知道你所有嘅賬單 — 我哋要好好傾吓。",
  },
  id: {
    professional:
      "Aku Judith, asisten tanggal jatuh tempo kamu. Aku memastikan kamu tidak pernah terkejut dengan denda keterlambatan.",
    funny:
      "Halo! Aku Judith — pada dasarnya teman paling bertanggung jawab secara finansial kamu. Sama-sama, omong-omong.",
    sarcastic:
      "Judith di sini. Aku mengingatkan kamu soal tagihan. Karena jelas seseorang harus melakukannya.",
    mom: "Halo, aku Judith. Aku akan mengawasi semua tagihan kamu. Jangan khawatir, semuanya sudah aku tangani.",
    marites:
      "Ya ampun, halo! Ini Judith! Aku benar-benar tahu semua tentang tagihan kamu — dan kita harus ngobrol.",
  },
  ms: {
    professional:
      "Saya Judith, pembantu tarikh matang anda. Saya memastikan anda tidak pernah terkejut dengan caj lewat bayar.",
    funny:
      "Hai! Saya Judith — pada dasarnya rakan paling bertanggungjawab dari segi kewangan bagi anda. Sama-sama, by the way.",
    sarcastic:
      "Judith di sini. Saya mengingatkan anda tentang bil. Kerana jelas seseorang perlu melakukannya.",
    mom: "Hai, saya Judith. Saya akan memantau semua bil anda. Jangan risau, saya ada segalanya di bawah kawalan.",
    marites:
      "Ya Allah, hai! Ini Judith! Saya tahu betul-betul semua tentang bil anda — dan kita perlu bercakap.",
  },
  vi: {
    professional:
      "Tôi là Judith, trợ lý ngày đáo hạn của bạn. Tôi đảm bảo bạn không bao giờ bị bất ngờ vì phí trễ hạn.",
    funny:
      "Chào! Tôi là Judith — về cơ bản là người bạn có trách nhiệm tài chính nhất của bạn. Không có chi, nhân tiện.",
    sarcastic:
      "Judith đây. Tôi nhắc bạn về các hóa đơn. Vì rõ ràng ai đó phải làm điều đó.",
    mom: "Chào, tôi là Judith. Tôi sẽ theo dõi tất cả hóa đơn của bạn. Đừng lo, tôi kiểm soát mọi thứ.",
    marites:
      "Trời ơi, chào! Là Judith đây! Tôi biết mọi thứ về hóa đơn của bạn đó — và chúng ta cần nói chuyện.",
  },
  th: {
    professional:
      "ฉันคือจูดิธ ผู้ช่วยด้านวันครบกำหนดชำระของคุณ ฉันดูแลให้คุณไม่ต้องเซอร์ไพรส์กับค่าปรับล่าช้าเลย",
    funny:
      "สวัสดี! ฉันคือจูดิธ — โดยพื้นฐานแล้วเพื่อนที่มีความรับผิดชอบทางการเงินมากที่สุดของคุณ ยินดีค่ะ",
    sarcastic:
      "จูดิธที่นี่ ฉันเตือนคุณเรื่องบิล เพราะดูเหมือนว่าใครสักคนต้องทำ",
    mom: "สวัสดี ฉันคือจูดิธ ฉันจะดูแลบิลทั้งหมดของคุณ ไม่ต้องกังวล ฉันควบคุมทุกอย่างได้",
    marites:
      "โอ้โห สวัสดี! จูดิธนี่แหละ! ฉันรู้ทุกอย่างเกี่ยวกับบิลของคุณเลย — และเราต้องคุยกัน",
  },
};

let generated = 0;
let skipped = 0;

console.log("── EN + FIL ─────────────────────────────────");

for (const persona of ALL_PERSONAS) {
  for (const { key, label, getText, getVoiceId } of [
    { key: "en" as const, label: "EN", getText: (p: PersonaId) => EN_TEXT[p], getVoiceId: (p: PersonaId) => DEFAULT_VOICE_IDS[p] },
    { key: "fil" as const, label: "FIL", getText: (p: PersonaId) => FIL_TEXT[p], getVoiceId: (p: PersonaId) => FILIPINO_VOICE_IDS[p] },
  ]) {
    const already = await hasSampleAudio(persona, key);
    if (already) {
      console.log(`· ${persona}/${label} (cached)`);
      skipped++;
      continue;
    }
    try {
      const audio = await synthesize(getText(persona), getVoiceId(persona), {
        live: false,
        speed: getSpeakingSpeed(persona),
      });
      await setSampleAudio(persona, key, audio.base64);
      console.log(`✓ ${persona}/${label}`);
      generated++;
    } catch (err) {
      console.error(`✗ ${persona}/${label}:`, err);
    }
  }
}

console.log("\n── Other languages ──────────────────────────");

for (const [langCode, lines] of Object.entries(OTHER_LANG_TEXT)) {
  for (const persona of BASE_PERSONAS) {
    const already = await hasSampleAudio(persona, langCode);
    if (already) {
      console.log(`· ${persona}/${langCode} (cached)`);
      skipped++;
      continue;
    }
    try {
      // Britney has no translated lines — she speaks English regardless of locale.
      // This matches getSampleText()'s fallback to SAMPLE_LINES_EN for britney.
      const text = persona === "britney" ? EN_TEXT.britney : lines[persona as keyof BasePersonaText];
      const voiceId = DEFAULT_VOICE_IDS[persona];
      const audio = await synthesize(text, voiceId, {
        live: false,
        speed: getSpeakingSpeed(persona),
      });
      await setSampleAudio(persona, langCode, audio.base64);
      console.log(`✓ ${persona}/${langCode}`);
      generated++;
    } catch (err) {
      console.error(`✗ ${persona}/${langCode}:`, err);
    }
  }
}

console.log(`\nDone — ${generated} generated, ${skipped} already cached.`);
