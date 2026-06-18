import { Check, X, Minus, Mic, ArrowRight } from "lucide-react";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { Reveal } from "@/components/site/Reveal";
import { AppStoreBadge } from "@/components/site/AppStoreBadge";

const ROWS = [
  {
    feature: "Knows your full payment history",
    sub: "What you've paid, what's partial, what's still outstanding",
    siri: { has: false as const, note: "Sees upcoming bills only — no payment history" },
    judith: { has: true as const, note: "Tracks every payment, partial payment, and carry-over balance" },
  },
  {
    feature: "Remembers the conversation",
    sub: '"What about just my personal bills?"',
    siri: { has: false as const, note: "Every question starts fresh — no context from the previous one" },
    judith: { has: true as const, note: "Follow-up questions work naturally, just like talking to a person" },
  },
  {
    feature: "Tracks partial payments",
    sub: "Paid half a bill? Judith knows what you still owe",
    siri: { has: false as const, note: "No concept of partial payment — only full bill amounts" },
    judith: { has: true as const, note: "Log any payment amount and Judith always shows the correct remaining balance" },
  },
  {
    feature: "A voice with personality",
    sub: "Something that feels like yours",
    siri: { has: "partial" as const, note: "Siri's voice — the same one everywhere" },
    judith: { has: true as const, note: "Five distinct personas: calm, funny, sarcastic, caring, or brutally honest" },
  },
  {
    feature: "Quick checks from Siri",
    sub: '"What\'s due this week?" without opening the app',
    siri: { has: true as const, note: "Works — powered by Judith's built-in Siri Shortcuts" },
    judith: { has: true as const, note: "Works — Judith built those Shortcuts and keeps them updated" },
  },
  {
    feature: "Mark a bill paid by voice",
    sub: '"Hey Siri, mark my electricity bill as paid"',
    siri: { has: true as const, note: "Works via Judith's Siri integration" },
    judith: { has: true as const, note: "Works, and you can say it naturally inside the app too" },
  },
  {
    feature: "Add a new bill by voice",
    sub: '"Add my Netflix, $15, due on the 12th"',
    siri: { has: false as const, note: "Requires filling in each field separately through prompts" },
    judith: { has: true as const, note: "Say it once naturally — Judith parses the whole thing" },
  },
  {
    feature: "Business vs personal split",
    sub: "Know what's yours vs the company's",
    siri: { has: false as const, note: "No concept of business or personal tagging" },
    judith: { has: true as const, note: "Tag bills and see clean splits in Insights — perfect for expense tracking" },
  },
  {
    feature: "Apple Watch app",
    sub: "Bills and Ask on your wrist",
    siri: { has: "partial" as const, note: "Quick checks via Siri on Watch" },
    judith: { has: true as const, note: "Full Watch app — bill list, Ask Judith, mark paid, Watch complications" },
  },
];

const CONVOS = [
  {
    label: "Siri AI",
    dot: "bg-txt-low",
    nameColor: "text-txt-mid",
    borderClass: "",
    replyBg: "bg-surface-2",
    replyColor: "text-txt-low italic",
    exchanges: [
      { you: "How much do I still owe this month?", reply: "You have $840 unpaid across 4 bills." },
      { you: "What about just my personal ones?", reply: "Sorry, I'm not sure what you mean. Could you try rephrasing?" },
    ],
  },
  {
    label: "Judith",
    dot: "bg-accent",
    nameColor: "text-accent",
    borderClass: "border-accent/25",
    replyBg: "bg-accent/10",
    replyColor: "text-txt-hi",
    exchanges: [
      { you: "How much do I still owe this month?", reply: "$840 across 4 bills — $560 personal, $280 business." },
      { you: "What about just the personal ones?", reply: "Your personal bills total $560. The biggest is your credit card at $320, due in 3 days." },
    ],
  },
];

export default function VsSiri() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <Nav />
      <Hero />
      <ComparisonTable />
      <ConversationSection />
      <CtaSection />
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative px-5 pb-20 pt-36 sm:pt-44">
      <div className="bloom -left-32 top-16 h-[400px] w-[400px] bg-accent/20" />
      <div className="bloom right-0 top-48 h-[340px] w-[340px] bg-violet/10" />
      <div className="grain absolute inset-0 opacity-60" />

      <div className="relative mx-auto max-w-3xl text-center">
        <Reveal eager>
          <span className="inline-flex items-center gap-2 rounded-full border border-hair bg-surface-1/60 px-4 py-1.5 text-[12px] font-medium uppercase tracking-[0.18em] text-txt-mid backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Judith vs Siri AI
          </span>
        </Reveal>

        <Reveal eager delay={0.05}>
          <h1 className="mt-7 text-balance text-[36px] leading-[1.08] tracking-tight text-txt-hi sm:text-[56px]">
            Siri looks up your bills.{" "}
            <span className="font-display text-mint-grad">
              Judith remembers them.
            </span>
          </h1>
        </Reveal>

        <Reveal eager delay={0.12}>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-[16px] leading-relaxed text-txt-mid sm:text-[18px]">
            Siri AI can tell you what's scheduled — but it has no memory of
            what you've actually paid, no follow-up context, and no bill
            tracking of its own. Judith does all of that.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function ComparisonTable() {
  return (
    <section className="px-5 pb-24">
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <div className="overflow-hidden rounded-3xl border border-hair">
            <div className="grid grid-cols-[1fr_80px_80px] border-b border-hair bg-surface-1/60 px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-txt-low sm:grid-cols-[1fr_180px_180px]">
              <span>Capability</span>
              <span className="text-center">Siri AI</span>
              <span className="text-center text-accent">Judith</span>
            </div>

            {ROWS.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-[1fr_80px_80px] gap-x-2 px-5 py-4 sm:grid-cols-[1fr_180px_180px] ${
                  i !== ROWS.length - 1 ? "border-b border-hair" : ""
                } transition-colors hover:bg-surface-1/40`}
              >
                <div className="pr-4">
                  <p className="text-[14px] font-medium text-txt-hi">{row.feature}</p>
                  <p className="mt-0.5 text-[12px] text-txt-low">{row.sub}</p>
                </div>

                <div className="flex flex-col items-center gap-2 pt-0.5">
                  <StatusIcon has={row.siri.has} />
                  <p className="hidden text-center text-[11px] leading-snug text-txt-low sm:block">
                    {row.siri.note}
                  </p>
                </div>

                <div className="flex flex-col items-center gap-2 pt-0.5">
                  <StatusIcon has={row.judith.has} judith />
                  <p className="hidden text-center text-[11px] leading-snug text-txt-low sm:block">
                    {row.judith.note}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="mt-4 text-center text-[12px] text-txt-low">
            Siri quick-checks are powered by Judith's built-in Shortcuts integration — available free in the app.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function StatusIcon({ has, judith = false }: { has: boolean | "partial"; judith?: boolean }) {
  if (has === true) {
    return (
      <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${judith ? "bg-accent/15" : "bg-ok/10"}`}>
        <Check size={13} className={judith ? "text-accent" : "text-ok"} strokeWidth={2.5} />
      </div>
    );
  }
  if (has === "partial") {
    return (
      <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-near/10">
        <Minus size={13} className="text-near" strokeWidth={2.5} />
      </div>
    );
  }
  return (
    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-3">
      <X size={13} className="text-txt-low" strokeWidth={2} />
    </div>
  );
}

function ConversationSection() {
  return (
    <section className="px-5 pb-24">
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <div className="mb-12 text-center">
            <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">
              Real conversation
            </span>
            <h2 className="mt-4 text-balance text-[28px] leading-tight tracking-tight text-txt-hi sm:text-[40px]">
              One question is never enough.{" "}
              <span className="font-display text-mint-grad">Judith remembers.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-balance text-[16px] leading-relaxed text-txt-mid">
              Siri resets after every response. Judith holds the thread — so
              follow-up questions work the way they do in a real conversation.
            </p>
          </div>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2">
          {CONVOS.map((convo, ci) => (
            <Reveal key={convo.label} delay={ci * 0.08}>
              <div className={`card h-full p-6 ${convo.borderClass}`}>
                <div className="mb-5 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${convo.dot}`} />
                  <span className={`text-[13px] font-semibold ${convo.nameColor}`}>{convo.label}</span>
                </div>
                <div className="space-y-4">
                  {convo.exchanges.map((ex, ei) => (
                    <div key={ei} className="space-y-2">
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-surface-3 px-3.5 py-2.5 text-[13px] leading-relaxed text-txt-mid">
                          {ex.you}
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div className={`max-w-[90%] rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-[13px] leading-relaxed ${convo.replyBg} ${convo.replyColor}`}>
                          {ex.reply}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="relative px-5 pb-32 pt-8">
      <div className="bloom left-1/2 top-0 h-[360px] w-[360px] -translate-x-1/2 bg-accent/14" />
      <div className="relative mx-auto max-w-xl text-center">
        <Reveal>
          <Mic size={32} className="mx-auto mb-5 text-accent" />
          <h2 className="text-balance text-[28px] leading-tight tracking-tight text-txt-hi sm:text-[36px]">
            A bill tracker that{" "}
            <span className="font-display text-mint-grad">actually listens.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-sm text-balance text-[16px] leading-relaxed text-txt-mid">
            Download Judith free and see what a real conversation about your
            bills feels like.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <AppStoreBadge />
            <a
              href={`${import.meta.env.BASE_URL}#pricing`}
              className="inline-flex items-center gap-2 text-[14px] text-txt-mid transition-colors hover:text-txt-hi"
            >
              See pricing <ArrowRight size={14} />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
