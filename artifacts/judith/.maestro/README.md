# Maestro flows for Judith

YAML scripts that drive the app's UI on the iOS Simulator (or a real
device on the same network) and assert against visible text. Run them
before each archive so the same class of regressions we fixed manually
on 2026-06-11 gets caught automatically next time.

## One-time setup

```sh
curl -Ls "https://get.maestro.mobile.dev" | bash
echo 'export PATH="$PATH:$HOME/.maestro/bin"' >> ~/.zshrc
source ~/.zshrc
maestro --version    # confirm install
```

## Running the flows

Boot a simulator first (or plug in a device) and install the build you
want to validate (TestFlight build, EAS preview build, or local archive
running on the simulator).

```sh
cd artifacts/judith
maestro test .maestro/                       # run all flows
maestro test .maestro/00-smoke.yaml          # just smoke
maestro test .maestro/01-ask-judith.yaml     # Ask Judith round-trip
maestro test .maestro/02-tab-navigation.yaml # tab render check
```

`maestro studio` opens a live inspector you can use to grab element
ids / accessibility labels when adding new flows.

## What each flow guards

| Flow | Catches |
|---|---|
| `00-smoke.yaml` | App fails to boot, splash hangs, missing native module, JS crash on launch |
| `01-ask-judith.yaml` | Ask returns generic server-error message, reply never arrives, bundle ships broken `/ask` path |
| `02-tab-navigation.yaml` | A tab screen white-screens or kicks the user back to Home |

## Adding new flows

Prefer matching by visible text or `accessibilityLabel` over coords or
testIDs — they're more resilient to redesigns. When a screen has no
stable text yet, add an `accessibilityLabel` on the element and target
that instead of taking screenshots. Sample matchers:

```yaml
- tapOn: "Mark paid"                 # visible text
- tapOn:
    accessibilityText: "Clear chat"  # a11y label
- tapOn:
    id: "fab-ask"                    # explicit testID (we don't use these yet)
```
