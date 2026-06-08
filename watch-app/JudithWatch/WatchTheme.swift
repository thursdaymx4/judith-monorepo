// WatchTheme.swift — Judith watch tokens. Black OLED background, mint accent,
// urgency colors identical to the phone app, tabular (monospaced) numbers.
import SwiftUI

enum WatchTheme {
    // Brand mint — oklch(0.78 0.15 168) → #29d5a5 (LOCKED, matches phone).
    static let accent  = Color(red: 0x29 / 255, green: 0xd5 / 255, blue: 0xa5 / 255)
    // Urgency scale (matches phone tokens).
    static let overdue = Color(red: 0xea / 255, green: 0x1d / 255, blue: 0x3b / 255)
    static let urgent  = Color(red: 0xff / 255, green: 0x64 / 255, blue: 0x5f / 255)
    static let near    = Color(red: 0xf7 / 255, green: 0xb8 / 255, blue: 0x3d / 255)
    static let ok      = Color(red: 0x56 / 255, green: 0xd1 / 255, blue: 0xa3 / 255)

    static let canvas  = Color.black            // OLED — saves battery, watch convention
    static let surface = Color(white: 0.10)
    static let hair     = Color(white: 1.0, opacity: 0.10)
    static let textHi  = Color.white
    static let textMid = Color(white: 0.66)
    static let textLow = Color(white: 0.42)

    /// Tabular figures for all money/number displays.
    static func mono(_ size: CGFloat, _ weight: Font.Weight = .bold) -> Font {
        .system(size: size, weight: weight, design: .rounded).monospacedDigit()
    }
}
