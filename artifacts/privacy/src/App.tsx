import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfUse from "./pages/TermsOfUse";
import type { LegalPage } from "./components/legal";

function currentPage(): LegalPage {
  if (typeof window === "undefined") return "privacy";
  const { pathname, search } = window.location;
  const param = new URLSearchParams(search).get("page");
  if (param === "terms") return "terms";
  if (param === "privacy") return "privacy";
  return pathname.toLowerCase().replace(/\/+$/, "").endsWith("/terms") ? "terms" : "privacy";
}

export default function App() {
  return currentPage() === "terms" ? <TermsOfUse /> : <PrivacyPolicy />;
}
