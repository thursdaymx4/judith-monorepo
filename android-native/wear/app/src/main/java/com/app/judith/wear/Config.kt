package com.app.judith.wear

import androidx.compose.ui.graphics.Color

/**
 * The ONE file a non-coder should ever need to touch.
 *
 * - API base URL
 * - Theme colours
 * - Data Layer + SharedPreferences keys (must match the phone app)
 *
 * Nothing here requires a login: the watch receives its auth token from the
 * paired phone over the Wear Data Layer (see DataLayerListenerService).
 */
object Config {

    // ---- Backend ---------------------------------------------------------
    const val API_BASE = "https://judithforduedates.com/api/judith"

    // ---- Wear Data Layer contract (must match the phone app) ------------
    const val DATA_PATH = "/judith/watch-payload"
    const val KEY_PAYLOAD = "judith_payload_v2"
    const val KEY_TOKEN = "judith_watch_token"
    const val KEY_TS = "updated_at"

    // Watch -> phone action messages (mark paid / snooze), so the phone updates
    // its own store immediately — the Android analog of the iOS WCSession path.
    const val MSG_PATH = "/judith/watch-action"

    // ---- SharedPreferences (on-watch persistence) ----------------------
    const val PREFS_FILE = "judith.wear"
    const val PREF_PAYLOAD = "payload_v2"
    const val PREF_TOKEN = "watch_token"
    const val PREF_UPDATED_AT = "updated_at"
    const val PREF_STREAK = "streak"
}

/** Theme colours. Edit the hex values to re-skin the app. */
object JudithColors {
    val accent = Color(0xFF29D5A5)   // mint, primary
    val overdue = Color(0xFFEA1D3B)
    val urgent = Color(0xFFFF645F)
    val near = Color(0xFFF7B83D)
    val ok = Color(0xFF56D1A3)

    val surface1 = Color(0xFF181B22) // cards / rows / ring track
    val surface2 = Color(0xFF1F232C)

    val txtHi = Color(0xFFF3F5F8)
    val txtMid = Color(0xFFA7ADBA)
    val txtLow = Color(0xFF6A7180)

    val background = Color(0xFF000000)
}
