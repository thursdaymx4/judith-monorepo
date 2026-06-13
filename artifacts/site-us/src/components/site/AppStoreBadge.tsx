import { FaApple } from "react-icons/fa";
import { APP_STORE_URL } from "@/lib/site";

export function AppStoreBadge({ className = "" }: { className?: string }) {
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`group inline-flex items-center gap-3 rounded-2xl bg-white px-5 py-3 text-on-accent transition-transform duration-200 hover:-translate-y-0.5 ${className}`}
    >
      <FaApple className="text-[28px] text-black" />
      <span className="flex flex-col leading-none">
        <span className="text-[11px] font-medium tracking-wide text-black/70">
          Download on the
        </span>
        <span className="text-[19px] font-semibold tracking-tight text-black">
          App Store
        </span>
      </span>
    </a>
  );
}
