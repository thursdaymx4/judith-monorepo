package com.app.judith.wear.data

import android.content.Context
import android.content.SharedPreferences
import com.app.judith.wear.Config

/** Thin wrapper around the single SharedPreferences file used on the watch. */
object Prefs {

    fun get(context: Context): SharedPreferences =
        context.getSharedPreferences(Config.PREFS_FILE, Context.MODE_PRIVATE)

    fun token(context: Context): String? =
        get(context).getString(Config.PREF_TOKEN, null)?.takeIf { it.isNotBlank() }

    fun payloadJson(context: Context): String? =
        get(context).getString(Config.PREF_PAYLOAD, null)?.takeIf { it.isNotBlank() }

    fun updatedAt(context: Context): Long =
        get(context).getLong(Config.PREF_UPDATED_AT, 0L)

    fun streak(context: Context): Int =
        get(context).getInt(Config.PREF_STREAK, 0)

    fun setStreak(context: Context, value: Int) {
        get(context).edit().putInt(Config.PREF_STREAK, value).apply()
    }

    fun setPayloadJson(context: Context, json: String, updatedAt: Long) {
        get(context).edit()
            .putString(Config.PREF_PAYLOAD, json)
            .putLong(Config.PREF_UPDATED_AT, updatedAt)
            .apply()
    }

    /**
     * Persist an optimistic local mutation (payload + streak) in ONE edit, so
     * the OnSharedPreferenceChangeListener fires a single, internally-consistent
     * reload instead of two — which would otherwise re-read the old streak
     * between the two commits and flicker the UI.
     */
    fun setOptimistic(context: Context, json: String, updatedAt: Long, streak: Int) {
        get(context).edit()
            .putString(Config.PREF_PAYLOAD, json)
            .putLong(Config.PREF_UPDATED_AT, updatedAt)
            .putInt(Config.PREF_STREAK, streak)
            .apply()
    }

    /** Called by the Data Layer listener when the phone pushes new data. */
    fun storeFromPhone(context: Context, payloadJson: String?, token: String?, ts: Long) {
        val e = get(context).edit()
        if (!payloadJson.isNullOrBlank()) e.putString(Config.PREF_PAYLOAD, payloadJson)
        if (!token.isNullOrBlank()) e.putString(Config.PREF_TOKEN, token)
        if (ts > 0) e.putLong(Config.PREF_UPDATED_AT, ts)
        e.apply()
    }
}
