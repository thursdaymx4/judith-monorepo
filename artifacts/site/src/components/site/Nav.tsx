import { useState } from "react";
import { Link } from "wouter";
import { Menu, X } from "lucide-react";
import { FaApple } from "react-icons/fa";
import { APP_STORE_URL } from "@/lib/site";

// BASE_URL is "/site/" — anchor links must be base-aware so they work from
// any route (e.g. /site/support → /site/#pricing), not just the landing page.
const BASE = import.meta.env.BASE_URL;

const LINKS = [
  { label: "How it works", href: `${BASE}#ask`, hash: true },
  { label: "Features", href: `${BASE}#features`, hash: true },
  { label: "Pricing", href: `${BASE}#pricing`, hash: true },
  { label: "What's New", href: "/changelog", hash: false },
  { label: "Support", href: "/support", hash: false },
];

function Wordmark() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5"
      aria-label="Judith home"
    >
      <img
        src={`${import.meta.env.BASE_URL}judith-icon.png`}
        alt="Judith"
        className="h-9 w-9 rounded-[10px]"
      />
      <span className="text-[20px] font-semibold tracking-tight text-txt-hi">
        Judith
      </span>
    </Link>
  );
}

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-4">
        <div className="flex items-center gap-3 rounded-2xl border border-hair bg-canvas/70 px-4 py-2.5 backdrop-blur-xl">
          <Wordmark />
        </div>

        <nav className="hidden items-center gap-1 rounded-2xl border border-hair bg-canvas/70 px-2 py-2 backdrop-blur-xl md:flex">
          {LINKS.map((l) =>
            l.hash ? (
              <a
                key={l.label}
                href={l.href}
                className="rounded-xl px-3.5 py-2 text-[14px] text-txt-mid transition-colors hover:bg-surface-2 hover:text-txt-hi"
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.label}
                href={l.href}
                className="rounded-xl px-3.5 py-2 text-[14px] text-txt-mid transition-colors hover:bg-surface-2 hover:text-txt-hi"
              >
                {l.label}
              </Link>
            ),
          )}
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[14px] font-semibold text-on-accent transition-transform hover:-translate-y-0.5"
          >
            <FaApple className="text-[15px]" /> Get Judith
          </a>
        </nav>

        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl border border-hair bg-canvas/70 p-3 backdrop-blur-xl md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
          aria-controls="mobile-menu"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <div
          id="mobile-menu"
          className="mx-5 rounded-2xl border border-hair bg-surface-1/95 p-3 backdrop-blur-xl md:hidden"
        >
          {LINKS.map((l) =>
            l.hash ? (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-4 py-3 text-[15px] text-txt-mid hover:bg-surface-2 hover:text-txt-hi"
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-4 py-3 text-[15px] text-txt-mid hover:bg-surface-2 hover:text-txt-hi"
              >
                {l.label}
              </Link>
            ),
          )}
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-[15px] font-semibold text-on-accent"
          >
            <FaApple /> Get Judith
          </a>
        </div>
      )}
    </header>
  );
}
