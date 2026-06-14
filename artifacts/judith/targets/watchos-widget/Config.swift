import SwiftUI

// MARK: — App Group + cache keys (must match the watch app target)
// Duplicated from targets/watchos/Config.swift on purpose: each Xcode target
// compiles its own sources, so the extension can't import from the watch app.

enum Config {
    static let appGroupID      = "group.com.app.judith"
    static let payloadCacheKey = "judith.payload_v2"
}

// MARK: — Design tokens (mirrors constants/theme.ts and the watch app)

extension Color {
    static let judithAccent  = Color(hex: "#29d5a5")
    static let judithOverdue = Color(hex: "#ea1d3b")
    static let judithUrgent  = Color(hex: "#ff645f")
    static let judithNear    = Color(hex: "#f7b83d")
    static let judithOK      = Color(hex: "#56d1a3")

    init(hex: String) {
        let h = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: h).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8)  & 0xFF) / 255
        let b = Double(int         & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
