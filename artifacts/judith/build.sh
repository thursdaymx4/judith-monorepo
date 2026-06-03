#!/bin/bash
# Judith build helper
# Run this from your Mac instead of eas build directly.
# It auto-fixes app.json, eas.json, and removes problem packages before building.
# Usage: bash build.sh [ios|android|all]  (default: all)

set -e
PLATFORM="${1:-all}"
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "==> Syncing app.json..."
cat > app.json << 'APPJSON'
{
  "expo": {
    "name": "Judith",
    "slug": "judith",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "judith",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/images/icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.app.judith",
      "buildNumber": "5"
    },
    "android": {
      "package": "com.judith.app",
      "versionCode": 5
    },
    "web": {
      "favicon": "./assets/images/icon.png"
    },
    "plugins": [
      [
        "expo-router",
        {
          "origin": "https://replit.com/"
        }
      ],
      "expo-font",
      "expo-web-browser",
      [
        "expo-audio",
        {
          "microphonePermission": "Pinapayagan ang Judith na gamitin ang mikropono para marinig ang mga tanong mo."
        }
      ],
      "expo-notifications"
    ],
    "experiments": {
      "typedRoutes": true,
      "reactCompiler": true
    }
  }
}
APPJSON

echo "==> Syncing eas.json..."
cat > eas.json << 'EASJSON'
{
  "cli": {
    "version": ">= 16.0.0",
    "appVersionSource": "local"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "buildConfiguration": "Release"
      },
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://prbistbxadydyuxdaaex.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByYmlzdGJ4YWR5ZHl1eGRhYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMDQ5MDMsImV4cCI6MjA5NTc4MDkwM30.JnpGqE2SXABHSdvyz5iE8kuhS7HId0GDEiGbNKtVqUU"
      }
    },
    "production": {
      "ios": {
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_NO_CAPABILITY_SYNC": "1",
        "EXPO_PUBLIC_SUPABASE_URL": "https://prbistbxadydyuxdaaex.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByYmlzdGJ4YWR5ZHl1eGRhYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMDQ5MDMsImV4cCI6MjA5NTc4MDkwM30.JnpGqE2SXABHSdvyz5iE8kuhS7HId0GDEiGbNKtVqUU"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "language": "en-US",
        "appleTeamId": "88JK8X8BT7"
      }
    }
  }
}
EASJSON

echo "==> Removing incompatible packages..."
if grep -q "react-native-watch-connectivity" package.json 2>/dev/null; then
  pnpm remove react-native-watch-connectivity
  echo "    Removed react-native-watch-connectivity"
else
  echo "    Already clean"
fi

echo "==> Starting EAS build (platform: $PLATFORM)..."
EXPO_NO_CAPABILITY_SYNC=1 eas build --platform "$PLATFORM" --profile preview
