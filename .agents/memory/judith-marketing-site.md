---
name: Judith marketing site
description: The standalone web artifact serving the App Store Marketing URL and Support URL.
---

# Judith marketing site (`artifacts/site`)

Standalone react-vite **web** artifact (no backend) created for App Store submission.

- **Marketing URL** = `/site/` (landing page)
- **Support URL** = `/site/support` (FAQ accordion + contact emails)
- Root `/` is owned by the expo `judith` artifact, so this site lives under `/site/`.
- Privacy/Terms are a SEPARATE artifact (`artifacts/privacy`): Privacy `/privacy/`, Terms `/privacy/?page=terms`. The site links to them with absolute paths.

## Base-path rule (load-bearing)
Because the artifact is mounted at `/site/`, **all in-app anchor/asset links must be base-aware**, or they escape the artifact and hit the domain root.
- Anchor links use `` `${import.meta.env.BASE_URL}#section` `` (= `/site/#section`), NOT `/#section`. This matters most when navigating from `/site/support` back to a landing-page section.
- Wouter base router: `base={import.meta.env.BASE_URL.replace(/\/$/, "")}` in `App.tsx`; route links like `/support` go through wouter `<Link>` and resolve correctly.
- `index.html` asset/meta image URLs (favicon, apple-touch-icon, og:image, twitter:image) can stay as `/judith-icon.png` — **Vite rewrites them to `/site/...` at build time** (verified in built `dist/public/index.html`), including the `meta content` attributes.

## Other notes
- `APP_STORE_URL` in `src/lib/site.ts` is a PLACEHOLDER (`https://apps.apple.com/app/judith`); update once the listing is live.
- Contact emails: support@judithforduedates.com, privacy@judithforduedates.com.
- Copy says "Five warm personas" to match the finalized App Store description (theme.ts actually has 6) — intentional.
- Money display uses whole-number pesos (e.g. ₱142,860) per Judith money-formatting convention.
- Keep the artifact lean: the react-vite scaffold ships a large shadcn/radix dep set + `src/components/ui` — this marketing site uses none of it. Unused UI scaffold and deps were removed; only react/react-dom, wouter, framer-motion, lucide-react, react-icons, tailwind + vite toolchain remain.
