import { useRef, useState, useCallback } from "react";
import {
  CreditCard,
  Bell,
  CalendarDays,
  LayoutGrid,
  Watch,
  Mic,
  Split,
  Infinity as InfinityIcon,
  Check,
  Sparkles,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Square,
  Loader2,
} from "lucide-react";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { Reveal } from "@/components/site/Reveal";
import { AppStoreBadge } from "@/components/site/AppStoreBadge";

const ASKS = [
  "How much do I still owe this month?",
  "What's due before rent day?",
  "What are all my cards and loans, in total?",
  "What am I actually paying for in subscriptions?",
  "How much of this is business vs personal?",
];

const SUBSCRIPTIONS = [
  "Netflix",
  "Spotify",
  "Apple Music",
  "Claude",
  "Canva",
  "+ a few you forgot",
];

const FEATURES = [
  {
    icon: CreditCard,
    title: "Track unlimited bills",
    body: "Cards, banks, loans, utilities, insurance, subscriptions — all in one place.",
  },
  {
    icon: Split,
    title: "Personal vs business",
    body: "Tag each bill and see clean, instant splits. Know what's yours and what's the company's.",
  },
  {
    icon: Bell,
    title: "Smart reminders",
    body: "A nudge before every due date, so a late charge never surprises you again.",
  },
  {
    icon: CalendarDays,
    title: "Monthly calendar",
    body: "A clear view of what's due and what's already paid, across the whole month.",
  },
  {
    icon: Mic,
    title: "Five warm personas",
    body: "Pick the voice that feels right — from gentle and professional to brutally honest.",
  },
  {
    icon: LayoutGrid,
    title: "Home Screen widgets",
    body: "Your next due date and total, one glance away — no app to open.",
  },
  {
    icon: Watch,
    title: "Apple Watch app",
    body: "Ask and check on the go. Glance at your wrist before you spend.",
  },
  {
    icon: InfinityIcon,
    title: "Answers in seconds",
    body: "Plain-language replies — by voice or by text, in seconds.",
  },
];

const SCREENSHOTS = [
  { file: "01-home.png", label: "Your month, handled" },
  { file: "02-calendar.png", label: "Plan ahead" },
  { file: "03-insights.png", label: "Work & life, split" },
  { file: "04-ask.png", label: "Go on, ask" },
  { file: "05-upcoming.png", label: "Nothing slips" },
  { file: "06-darkmode.png", label: "Night owl?" },
  { file: "07-watch.png", label: "On your wrist" },
  { file: "08-personality.png", label: "She's got personality" },
  { file: "widgets.png", label: "Always in view", wide: true },
];

const VOICE_CAPS = [
  { title: "What's due", body: "This week, before rent day, by category — any timeframe." },
  { title: "How much you owe", body: "Monthly total, remaining unpaid, or split by cards and utilities." },
  { title: "Paid or not?", body: "Ask about any bill and get a straight yes or no." },
  { title: "What's coming next month", body: "Estimated total based on everything already tracked." },
  { title: "Add bills by voice", body: "Say the provider, amount, and due date. No typing." },
  { title: "Answers spoken aloud", body: "Voice Ask reads the reply back — hands-free, eyes-free." },
];

const EXAMPLE_ASKS = [
  { q: "Did I pay my credit card this month?", a: "Your Chase Sapphire looks unpaid — $85 minimum due on the 22nd. The full statement balance is $1,240." },
  { q: "Which bill should I worry about first?" },
  { q: "What's coming up next week?" },
  { q: "How much is left after all my bills?" },
  { q: "Can I afford a vacation next month?" },
];

const WATCH_CAPS = [
  "See upcoming and overdue bills at a glance",
  "Mark bills as paid right from your wrist",
  "Ask Judith by voice, Scribble, or keyboard",
  "Get bill reminders as Watch notifications",
  "Use complications for glanceable bill status",
  "Answers sent from iPhone, shown on Watch",
];

const DICEBEAR_BASE =
  "https://api.dicebear.com/9.x/micah/svg?seed=Amaya&radius=50&backgroundType=gradientLinear";

function avatarUrl(bg: string, params: string) {
  return `${DICEBEAR_BASE}&backgroundColor=${bg}&${params}`;
}

const PERSONAS_SITE = [
  {
    id: "professional",
    name: "Professional Peer",
    vibe: "Clear · calm",
    line: "Every due date, tracked. Clear, on time — nothing slips through.",
    border: "border-accent/35",
    shadow: "hover:shadow-[0_0_32px_-8px_rgba(41,213,165,0.25)]",
    avatar: avatarUrl(
      "d1d4f9,b6e3f4",
      "mouth=smile&glasses=square&glassesProbability=100&shirt=collared&shirtColor=6690cc",
    ),
  },
  {
    id: "funny",
    name: "Funny Friend",
    vibe: "Warm · playful",
    line: "No more 'wait, that was due WHEN?' moments. I've got your back.",
    border: "border-yellow-400/35",
    shadow: "hover:shadow-[0_0_32px_-8px_rgba(250,204,21,0.25)]",
    avatar: avatarUrl(
      "ffdfbf,ffd5dc",
      "mouth=laughing&eyes=smiling&shirt=crew&shirtColor=ff8a5b&glassesProbability=0",
    ),
  },
  {
    id: "sarcastic",
    name: "Sarcastic Sibling",
    vibe: "Cheeky · blunt",
    line: "Your bills are handled. You're welcome — I know you'd have forgotten.",
    border: "border-orange-400/35",
    shadow: "hover:shadow-[0_0_32px_-8px_rgba(251,146,60,0.25)]",
    avatar: avatarUrl(
      "b8e6dd,b6e3f4",
      "mouth=smirk&eyes=eyesShadow&eyebrows=up&shirt=open&shirtColor=2fb39b&glassesProbability=0",
    ),
  },
  {
    id: "mom",
    name: "Your Mom",
    vibe: "Caring · a little naggy",
    line: "Don't worry about the bills — I've got it. Now go eat something, please.",
    border: "border-pink-400/35",
    shadow: "hover:shadow-[0_0_32px_-8px_rgba(244,114,182,0.25)]",
    avatar: avatarUrl(
      "ffd5dc,f3d1e6",
      "mouth=smile&glasses=round&glassesProbability=100&hairColor=b7b7b7&shirt=collared&shirtColor=c77dab",
    ),
  },
  {
    id: "marites",
    name: "Perky Pal",
    vibe: "Perky · gossip-y",
    line: "I know everything about your bills — and I will never let you forget them!",
    border: "border-violet-400/35",
    shadow: "hover:shadow-[0_0_32px_-8px_rgba(167,139,250,0.25)]",
    avatar: avatarUrl(
      "fce7f3,f9a8d4",
      "mouth=surprised&eyes=round&eyebrows=eyelashesUp&shirt=open&shirtColor=7c3aed&hairColor=db2777&glassesProbability=0",
    ),
  },
  {
    id: "britney",
    name: "Brutal Britney",
    vibe: "Honest · brutal",
    line: "Bills. Due dates. Amounts. I track them. You pay them. That's it.",
    border: "border-red-400/35",
    shadow: "hover:shadow-[0_0_32px_-8px_rgba(248,113,113,0.25)]",
    avatar: avatarUrl(
      "94a3b8,1e293b",
      "mouth=pucker&eyes=eyesShadow&eyebrows=up&shirt=collared&shirtColor=374151&glassesProbability=0",
    ),
  },
];

const LANG_ROW_A = [
  { flag: "🇺🇸", name: "English" },
  { flag: "🇪🇸", name: "Español" },
  { flag: "🇫🇷", name: "Français" },
  { flag: "🇩🇪", name: "Deutsch" },
  { flag: "🇮🇹", name: "Italiano" },
  { flag: "🇵🇹", name: "Português" },
  { flag: "🇳🇱", name: "Nederlands" },
  { flag: "🇵🇱", name: "Polski" },
  { flag: "🇷🇺", name: "Русский" },
  { flag: "🇺🇦", name: "Українська" },
  { flag: "🇹🇷", name: "Türkçe" },
  { flag: "🇸🇦", name: "العربية" },
  { flag: "🇯🇵", name: "日本語" },
  { flag: "🇰🇷", name: "한국어" },
  { flag: "🇨🇳", name: "中文" },
  { flag: "🇭🇰", name: "粵語" },
  { flag: "🇮🇳", name: "हिन्दी" },
  { flag: "🇰🇪", name: "Swahili" },
];
const LANG_ROW_B = [
  { flag: "🇱🇰", name: "தமிழ்" },
  { flag: "🇮🇩", name: "Bahasa Indonesia" },
  { flag: "🇲🇾", name: "Bahasa Melayu" },
  { flag: "🇻🇳", name: "Tiếng Việt" },
  { flag: "🇹🇭", name: "ภาษาไทย" },
  { flag: "🇸🇪", name: "Svenska" },
  { flag: "🇩🇰", name: "Dansk" },
  { flag: "🇳🇴", name: "Norsk" },
  { flag: "🇫🇮", name: "Suomi" },
  { flag: "🇨🇿", name: "Čeština" },
  { flag: "🇸🇰", name: "Slovenčina" },
  { flag: "🇷🇴", name: "Română" },
  { flag: "🇧🇬", name: "Български" },
  { flag: "🇭🇷", name: "Hrvatski" },
  { flag: "🇬🇷", name: "Ελληνικά" },
  { flag: "🇭🇺", name: "Magyar" },
];

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <Nav />
      <Hero />
      <GlanceOrAsk />
      <Personas />
      <Languages />
      <Testimonial />
      <Screenshots />
      <ALot />
      <Autopay />
      <RealLife />
      <Features />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}

/* ---------------------------------------------------------------- HERO */
function Hero() {
  return (
    <section className="relative px-5 pb-24 pt-36 sm:pt-44">
      <div className="bloom -left-40 top-10 h-[460px] w-[460px] bg-accent/25" />
      <div className="bloom right-0 top-40 h-[380px] w-[380px] bg-violet/15" />
      <div className="grain absolute inset-0 opacity-60" />

      <div className="relative mx-auto max-w-4xl text-center">
        <Reveal eager>
          <span className="inline-flex items-center gap-2 rounded-full border border-hair bg-surface-1/60 px-4 py-1.5 text-[12px] font-medium uppercase tracking-[0.18em] text-txt-mid backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Voice-first bill tracker
          </span>
        </Reveal>

        <Reveal eager delay={0.05}>
          <h1 className="mt-7 text-balance text-[40px] leading-[1.05] tracking-tight text-txt-hi sm:text-[64px]">
            Do you actually know how much you{" "}
            <span className="font-display text-mint-grad">still need to pay</span>?
          </h1>
        </Reveal>

        <Reveal eager delay={0.12}>
          <p className="mx-auto mt-7 max-w-2xl text-balance text-[17px] leading-relaxed text-txt-mid sm:text-[19px]">
            Across every card, every bank, every loan. Most people can't — the
            numbers live in different apps and the back of your mind. Judith
            keeps them in one place. The moment you wonder where you stand, you
            just ask.
          </p>
        </Reveal>

        <Reveal eager delay={0.2}>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <AppStoreBadge />
            <a
              href="#ask"
              className="inline-flex items-center gap-2 rounded-2xl border border-hair px-5 py-3.5 text-[15px] font-medium text-txt-hi transition-colors hover:bg-surface-2"
            >
              See how it works <ArrowRight size={16} />
            </a>
          </div>
        </Reveal>

        <Reveal eager delay={0.28}>
          <p className="mt-7 text-[13px] text-txt-low">
            A paid app. No ads, no selling your data.
          </p>
        </Reveal>
      </div>

      {/* Floating "ask" card */}
      <Reveal eager delay={0.32} className="relative mx-auto mt-16 max-w-md">
        <div className="floaty card ring-accent p-5">
          <div className="flex items-center gap-3 border-b border-hair pb-4">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-dim text-on-accent">
              <Sparkles size={16} />
            </div>
            <div className="text-left">
              <p className="text-[14px] font-semibold text-txt-hi">Judith</p>
              <p className="text-[12px] text-ok">Listening…</p>
            </div>
          </div>
          <div className="space-y-3 pt-4 text-left">
            <Bubble who="you">How much is left to pay this month?</Bubble>
            <Bubble who="judith">
              You've got{" "}
              <span className="font-mono font-bold text-txt-hi">$1,840</span>{" "}
              due across 3 bills before the 1st. Electric is the closest —
              due in 2 days.
            </Bubble>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Bubble({
  who,
  children,
}: {
  who: "you" | "judith";
  children: React.ReactNode;
}) {
  const mine = who === "you";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={
          mine
            ? "max-w-[80%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-[14px] font-medium text-on-accent"
            : "max-w-[85%] rounded-2xl rounded-bl-md bg-surface-3 px-4 py-2.5 text-[14px] leading-relaxed text-txt-mid"
        }
      >
        {children}
      </div>
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">
        {eyebrow}
      </span>
      <h2 className="mt-4 text-balance text-[30px] leading-tight tracking-tight text-txt-hi sm:text-[42px]">
        {title}
      </h2>
      {sub && (
        <p className="mx-auto mt-5 max-w-xl text-balance text-[16px] leading-relaxed text-txt-mid sm:text-[17px]">
          {sub}
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- ASK */
function Ask() {
  return (
    <section id="ask" className="relative px-5 py-24">
      <Reveal>
        <SectionHead
          eyebrow="Just ask Judith"
          title={
            <>
              Not another spreadsheet.{" "}
              <span className="font-display text-mint-grad">
                Someone you talk to.
              </span>
            </>
          }
          sub="By voice or by text. Plain answers in seconds — no menus, no logging in everywhere."
        />
      </Reveal>

      <div className="mx-auto mt-14 grid max-w-3xl gap-3 sm:grid-cols-2">
        {ASKS.map((q, i) => (
          <Reveal key={q} delay={i * 0.05}>
            <div className="card-tight flex items-start gap-3 p-4 transition-colors hover:border-accent/40">
              <Mic size={18} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-left text-[15px] leading-snug text-txt-hi">
                "{q}"
              </p>
            </div>
          </Reveal>
        ))}
        <Reveal delay={ASKS.length * 0.05}>
          <div className="flex h-full items-center justify-center rounded-[18px] border border-dashed border-hair p-4 text-[14px] text-txt-low">
            …or whatever you're wondering at 11pm.
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- A LOT TO TRACK */
function ALot() {
  return (
    <section className="relative px-5 py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <div>
            <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">
              Built for people with a lot to track
            </span>
            <h2 className="mt-4 text-balance text-[30px] leading-tight tracking-tight text-txt-hi sm:text-[40px]">
              More than one card. Maybe a loan or two.
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-txt-mid sm:text-[17px]">
              Utilities, insurance, subscriptions. Add what you owe from your
              latest statement and Judith holds it all — so "how much is left?"
              is one question away, not an afternoon of logging in everywhere.
            </p>
            <p className="mt-4 text-[16px] leading-relaxed text-txt-mid sm:text-[17px]">
              Run a business? Tag each bill personal or business and see them
              split cleanly. Your accountant reconciles once a month — Judith
              tells you where you stand on a Tuesday, before invoices go out,
              before you spend.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium uppercase tracking-wide text-txt-low">
                Total outstanding
              </p>
              <span className="rounded-full bg-surface-3 px-3 py-1 text-[12px] text-txt-mid">
                This month
              </span>
            </div>
            <p className="mt-3 font-mono text-[44px] font-bold tracking-tight text-txt-hi">
              $4,820
            </p>

            <div className="mt-6 space-y-3">
              <SplitRow
                label="Personal"
                value="$2,140"
                pct={44}
                color="var(--color-accent)"
              />
              <SplitRow
                label="Business"
                value="$2,680"
                pct={56}
                color="var(--color-violet)"
              />
            </div>

            <div className="mt-6 space-y-2.5 border-t border-hair pt-5">
              <Line name="Chase Sapphire" tag="Business" amt="$1,240" />
              <Line name="Mortgage" tag="Personal" amt="$2,100" />
              <Line name="Con Edison" tag="Personal" amt="$142" due />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function SplitRow({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: string;
  pct: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[14px]">
        <span className="text-txt-mid">{label}</span>
        <span className="font-mono font-medium text-txt-hi">{value}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function Line({
  name,
  tag,
  amt,
  due,
}: {
  name: string;
  tag: string;
  amt: string;
  due?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="text-[14px] text-txt-hi">{name}</span>
        <span className="rounded-md bg-surface-3 px-2 py-0.5 text-[11px] text-txt-low">
          {tag}
        </span>
        {due && (
          <span className="rounded-md bg-near/15 px-2 py-0.5 text-[11px] text-near">
            Due soon
          </span>
        )}
      </div>
      <span className="font-mono text-[14px] text-txt-mid">{amt}</span>
    </div>
  );
}

/* ----------------------------------------------------------- AUTOPAY */
function Autopay() {
  return (
    <section className="relative px-5 py-24">
      <div className="bloom right-0 top-20 h-[360px] w-[360px] bg-near/10" />
      <div className="relative mx-auto max-w-3xl text-center">
        <Reveal>
          <SectionHead
            eyebrow="Even if it's all on autopay"
            title={
              <>
                Autopay pays the bills.{" "}
                <span className="font-display text-mint-grad">
                  Judith tells you what they add up to.
                </span>
              </>
            }
            sub="Convenient — and exactly how the total gets away from you. A quietly growing pile of subscriptions, charged month after month until you've stopped noticing. Judith puts every one in front of you, so you decide what's worth keeping."
          />
        </Reveal>

        <Reveal delay={0.15}>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            {SUBSCRIPTIONS.map((s) => (
              <span
                key={s}
                className="rounded-full border border-hair bg-surface-1/70 px-4 py-2 text-[14px] text-txt-mid"
              >
                {s}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- REAL LIFE */
function RealLife() {
  return (
    <section className="relative px-5 py-24">
      <Reveal>
        <SectionHead
          eyebrow="Built for real life"
          title="For the moments the number actually matters"
        />
      </Reveal>
      <div className="mx-auto mt-14 grid max-w-4xl gap-5 md:grid-cols-2">
        <Reveal>
          <Moment
            icon={<Watch size={20} />}
            time="Rent day, 7am"
            title="Glance at your wrist"
            body="Ask Judith on your Apple Watch how much to set aside — before you spend a dollar of it."
          />
        </Reveal>
        <Reveal delay={0.1}>
          <Moment
            icon={<Mic size={20} />}
            time="Lying awake, 11pm"
            title="Ask out loud"
            body="Wondering if you missed something? Know for sure — before a late fee tells you."
          />
        </Reveal>
      </div>
    </section>
  );
}

function Moment({
  icon,
  time,
  title,
  body,
}: {
  icon: React.ReactNode;
  time: string;
  title: string;
  body: string;
}) {
  return (
    <div className="card h-full p-7">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-surface-3 text-accent">
          {icon}
        </div>
        <span className="font-mono text-[13px] uppercase tracking-wide text-txt-low">
          {time}
        </span>
      </div>
      <h3 className="mt-5 text-[20px] font-semibold tracking-tight text-txt-hi">
        {title}
      </h3>
      <p className="mt-2.5 text-[15px] leading-relaxed text-txt-mid">{body}</p>
    </div>
  );
}

/* ----------------------------------------------------------- TESTIMONIAL */
function Testimonial() {
  return (
    <section className="relative px-5 py-20">
      <Reveal>
        <figure className="mx-auto max-w-3xl text-center">
          <blockquote className="text-balance text-[22px] leading-relaxed tracking-tight text-txt-hi sm:text-[28px]">
            <span className="font-display text-mint-grad">"</span>My accountant
            keeps the books, but she can't tell me on a Tuesday whether I can
            cover a vendor invoice and still pay my own Amex. Judith can. I
            punch in each balance, tag everything business or personal, and ask
            her every morning — first time in years I'm not playing catch-up.
            <span className="font-display text-mint-grad">"</span>
          </blockquote>
          <figcaption className="mt-7 text-[14px] text-txt-low">
            <span className="font-medium text-txt-mid">Daniel M.</span> ·
            Business owner
          </figcaption>
        </figure>
      </Reveal>
    </section>
  );
}

/* --------------------------------------------------------- SCREENSHOTS */
function Screenshots() {
  const base = import.meta.env.BASE_URL;
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    rowRef.current?.scrollBy({
      left: dir === "right" ? 580 : -580,
      behavior: "smooth",
    });
  };

  return (
    <section id="screenshots" className="py-20 sm:py-28">
      <Reveal className="px-5 text-center">
        <SectionHead
          eyebrow="See it in action"
          title={
            <>
              Every screen, built{" "}
              <span className="font-display text-mint-grad">for clarity.</span>
            </>
          }
          sub="Ten views, one purpose — know exactly where you stand, whenever you need to."
        />
      </Reveal>

      {/* Arrow buttons — desktop only */}
      <div className="relative mt-14">
        <button
          onClick={() => scroll("left")}
          aria-label="Scroll left"
          className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 md:flex h-10 w-10 items-center justify-center rounded-full border border-hair bg-surface-1/80 text-txt-mid shadow-lg backdrop-blur transition hover:border-accent/50 hover:text-accent"
        >
          <ChevronLeft size={20} />
        </button>

        <div
          ref={rowRef}
          className={[
            "flex flex-nowrap gap-5 overflow-x-auto pb-6",
            "px-5 sm:px-8",
            "snap-x snap-mandatory scroll-smooth",
            "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          ].join(" ")}
        >
          {SCREENSHOTS.map((s, i) => (
            <Reveal
              key={s.file}
              delay={Math.min(i, 4) * 0.05}
              className="flex-shrink-0 snap-start"
            >
              <div className="flex flex-col items-center gap-3">
                <img
                  src={`${base}screenshots/${s.file}`}
                  alt={s.label}
                  width={280}
                  className={`h-auto rounded-2xl shadow-2xl ring-1 ring-white/5 ${"wide" in s && s.wide ? "w-[180px] sm:w-[210px]" : "w-[220px] sm:w-[260px]"}`}
                  loading="lazy"
                  draggable={false}
                />
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-txt-low">
                  {s.label}
                </span>
              </div>
            </Reveal>
          ))}

          {/* breathing room at the end */}
          <div className="flex-shrink-0 w-3 sm:w-6" aria-hidden />
        </div>

        <button
          onClick={() => scroll("right")}
          aria-label="Scroll right"
          className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 md:flex h-10 w-10 items-center justify-center rounded-full border border-hair bg-surface-1/80 text-txt-mid shadow-lg backdrop-blur transition hover:border-accent/50 hover:text-accent"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- FEATURES */
function Features() {
  return (
    <section id="features" className="relative px-5 py-24">
      <Reveal>
        <SectionHead
          eyebrow="What you get"
          title="Everything in one calm, private place"
        />
      </Reveal>

      <div className="mx-auto mt-14 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f, i) => {
          const Icon = f.icon;
          return (
            <Reveal key={f.title} delay={(i % 4) * 0.06}>
              <div className="card-tight h-full p-6 transition-colors hover:border-accent/40">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-surface-3 text-accent">
                  <Icon size={20} />
                </div>
                <h3 className="mt-5 text-[16px] font-semibold tracking-tight text-txt-hi">
                  {f.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-txt-mid">
                  {f.body}
                </p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- PRICING */
function Pricing() {
  return (
    <section id="pricing" className="relative px-5 py-24">
      <div className="bloom -left-20 top-24 h-[360px] w-[360px] bg-accent/15" />
      <Reveal>
        <SectionHead
          eyebrow="Pricing — upfront, no tricks"
          title={
            <>
              Own Judith.{" "}
              <span className="font-display text-mint-grad">
                Clarity from day one.
              </span>
            </>
          }
          sub="Judith is a paid app — one purchase, priced by the App Store. Full bill tracking, reminders, the calendar, widgets, the Apple Watch app, and a set of asks to start."
        />
      </Reveal>

      <div className="mx-auto mt-14 grid max-w-4xl items-stretch gap-5 md:grid-cols-2">
        <Reveal>
          <PlanCard
            name="Chat Ask"
            tagline="Unlimited text asks to Judith, anytime."
            points={[
              "Everything in the paid app",
              "Unlimited text conversations",
              "Plain-language answers in seconds",
            ]}
          />
        </Reveal>
        <Reveal delay={0.1}>
          <PlanCard
            featured
            name="Voice Ask"
            badge="Most popular"
            tagline="Talk to Judith and hear her answer out loud."
            points={[
              "Everything in Chat Ask",
              "Speak your questions, hear replies",
              "Hear Judith in your language",
              "On your phone and Apple Watch",
            ]}
          />
        </Reveal>
      </div>

      <Reveal delay={0.18}>
        <p className="mt-8 text-center text-[13px] text-txt-low">
          Prices shown in USD. Cancel anytime — no hidden fees.
        </p>
      </Reveal>
    </section>
  );
}

function PlanCard({
  name,
  tagline,
  points,
  featured,
  badge,
}: {
  name: string;
  tagline: string;
  points: string[];
  featured?: boolean;
  badge?: string;
}) {
  return (
    <div
      className={`relative flex h-full flex-col p-7 ${
        featured ? "card ring-accent" : "card"
      }`}
    >
      {badge && (
        <span className="absolute -top-3 left-7 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-on-accent">
          {badge}
        </span>
      )}
      <div className="flex items-center gap-2">
        {featured ? (
          <Mic size={18} className="text-accent" />
        ) : (
          <InfinityIcon size={18} className="text-accent" />
        )}
        <h3 className="text-[22px] font-semibold tracking-tight text-txt-hi">
          {name}
        </h3>
      </div>
      <p className="mt-2 text-[15px] text-txt-mid">{tagline}</p>

      <div className="my-6 h-px bg-hair" />

      <ul className="space-y-3">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-3 text-[15px] text-txt-hi">
            <Check size={18} className="mt-0.5 shrink-0 text-accent" />
            {p}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-7">
        <span className="block rounded-2xl bg-surface-3 px-4 py-3 text-center text-[13px] text-txt-low">
          Subscribe inside the app
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------- GLANCE OR ASK */
function GlanceOrAsk() {
  const base = import.meta.env.BASE_URL;
  const featured = EXAMPLE_ASKS[0];
  const rest = EXAMPLE_ASKS.slice(1);

  return (
    <section id="voice" className="relative px-5 py-24">
      <div className="bloom -right-40 top-0 h-[420px] w-[420px] bg-violet/10" />
      <div className="bloom left-0 top-[60%] h-[320px] w-[400px] bg-accent/8" />
      <div className="relative mx-auto max-w-6xl">

        {/* Section header */}
        <Reveal>
          <SectionHead
            eyebrow="Quick by design"
            title={
              <>
                Just{" "}
                <span className="font-display text-mint-grad">
                  Glance or Ask.
                </span>
              </>
            }
            sub="No menus to dig through. No steps. Judith meets you wherever you are — on your wrist, in your voice, or at the press of a button."
          />
        </Reveal>

        {/* ── ROW 1: GLANCE (Apple Watch) ── */}
        <div className="mt-20 grid items-center gap-12 lg:grid-cols-2">
          {/* Watch images */}
          <Reveal delay={0.08}>
            <div className="flex justify-center gap-6 sm:gap-10">
              {[
                { file: "watch-upnext.png", label: "Up Next" },
                { file: "watch-ask.png", label: "Ask Judith" },
              ].map((w) => (
                <div key={w.file} className="flex flex-col items-center gap-3">
                  <img
                    src={`${base}screenshots/${w.file}`}
                    alt={w.label}
                    className="w-[155px] drop-shadow-2xl sm:w-[180px]"
                    loading="lazy"
                    draggable={false}
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-txt-low">
                    {w.label}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Glance content */}
          <Reveal delay={0.14}>
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                Glance
              </p>
              <h3 className="text-[28px] font-semibold leading-tight tracking-tight text-txt-hi">
                On your wrist,{" "}
                <span className="font-display text-mint-grad">before you spend.</span>
              </h3>
              <p className="text-[16px] leading-relaxed text-txt-mid">
                The Judith Watch app syncs in real time. Ask by voice, check
                what's due, and mark bills paid — without ever pulling out your
                phone.
              </p>
              <ul className="mt-4 space-y-3">
                {WATCH_CAPS.map((cap) => (
                  <li key={cap} className="flex items-start gap-3">
                    <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                    <span className="text-[15px] text-txt-hi">{cap}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        {/* ── ROW 2: ASK (Voice) ── */}
        <div className="mt-24 grid items-center gap-12 lg:grid-cols-2">
          {/* Ask content */}
          <Reveal delay={0.08}>
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                Ask
              </p>
              <h3 className="text-[28px] font-semibold leading-tight tracking-tight text-txt-hi">
                Talk to Judith.{" "}
                <span className="font-display text-mint-grad">Get a real answer.</span>
              </h3>
              <p className="text-[16px] leading-relaxed text-txt-mid">
                Plain language — no commands, no menus. Ask the way you'd ask a
                person. By voice or by text, in your language, in seconds.
              </p>

              {/* Featured ask */}
              <div className="mt-6 rounded-2xl border border-accent/25 bg-surface-1/60 p-5 shadow-[0_0_50px_-14px_var(--color-accent)] backdrop-blur">
                <div className="flex items-start gap-3">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                    <Mic size={13} />
                  </div>
                  <p className="pt-0.5 text-[16px] font-semibold leading-snug text-txt-hi">
                    "{featured.q}"
                  </p>
                </div>
                {featured.a && (
                  <div className="mt-4 rounded-xl bg-surface-3/80 px-4 py-3.5">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-dim">
                        <Sparkles size={10} className="text-on-accent" />
                      </div>
                      <span className="text-[11px] font-semibold text-accent">Judith</span>
                    </div>
                    <p className="text-[14px] leading-relaxed text-txt-mid">{featured.a}</p>
                  </div>
                )}
              </div>

              {/* Rest as pills */}
              <div className="mt-3 flex flex-wrap gap-2">
                {rest.map((item) => (
                  <span
                    key={item.q}
                    className="flex items-center gap-2 rounded-full border border-hair bg-surface-1/50 px-3.5 py-1.5 text-[12px] font-medium text-txt-mid"
                  >
                    <Mic size={10} className="shrink-0 text-accent" />
                    {item.q}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Ask phone mockup */}
          <Reveal delay={0.14}>
            <div className="flex justify-center">
              <img
                src={`${base}screenshots/mockup-ask.png`}
                alt="Ask Judith conversation"
                className="w-full max-w-[320px] rounded-3xl drop-shadow-2xl"
                loading="lazy"
                draggable={false}
              />
            </div>
          </Reveal>
        </div>

        {/* ── ROW 3: ACTION BUTTON ── */}
        <div className="mt-24 grid items-center gap-12 lg:grid-cols-2">
          {/* Action button mockup */}
          <Reveal delay={0.08}>
            <div className="flex justify-center">
              <img
                src={`${base}screenshots/action-button-result.png`}
                alt="Judith bound to the iPhone Action Button"
                className="w-full max-w-[360px] rounded-3xl drop-shadow-2xl"
                loading="lazy"
                draggable={false}
              />
            </div>
          </Reveal>

          {/* Action button content */}
          <Reveal delay={0.14}>
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                Action Button
              </p>
              <h3 className="text-[28px] font-semibold leading-tight tracking-tight text-txt-hi">
                One press.{" "}
                <span className="font-display text-mint-grad">Instant answer.</span>
              </h3>
              <p className="text-[16px] leading-relaxed text-txt-mid">
                Add Judith as a Shortcut and bind it to your iPhone's Action
                Button. Press once — your bill total appears on screen, right
                from your lock screen. No unlocking, no opening, no waiting.
              </p>
              <ul className="mt-4 space-y-3">
                {[
                  "Add Judith's Siri Shortcut in one tap",
                  "Bind it to the Action Button in Settings",
                  "Press the button — see your total instantly",
                  "Works from the lock screen, no unlock needed",
                ].map((cap) => (
                  <li key={cap} className="flex items-start gap-3">
                    <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                    <span className="text-[15px] text-txt-hi">{cap}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

      </div>
    </section>
  );
}

/* ---------------------------------------------------- VOICE BUTTON */
const API_BASE = "https://judithforduedates.com";

// Module-level singletons — one audio at a time, URLs cached in memory
let _activeAudio: HTMLAudioElement | null = null;
let _resetActive: (() => void) | null = null;
const _urlCache = new Map<string, string>();

type PlayState = "idle" | "loading" | "playing" | "error";

function VoiceButton({ personaId }: { personaId: string }) {
  const [state, setState] = useState<PlayState>("idle");

  // Stable reference to "reset this button to idle"
  const stopSelf = useCallback(() => setState("idle"), []);

  const handleClick = async () => {
    // Already playing / loading this persona — stop it
    if (state === "playing" || state === "loading") {
      _activeAudio?.pause();
      _activeAudio = null;
      _resetActive = null;
      setState("idle");
      return;
    }

    // Stop whatever is currently playing and reset that button
    _activeAudio?.pause();
    _activeAudio = null;
    _resetActive?.();
    _resetActive = stopSelf;

    setState("loading");

    try {
      let url = _urlCache.get(personaId);
      if (!url) {
        const res = await fetch(
          `${API_BASE}/api/public/persona-sample?persona=${personaId}`,
        );
        if (!res.ok) throw new Error("fetch_failed");
        const data = (await res.json()) as { url: string };
        url = data.url;
        _urlCache.set(personaId, url);
      }

      // Check we weren't pre-empted by another button click
      if (_resetActive !== stopSelf) return;

      const audio = new Audio(url);
      _activeAudio = audio;

      audio.addEventListener("ended", () => {
        if (_activeAudio === audio) {
          _activeAudio = null;
          _resetActive = null;
        }
        setState("idle");
      });
      audio.addEventListener("error", () => {
        if (_activeAudio === audio) {
          _activeAudio = null;
          _resetActive = null;
        }
        setState("error");
      });

      await audio.play();
      if (_activeAudio !== audio) return; // pre-empted during async play()
      setState("playing");
    } catch {
      if (_resetActive === stopSelf) {
        _resetActive = null;
        setState("error");
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
        state === "playing"
          ? "border-accent/50 bg-accent/20 text-accent"
          : state === "error"
            ? "border-red-400/30 bg-red-400/10 text-red-400"
            : "border-accent/25 bg-accent/8 text-accent hover:bg-accent/16"
      }`}
      aria-label={state === "playing" ? "Stop preview" : "Hear this voice"}
    >
      {state === "loading" ? (
        <>
          <Loader2 size={10} className="animate-spin" />
          <span>Loading…</span>
        </>
      ) : state === "playing" ? (
        <>
          <Square size={10} className="fill-accent" />
          <span>Stop</span>
        </>
      ) : state === "error" ? (
        <span>Try again</span>
      ) : (
        <>
          <Volume2 size={10} />
          <span>Hear voice</span>
        </>
      )}
    </button>
  );
}

/* ----------------------------------------------------------- PERSONAS */
function Personas() {
  return (
    <section className="relative px-5 py-24">
      <div className="bloom -left-40 top-20 h-[380px] w-[380px] bg-violet/10" />
      <div className="relative">
        <Reveal>
          <SectionHead
            eyebrow="6 personalities"
            title={
              <>
                Pick the voice{" "}
                <span className="font-display text-mint-grad">
                  that feels right.
                </span>
              </>
            }
            sub="Judith isn't one-size-fits-all. Choose a personality that matches how you like to be spoken to — then switch any time."
          />
        </Reveal>

        <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PERSONAS_SITE.map((p, i) => (
            <Reveal key={p.name} delay={i * 0.06}>
              <div
                className={`group relative flex h-full flex-col rounded-2xl border ${p.border} bg-surface-1/50 p-6 backdrop-blur transition-all duration-300 ${p.shadow}`}
              >
                {/* Avatar */}
                <img
                  src={p.avatar}
                  alt={p.name}
                  className="mb-4 h-14 w-14 rounded-full"
                  loading="lazy"
                  draggable={false}
                />

                {/* Persona line */}
                <p className="flex-1 text-[15px] leading-relaxed text-txt-hi">
                  {p.line}
                </p>

                {/* Footer */}
                <div className="mt-5 border-t border-hair pt-4">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[13px] font-semibold text-txt-hi">
                      {p.name}
                    </span>
                    <span className="ml-auto rounded-full border border-hair px-2.5 py-0.5 text-[11px] text-txt-low">
                      {p.vibe}
                    </span>
                  </div>
                  <div className="mt-3">
                    <VoiceButton personaId={p.id} />
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- LANGUAGES */
function Languages() {
  const rowA = [...LANG_ROW_A, ...LANG_ROW_A];
  const rowB = [...LANG_ROW_B, ...LANG_ROW_B];

  return (
    <section className="relative overflow-hidden px-0 py-24">
      <div className="bloom left-1/2 top-0 h-[320px] w-[600px] -translate-x-1/2 bg-accent/8" />
      <div className="relative">
        <Reveal>
          <SectionHead
            eyebrow="Global reach"
            title={
              <>
                Speaks your language.{" "}
                <span className="font-display text-mint-grad">Literally.</span>
              </>
            }
            sub="Ask by voice in your language, and Judith replies in the same one — spoken aloud or as text."
          />
        </Reveal>

        {/* Language count badge */}
        <Reveal delay={0.08}>
          <div className="mx-auto mt-8 flex justify-center">
            <div className="inline-flex items-center gap-3 rounded-full border border-accent/30 bg-accent/10 px-5 py-2.5">
              <span className="text-[22px] font-bold text-accent">35+</span>
              <span className="text-[13px] text-txt-mid">
                languages spoken & understood
              </span>
            </div>
          </div>
        </Reveal>

        {/* Marquee rows */}
        <div className="relative mt-10 space-y-3 overflow-hidden">
          {/* Fade edges */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-canvas to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-canvas to-transparent" />

          {/* Row A — scrolls left */}
          <div className="flex w-max gap-3 marquee-left">
            {rowA.map((lang, i) => (
              <span
                key={`a-${i}`}
                className="flex items-center gap-2 whitespace-nowrap rounded-full border border-hair bg-surface-1/60 px-4 py-2 text-[13px] font-medium text-txt-mid"
              >
                <span className="text-base leading-none">{lang.flag}</span>
                {lang.name}
              </span>
            ))}
          </div>

          {/* Row B — scrolls right */}
          <div className="flex w-max gap-3 marquee-right">
            {rowB.map((lang, i) => (
              <span
                key={`b-${i}`}
                className="flex items-center gap-2 whitespace-nowrap rounded-full border border-hair bg-surface-1/60 px-4 py-2 text-[13px] font-medium text-txt-mid"
              >
                <span className="text-base leading-none">{lang.flag}</span>
                {lang.name}
              </span>
            ))}
          </div>
        </div>

        {/* Feature pills */}
        <Reveal delay={0.12}>
          <div className="mx-auto mt-10 flex flex-wrap justify-center gap-2.5 px-5">
            {[
              "Voice input",
              "Voice output",
              "Language auto-detected",
              "No switching needed",
            ].map((f) => (
              <span
                key={f}
                className="flex items-center gap-1.5 rounded-full border border-hair bg-surface-2/60 px-4 py-1.5 text-[12px] font-medium text-txt-mid"
              >
                <Check size={11} className="text-accent" />
                {f}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- CTA */
function CTA() {
  return (
    <section className="relative px-5 py-28">
      <div className="bloom left-1/2 top-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 bg-accent/20" />
      <Reveal className="relative mx-auto max-w-3xl text-center">
        <h2 className="text-balance text-[34px] leading-tight tracking-tight text-txt-hi sm:text-[52px]">
          Stop guessing. Stop dreading the number.{" "}
          <span className="font-display text-mint-grad">Just ask Judith.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-txt-mid">
          "I think I'm okay?" becomes "I know exactly where I stand." That
          clarity is yours the moment you own Judith.
        </p>
        <div className="mt-10 flex justify-center">
          <AppStoreBadge />
        </div>
      </Reveal>
    </section>
  );
}
