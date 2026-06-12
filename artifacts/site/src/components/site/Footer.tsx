import { Link } from "wouter";
import {
  PRIVACY_URL,
  TERMS_URL,
  SUPPORT_EMAIL,
} from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-hair bg-canvas">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div className="max-w-sm">
            <Link href="/" className="flex items-center gap-2.5">
              <img
                src={`${import.meta.env.BASE_URL}judith-icon.png`}
                alt="Judith"
                className="h-9 w-9 rounded-[10px]"
              />
              <span className="text-[20px] font-semibold tracking-tight text-txt-hi">
                Judith
              </span>
            </Link>
            <p className="mt-4 text-[14px] leading-relaxed text-txt-low">
              Every bill, balance, and due date in one place. The moment you
              wonder where you stand, you just ask.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <FooterCol title="Product">
              <FooterA href={`${import.meta.env.BASE_URL}#ask`}>
                How it works
              </FooterA>
              <FooterA href={`${import.meta.env.BASE_URL}#features`}>
                Features
              </FooterA>
              <FooterA href={`${import.meta.env.BASE_URL}#pricing`}>
                Pricing
              </FooterA>
            </FooterCol>
            <FooterCol title="Support">
              <FooterLink href="/support">Help &amp; FAQ</FooterLink>
              <FooterRaw href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </FooterRaw>
            </FooterCol>
            <FooterCol title="Legal">
              <FooterRaw href={PRIVACY_URL}>Privacy Policy</FooterRaw>
              <FooterRaw href={TERMS_URL}>Terms of Use</FooterRaw>
            </FooterCol>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-hair pt-7 text-[13px] text-txt-low sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Judith. All rights reserved.</p>
          <p>No ads. No selling your data.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-[12px] font-semibold uppercase tracking-widest text-txt-low">
        {title}
      </h4>
      <ul className="mt-4 space-y-3">{children}</ul>
    </div>
  );
}

function FooterA({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <a
        href={href}
        className="text-[14px] text-txt-mid transition-colors hover:text-accent"
      >
        {children}
      </a>
    </li>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="text-[14px] text-txt-mid transition-colors hover:text-accent"
      >
        {children}
      </Link>
    </li>
  );
}

function FooterRaw({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <a
        href={href}
        className="text-[14px] text-txt-mid transition-colors hover:text-accent"
      >
        {children}
      </a>
    </li>
  );
}
