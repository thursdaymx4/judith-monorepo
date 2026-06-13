import { useRef } from "react";
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
} from "lucide-react";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { Reveal } from "@/components/site/Reveal";
import { AppStoreBadge } from "@/components/site/AppStoreBadge";

const ASKS = [
  "How much do I still owe this month?",
  "What's due before payday?",
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
    body: "Plain-language replies, in your language — by voice or by text.",
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
  { file: "09-language.png", label: "Speaks your language" },
  { file: "widgets.png", label: "Always in view", wide: true },
];

const VOICE_CAPS = [
  { n: "01", title: "Ask what's due", body: "What bills are coming up soon, what's due this week, and when the next due date is." },
  { n: "02", title: "Ask how much you owe", body: "This month's total, remaining unpaid bills, or totals by category — utilities, rent, cards, subscriptions." },
  { n: "03", title: "Ask what's already paid", body: "Judith tells you whether a specific bill looks paid or still unpaid." },
  { n: "04", title: "Ask what's biggest or most urgent", body: "Which bill is largest, closest to due, or needs attention first." },
  { n: "05", title: "Ask about credit cards", body: "Total credit card bills, track current statement balances, and account for recurring charges linked to cards." },
  { n: "06", title: "Ask about next month", body: "Estimate next month's bills based on what's already tracked." },
  { n: "07", title: "Ask what's left after bills", body: "If income is set, ask how much money may be left after upcoming bills." },
  { n: "08", title: "Ask affordability questions", body: "Practical 'can I afford this?' answers using tracked bills and expected upcoming totals." },
  { n: "09", title: "Add bills by talking", body: "Tell Judith the provider, amount, and due date instead of typing — during setup or any time." },
  { n: "10", title: "Hear answers spoken back", body: "With Voice Ask, Judith can reply out loud so you can ask and listen hands-free." },
  { n: "11", title: "Five warm personas", body: "Pick the voice that feels right — professional, funny, caring, sarcastic, or bold." },
  { n: "12", title: "Natural language", body: "No exact commands needed. Ask casually, the way you'd ask a person." },
];

const EXAMPLE_ASKS = [
  "What's due this week?",
  "How much do I still owe this month?",
  "When's my next due date?",
  "What's my biggest bill?",
  "Did I pay Meralco?",
  "Can I afford to go on vacation next month?",
  "What subscriptions am I paying for?",
  "How much will be left from my income after bills?",
  "What bills are coming up before payday?",
  "Which bill should I worry about first?",
];

const WATCH_CAPS = [
  "See upcoming and overdue bills at a glance",
  "Mark bills as paid right from your wrist",
  "Ask Judith by voice, Scribble, or keyboard",
  "Get bill reminders as Watch notifications",
  "Use complications for glanceable bill status",
  "Answers sent from iPhone, shown on Watch",
];

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <Nav />
      <Hero />
      <Ask />
      <VoiceCapabilities />
      <ALot />
      <Autopay />
      <RealLife />
      <Testimonial />
      <AppleWatch />
      <Screenshots />
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
            Do you actually know how much bills you{" "}
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
            A paid app — no subscription required to start. No ads, no selling
            your data.
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
            <Bubble who="you">How much is due before payday?</Bubble>
            <Bubble who="judith">
              You've got{" "}
              <span className="font-mono font-bold text-txt-hi">₱18,420</span>{" "}
              due across 3 bills before the 15th. Electricity is the closest —
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
          sub="By voice or by text, in your language. Plain answers in seconds — no menus, no logging in everywhere."
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
              tells you where you stand on a Tuesday, before payroll, before you
              spend.
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
              ₱142,860
            </p>

            <div className="mt-6 space-y-3">
              <SplitRow
                label="Personal"
                value="₱61,230"
                pct={43}
                color="var(--color-accent)"
              />
              <SplitRow
                label="Business"
                value="₱81,630"
                pct={57}
                color="var(--color-violet)"
              />
            </div>

            <div className="mt-6 space-y-2.5 border-t border-hair pt-5">
              <Line name="BPI Mastercard" tag="Business" amt="₱42,100" />
              <Line name="Home loan" tag="Personal" amt="₱28,900" />
              <Line name="Meralco" tag="Personal" amt="₱6,540" due />
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
            time="Payday, 7am"
            title="Glance at your wrist"
            body="Ask Judith on your Apple Watch how much to set aside — before you spend a peso of it."
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
            cover a supplier and still pay my own card. Judith can. I punch in
            each balance, tag everything business or personal, and ask her every
            morning — first time in years I'm not playing catch-up.
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
          sub="Judith is a paid app — one purchase, priced for your country by the App Store. Full bill tracking, reminders, the calendar, widgets, the Apple Watch app, and a set of asks to start. No subscription required."
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
              "On your phone and Apple Watch",
            ]}
          />
        </Reveal>
      </div>

      <Reveal delay={0.18}>
        <p className="mt-8 text-center text-[13px] text-txt-low">
          Prices show in your local currency. Cancel anytime — no hidden fees.
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

/* ------------------------------------------------ VOICE CAPABILITIES */
function VoiceCapabilities() {
  return (
    <section id="voice" className="relative px-5 py-24">
      <div className="bloom -right-40 top-10 h-[420px] w-[420px] bg-violet/12" />
      <div className="relative">
        <Reveal>
          <SectionHead
            eyebrow="Voice capabilities"
            title={
              <>
                Ask your bills out loud.{" "}
                <span className="font-display text-mint-grad">
                  Get a real answer.
                </span>
              </>
            }
            sub="Judith understands plain language — no exact commands, no menus. Ask the way you'd ask a person."
          />
        </Reveal>

        <div className="mx-auto mt-14 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VOICE_CAPS.map((c, i) => (
            <Reveal key={c.n} delay={Math.min(i, 5) * 0.05}>
              <div className="card-tight h-full p-5 transition-colors hover:border-accent/40">
                <span className="font-mono text-[11px] font-semibold tracking-[0.14em] text-accent">
                  {c.n}
                </span>
                <h3 className="mt-2 text-[15px] font-semibold tracking-tight text-txt-hi">
                  {c.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-txt-mid">
                  {c.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Example asks strip */}
        <Reveal delay={0.15}>
          <div className="mx-auto mt-14 max-w-4xl">
            <p className="mb-5 text-center text-[12px] font-semibold uppercase tracking-[0.18em] text-txt-low">
              Example asks
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {EXAMPLE_ASKS.map((q) => (
                <span
                  key={q}
                  className="flex items-center gap-2 rounded-full border border-hair bg-surface-1/60 px-4 py-2 text-[13px] text-txt-mid backdrop-blur"
                >
                  <Mic size={12} className="shrink-0 text-accent" />
                  {q}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- APPLE WATCH */
function AppleWatch() {
  const base = import.meta.env.BASE_URL;
  return (
    <section id="watch" className="relative px-5 py-24">
      <div className="bloom left-1/2 top-0 h-[380px] w-[500px] -translate-x-1/2 bg-accent/10" />
      <div className="relative mx-auto max-w-6xl">
        <Reveal>
          <SectionHead
            eyebrow="Apple Watch"
            title={
              <>
                On your wrist.{" "}
                <span className="font-display text-mint-grad">
                  Before you spend.
                </span>
              </>
            }
            sub="Ask Judith, check what's due, and mark bills paid — without touching your phone."
          />
        </Reveal>

        <div className="mt-16 grid items-center gap-12 lg:grid-cols-2">
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
                    className="w-[160px] drop-shadow-2xl sm:w-[190px]"
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

          {/* Capabilities */}
          <Reveal delay={0.14}>
            <div className="space-y-4">
              <h3 className="text-[22px] font-semibold tracking-tight text-txt-hi">
                Everything you need, from your wrist.
              </h3>
              <p className="text-[16px] leading-relaxed text-txt-mid">
                The Judith Watch app syncs with your iPhone in real time. Ask by
                voice, Scribble, or keyboard. Get answers. Mark paid. Check
                what's overdue — all without pulling out your phone.
              </p>
              <ul className="mt-6 space-y-3">
                {WATCH_CAPS.map((cap) => (
                  <li key={cap} className="flex items-start gap-3">
                    <Check
                      size={17}
                      className="mt-0.5 shrink-0 text-accent"
                    />
                    <span className="text-[15px] text-txt-hi">{cap}</span>
                  </li>
                ))}
              </ul>

              {/* Mini example asks */}
              <div className="mt-8 rounded-2xl border border-hair bg-surface-1/50 p-5 backdrop-blur">
                <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-txt-low">
                  From your watch
                </p>
                <div className="space-y-2">
                  {[
                    "What's due this week?",
                    "How much do I owe this month?",
                    "What's overdue?",
                  ].map((q) => (
                    <div key={q} className="flex items-center gap-2.5">
                      <Watch size={13} className="shrink-0 text-accent" />
                      <span className="text-[14px] text-txt-mid">"{q}"</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
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
