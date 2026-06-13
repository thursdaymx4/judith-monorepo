import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-canvas px-6 text-center">
      <div className="bloom left-1/2 top-1/2 h-[360px] w-[420px] -translate-x-1/2 -translate-y-1/2 bg-accent/20" />
      <p className="relative font-mono text-[15px] uppercase tracking-[0.3em] text-accent">
        404
      </p>
      <h1 className="relative mt-4 text-balance text-[34px] leading-tight tracking-tight text-txt-hi sm:text-[44px]">
        This page isn't on{" "}
        <span className="font-display text-mint-grad">Judith's</span> radar.
      </h1>
      <p className="relative mt-4 max-w-md text-[16px] leading-relaxed text-txt-mid">
        The page you're looking for doesn't exist. Let's get you back to where
        the numbers make sense.
      </p>
      <Link
        href="/"
        className="relative mt-8 inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-3.5 text-[15px] font-semibold text-on-accent transition-transform hover:-translate-y-0.5"
      >
        <ArrowLeft size={16} /> Back to home
      </Link>
    </div>
  );
}
