import SwiftUI

enum Config {
    // MARK: — Supabase (fill these in — same values as EXPO_PUBLIC_SUPABASE_URL/ANON_KEY)
    static let supabaseURL    = "https://YOUR_PROJECT.supabase.co"
    static let supabaseAnonKey = "YOUR_ANON_KEY"

    // MARK: — App Group (must match the capability you added in Xcode)
    static let appGroupID = "group.com.judith.app"

    // MARK: — UserDefaults keys (shared via App Group)
    static let billsCacheKey        = "judith.bills_cache"
    static let sessionTokenKey      = "judith.session_token"
    static let pendingActionsKey    = "judith.pending_actions"
    static let streakKey            = "judith.streak"
}

// MARK: — Design tokens (mirrors constants/theme.ts)
extension Color {
    static let judithAccent  = Color(hex: "#29d5a5")
    static let judithOverdue = Color(hex: "#ea1d3b")
    static let judithUrgent  = Color(hex: "#ff645f")
    static let judithNear    = Color(hex: "#f7b83d")
    static let judithOK      = Color(hex: "#56d1a3")
    static let surface1      = Color(hex: "#181b22")
    static let surface2      = Color(hex: "#1f232c")
    static let txtHi         = Color(hex: "#f3f5f8")
    static let txtMid        = Color(hex: "#a7adba")
    static let txtLow        = Color(hex: "#6a7180")
}

extension Color {
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

extension Font {
    static let judithMono = Font.system(.body, design: .monospaced, weight: .semibold)
    static let judithMonoLarge = Font.system(.title2, design: .monospaced, weight: .bold)
}
