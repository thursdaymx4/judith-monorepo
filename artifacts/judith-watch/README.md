# Judith for Apple Watch

A native watchOS companion app for Judith. Mark bills paid from your wrist, glance at
what's due, and stay on top of late Fix - t without opening the phone.

## Targets

| Target | Description |
|---|---|
| `JudithWatch` | Watch App (SwiftUI) — all 6 screens |
| `JudithWatchWidget` | WidgetKit — face complications + Smart Stack widget |

## Setup in Xcode

### Prerequisites
- Xcode 15+
- Apple Developer account (required for App Groups capability)
- Supabase project already running (same one the phone app uses)

### 1. Generate the native iOS project

The Expo project needs a custom dev build to support WatchConnectivity:
```bash
cd artifacts/judith
npx expo prebuild --platform ios
open ios/Judith.xcworkspace
```

### 2. Add the Watch App target

File → New → Target → watchOS → **Watch App**
- Product Name: `JudithWatch`
- Bundle Identifier: `com.yourteam.judith.watchkitapp`
- Language: Swift, Interface: SwiftUI
- ✅ Include Notification Scene

### 3. Add the Widget Extension target

File → New → Target → watchOS → **Widget Extension**
- Product Name: `JudithWatchWidget`
- Bundle Identifier: `com.yourteam.judith.watchkitapp.widget`
- ✅ Include Configuration Intent

### 4. Enable App Groups on all 3 targets

Select each target → **Signing & Capabilities → + App Groups**
- Group ID: `group.com.judith.app`

This shared container carries the bill cache + offline action queue between the
phone app, watch app, and widget.

### 5. Add Supabase credentials

Edit `JudithWatch/Config/Config.swift`:
```swift
static let supabaseURL   = "https://YOUR_PROJECT.supabase.co"
static let supabaseAnonKey = "YOUR_ANON_KEY"          // public, safe to embed
```

Both values are the same ones in your `.env` as `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY`.

### 6. Copy source files

Drag all files from `artifacts/judith-watch/JudithWatch/` into the `JudithWatch`
Xcode target, and all files from `JudithWatchWidget/` into `JudithWatchWidget`.

### 7. Build & run

Choose the **JudithWatch** scheme, pick an Apple Watch Simulator (45mm recommended),
and hit ▶.

---

## Data flow

```
Phone (Expo + react-native-watch-connectivity)
        │  WCSession.transferUserInfo({ access_token })
        ▼
ConnectivityService ──▶ BillStore ──▶ SwiftUI views
                             │
                   Supabase REST API   ◀── mark-paid / snooze
                             │
                   App Group cache (offline queue)
```

The watch receives the JWT from the phone once on first install. Subsequent refreshes
hit Supabase directly. Mark-paid writes go straight to Supabase; if offline they queue
in the App Group UserDefaults and flush on reconnect.

### Adding WatchConnectivity to the phone app

```bash
pnpm --filter @workspace/judith add react-native-watch-connectivity
```

Then send the session after sign-in (e.g. in `AuthContext.tsx`):
```ts
import WC from 'react-native-watch-connectivity';
if (session?.access_token) {
  WC.transferUserInfo({ access_token: session.access_token });
}
```

---

## Design tokens (from `constants/theme.ts`)

| Token | Hex |
|---|---|
| Background | `#000000` (OLED) |
| Surface 1 | `#181b22` |
| Surface 2 | `#1f232c` |
| Accent (mint) | `#29d5a5` |
| Overdue | `#ea1d3b` |
| Urgent | `#ff645f` |
| Near | `#f7b83d` |
| OK / Paid | `#56d1a3` |

---

## Screens

1. **Watch face complication** — large (next due + count/total) + corner (due-count ring)
2. **Long-look notification** — bill due reminder with inline Mark Paid / Remind Tomorrow
3. **Up Next list** — Digital Crown scrollable, urgency dots, overdue in red
4. **Bill detail** — Mark Paid (primary) + Snooze 1 Day
5. **Paid confirmation** — mint checkmark + streak nudge, auto-returns
6. **Smart Stack widget** — rises in stack as due date nears (WidgetKit relevance)
