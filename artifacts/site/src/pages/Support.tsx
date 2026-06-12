import { useState } from "react";
import { ChevronDown, Mail, ArrowLeft, LifeBuoy } from "lucide-react";
import { Link } from "wouter";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { Reveal } from "@/components/site/Reveal";
import {
  SUPPORT_EMAIL,
  PRIVACY_EMAIL,
  PRIVACY_URL,
  TERMS_URL,
} from "@/lib/site";

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "How does Judith know my balances?",
    a: "You enter what you owe from your latest statement, and Judith keeps it all in one place. She doesn't connect to your bank — you stay in control of every number, and nothing leaves your hands to a third party.",
  },
  {
    q: "Do I need a subscription to use Judith?",
    a: "No. Judith is a paid app — one purchase gives you full bill tracking, smart reminders, the monthly calendar, Home Screen widgets, the Apple Watch app, and a set of asks to start. Subscriptions are only for unlimited asking.",
  },
  {
    q: "What's the difference between Chat Ask and Voice Ask?",
    a: "Chat Ask gives you unlimited text questions to Judith, anytime. Voice Ask includes everything in Chat Ask, plus the ability to speak your questions and hear Judith answer out loud — on both your phone and Apple Watch.",
  },
  {
    q: "How do I manage or cancel a subscription?",
    a: "Subscriptions are handled by Apple. On your iPhone, open Settings → tap your name → Subscriptions → Judith, then change or cancel. You can cancel anytime with no hidden fees, and you'll keep access until the end of your current period.",
  },
  {
    q: "How do I restore a purchase on a new device?",
    a: "Sign in with the same Apple ID you used to buy Judith, then use Restore Purchases inside the app. Your paid app and any active subscription will be restored automatically.",
  },
  {
    q: "How do I add the widgets and the Apple Watch app?",
    a: "For widgets, touch and hold your Home Screen, tap the + in the corner, search for Judith, and choose a size. The Apple Watch app installs from the Watch app on your iPhone — open it, scroll to Judith, and tap Install.",
  },
  {
    q: "Can I separate personal and business bills?",
    a: "Yes. Tag each bill as personal or business and Judith shows you a clean, instant split — so you always know what's yours and what belongs to the company.",
  },
  {
    q: "What languages does Judith understand?",
    a: "Judith answers in your language. Ask naturally by voice or text, and you'll get a plain-language reply in seconds.",
  },
  {
    q: "Is my financial data private?",
    a: (
      <>
        Yes. There are no ads and we never sell your data. For the full details,
        read our{" "}
        <a href={PRIVACY_URL} className="text-accent underline-offset-2 hover:underline">
          Privacy Policy
        </a>
        .
      </>
    ),
  },
];

export default function Support() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <Nav />

      <section className="relative px-5 pb-20 pt-36 sm:pt-44">
        <div className="bloom -left-32 top-10 h-[380px] w-[380px] bg-accent/20" />
        <div className="relative mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-hair bg-surface-1/60 px-4 py-1.5 text-[12px] font-medium uppercase tracking-[0.18em] text-txt-mid backdrop-blur">
              <LifeBuoy size={13} className="text-accent" /> Support
            </span>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="mt-7 text-balance text-[36px] leading-tight tracking-tight text-txt-hi sm:text-[52px]">
              How can we{" "}
              <span className="font-display text-mint-grad">help</span>?
            </h1>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed text-txt-mid sm:text-[17px]">
              Answers to the most common questions are below. If you can't find
              what you need, reach us directly — we read every message.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-8 inline-flex items-center gap-2.5 rounded-2xl bg-accent px-5 py-3.5 text-[15px] font-semibold text-on-accent transition-transform hover:-translate-y-0.5"
            >
              <Mail size={17} /> Email support
            </a>
          </Reveal>
        </div>
      </section>

      <section className="relative px-5 pb-8">
        <div className="mx-auto max-w-3xl">
          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <Reveal key={item.q} delay={Math.min(i, 5) * 0.04}>
                <FaqItem q={item.q} a={item.a} id={`faq-${i}`} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-5 py-16">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <div className="card p-8 text-center sm:p-10">
              <h2 className="text-[24px] font-semibold tracking-tight text-txt-hi sm:text-[28px]">
                Still need a hand?
              </h2>
              <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-txt-mid">
                Send us the details and we'll get back to you. For privacy
                requests, use the dedicated address below.
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <ContactCard
                  label="General support"
                  email={SUPPORT_EMAIL}
                />
                <ContactCard
                  label="Privacy requests"
                  email={PRIVACY_EMAIL}
                />
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[14px]">
                <a
                  href={PRIVACY_URL}
                  className="text-txt-mid transition-colors hover:text-accent"
                >
                  Privacy Policy
                </a>
                <a
                  href={TERMS_URL}
                  className="text-txt-mid transition-colors hover:text-accent"
                >
                  Terms of Use
                </a>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 text-txt-mid transition-colors hover:text-accent"
                >
                  <ArrowLeft size={14} /> Back to home
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function FaqItem({
  q,
  a,
  id,
}: {
  q: string;
  a: React.ReactNode;
  id: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card-tight overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
      >
        <span className="text-[16px] font-medium text-txt-hi">{q}</span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-txt-low transition-transform duration-300 ${
            open ? "rotate-180 text-accent" : ""
          }`}
        />
      </button>
      <div
        id={`${id}-panel`}
        role="region"
        className={`grid transition-all duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-[15px] leading-relaxed text-txt-mid">
            {a}
          </p>
        </div>
      </div>
    </div>
  );
}

function ContactCard({ label, email }: { label: string; email: string }) {
  return (
    <a
      href={`mailto:${email}`}
      className="group flex w-full items-center gap-3 rounded-2xl border border-hair bg-surface-2 px-5 py-4 text-left transition-colors hover:border-accent/40 sm:w-auto"
    >
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface-3 text-accent">
        <Mail size={17} />
      </div>
      <div>
        <p className="text-[12px] uppercase tracking-wide text-txt-low">
          {label}
        </p>
        <p className="text-[14px] font-medium text-txt-hi group-hover:text-accent">
          {email}
        </p>
      </div>
    </a>
  );
}
