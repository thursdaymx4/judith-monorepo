import {
  Mic,
  Watch,
  LayoutGrid,
  Smartphone,
  MessageSquare,
  CreditCard,
  Split,
  BellRing,
  ArrowUpRight,
  Zap,
  Cpu,
  ShieldCheck,
} from "lucide-react";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { Reveal } from "@/components/site/Reveal";
import { AppStoreBadge } from "@/components/site/AppStoreBadge";

interface Feature {
  icon: React.ElementType;
  title: string;
  body: string;
  badge?: string;
}

interface Group {
  label: string;
  isNew?: boolean;
  features: Feature[];
}

const GROUPS: Group[] = [
  {
    label: "New in this update",
    isNew: true,
    features: [
      {
        icon: Cpu,
        title: "Apple Intelligence on-device",
        body: "Judith now uses Apple's on-device language models (Foundation Models, iOS 26+) to instantly classify your bills — type \"Globe Fiber\" and she knows it's Internet, not a streaming service. No cloud round-trip, no API key, no waiting.",
        badge: "iOS 26+",
      },
      {
        icon: CreditCard,
        title: "Apple Card auto-discovery",
        body: "If you have an Apple Card, Apple Cash, or Apple Savings, Judith can scan the last 90 days of transactions and surface your recurring bills automatically — Netflix, Spotify, Verizon, anything that hits on a steady cadence. Review each one before it's added; nothing is automatic. Transactions never leave your phone.",
        badge: "US · FinanceKit",
      },
      {
        icon: Mic,
        title: "Ask Siri, anywhere",
        body: "\"Hey Siri, what's on my Apple Card this month?\" \"How much do I have left after bills?\" Judith now plugs into Siri via App Intents on both iPhone and Apple Watch — no need to open the app for the quick stuff.",
      },
      {
        icon: BellRing,
        title: "Always-on background",
        body: "Judith now watches for cleared transactions in the background and quietly nudges you when a bill auto-paid through, so your tracker stays in sync without you ever opening it.",
      },
      {
        icon: Split,
        title: "Funding-source aware",
        body: "Tell Judith how each bill is paid — manual, credit card, bank auto-debit, or e-wallet — and she'll answer questions like \"what's tied to Apple Cash?\" correctly. Streaks now exclude auto-pay so manual payments get the credit they deserve.",
      },
      {
        icon: ShieldCheck,
        title: "Privacy by design",
        body: "FinanceKit transactions and Apple Intelligence classification both run entirely on your device. Judith is a tracker, not a payer — she never moves money, and never asks you to connect your bank account.",
      },
    ],
  },
  {
    label: "Ask Judith",
    features: [
      {
        icon: MessageSquare,
        title: "Ask anything about your bills",
        body: "Type or speak a question — \"How much do I owe this month?\", \"Which bill is due next?\", \"Can I afford to pay everything before the 15th?\" — and get a straight answer. Not a list. An actual answer.",
      },
      {
        icon: MessageSquare,
        title: "Follow-up questions work",
        body: "Judith holds the thread. Ask \"What about just the personal ones?\" after any question and she knows what you mean. No need to repeat yourself.",
      },
      {
        icon: Mic,
        title: "Five voice personas",
        body: "Hear your answer spoken back by the voice you chose: calm professional, warm friend, sarcastic sibling, caring mom, or brutally honest advisor.",
      },
    ],
  },
  {
    label: "Bill tracking",
    features: [
      {
        icon: CreditCard,
        title: "Every bill type in one place",
        body: "Credit cards, bank loans, utilities, rent, subscriptions, instalment plans — log them all and see everything in one timeline.",
      },
      {
        icon: CreditCard,
        title: "Partial payment tracking",
        body: "Paid half a bill? Log it. Judith tracks what you've paid and always shows the correct remaining balance.",
      },
      {
        icon: Split,
        title: "Personal vs business split",
        body: "Tag each bill as personal or business. Insights shows a clean breakdown so expense tracking and personal budgeting stay separate.",
      },
    ],
  },
  {
    label: "Reminders",
    features: [
      {
        icon: BellRing,
        title: "Smart reminders before every due date",
        body: "Get notified days before a bill is due, not the day of. Configure how far in advance per bill.",
      },
      {
        icon: LayoutGrid,
        title: "Home Screen and Lock Screen widgets",
        body: "See your next due bill and total unpaid amount on your Home Screen or Lock Screen — no need to open the app.",
      },
    ],
  },
  {
    label: "Siri and Shortcuts",
    features: [
      {
        icon: Smartphone,
        title: "Ask Judith through Siri",
        body: "\"Hey Siri, what's overdue in Judith?\" — works. Check bills, get your monthly total, ask what's due next, or mark something paid, all without opening the app.",
      },
      {
        icon: Zap,
        title: "Works offline and instantly",
        body: "Siri quick-checks run against your phone's local data — no network needed, responds in under a second.",
      },
      {
        icon: Smartphone,
        title: "Action Button shortcut",
        body: "On iPhone 15 Pro, iPhone 16, or iPhone 16 Pro: set the Action Button to open Judith's voice Ask. One press and she's listening.",
      },
    ],
  },
  {
    label: "Apple Watch",
    features: [
      {
        icon: Watch,
        title: "Full Watch app",
        body: "See your full bill list on your wrist, mark bills paid, and check what's coming up — without your phone.",
      },
      {
        icon: Watch,
        title: "Ask Judith from your Watch",
        body: "Speak, type, or Scribble a question. Judith answers right on your wrist.",
      },
      {
        icon: Watch,
        title: "Watch complications",
        body: "Your next due date on the Watch face, always visible at a glance.",
      },
    ],
  },
];

export default function Changelog() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <Nav />
      <Hero />
      <Features />
      <CtaSection />
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative px-5 pb-16 pt-36 sm:pt-44">
      <div className="bloom -left-24 top-24 h-[360px] w-[360px] bg-accent/18" />
      <div className="bloom right-4 top-32 h-[300px] w-[300px] bg-violet/10" />
      <div className="grain absolute inset-0 opacity-60" />

      <div className="relative mx-auto max-w-2xl text-center">
        <Reveal eager>
          <span className="inline-flex items-center gap-2 rounded-full border border-hair bg-surface-1/60 px-4 py-1.5 text-[12px] font-medium uppercase tracking-[0.18em] text-txt-mid backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            What's new in Judith
          </span>
        </Reveal>

        <Reveal eager delay={0.05}>
          <h1 className="mt-7 text-balance text-[36px] leading-[1.08] tracking-tight text-txt-hi sm:text-[52px]">
            Feels less like a tracker.{" "}
            <span className="font-display text-mint-grad">More like an assistant.</span>
          </h1>
        </Reveal>

        <Reveal eager delay={0.12}>
          <p className="mx-auto mt-6 max-w-lg text-balance text-[16px] leading-relaxed text-txt-mid">
            The latest update uses new Apple frameworks to keep everything on
            your device — faster, smarter, and more private.
          </p>
        </Reveal>

        <Reveal eager delay={0.18}>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/8 px-4 py-2 text-[13px] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Available on TestFlight — App Store approval pending
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="px-5 pb-24">
      <div className="mx-auto max-w-3xl space-y-16">
        {GROUPS.map((group, gi) => (
          <Reveal key={group.label} delay={gi * 0.04}>
            <div>
              <div className="mb-6 flex items-center gap-3">
                <h2 className={`text-[12px] font-semibold uppercase tracking-[0.18em] ${group.isNew ? "text-accent" : "text-txt-low"}`}>
                  {group.label}
                </h2>
                {group.isNew && (
                  <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                    New
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {group.features.map((feature, fi) => (
                  <FeatureCard key={fi} feature={feature} highlight={group.isNew} />
                ))}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function FeatureCard({ feature, highlight }: { feature: Feature; highlight?: boolean }) {
  const Icon = feature.icon;
  return (
    <div className={`card-tight p-5 transition-colors hover:border-white/10 ${highlight ? "border-accent/15" : ""}`}>
      <div className="flex items-start gap-4">
        <div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${highlight ? "bg-accent/10" : "bg-surface-3"}`}>
          <Icon size={16} className={highlight ? "text-accent" : "text-txt-mid"} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold leading-snug text-txt-hi">
              {feature.title}
            </h3>
            {feature.badge && (
              <span className="rounded-md bg-surface-3 px-2 py-0.5 text-[10px] font-medium tracking-wide text-txt-low">
                {feature.badge}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-txt-mid">
            {feature.body}
          </p>
        </div>
      </div>
    </div>
  );
}

function CtaSection() {
  return (
    <section className="relative px-5 pb-28 pt-4">
      <div className="bloom left-1/2 top-0 h-[300px] w-[300px] -translate-x-1/2 bg-accent/12" />
      <div className="relative mx-auto max-w-lg text-center">
        <Reveal>
          <h2 className="text-balance text-[26px] leading-tight tracking-tight text-txt-hi sm:text-[34px]">
            Try it now on{" "}
            <span className="font-display text-mint-grad">TestFlight.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-sm text-balance text-[15px] leading-relaxed text-txt-mid">
            The full app — including all the new Apple Intelligence and
            FinanceKit features — is in the current TestFlight build.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <AppStoreBadge />
            <a
              href="https://testflight.apple.com/join/6QXUbyzs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[13px] text-txt-low transition-colors hover:text-txt-mid"
            >
              Join the TestFlight beta <ArrowUpRight size={13} />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
