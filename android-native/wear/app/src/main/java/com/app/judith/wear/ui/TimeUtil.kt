package com.app.judith.wear.ui

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/** Returns a short "Updated …" relative string from an epoch-millis timestamp. */
fun relativeUpdated(epochMillis: Long): String {
    if (epochMillis <= 0L) return "Updated —"
    val diff = System.currentTimeMillis() - epochMillis
    val mins = diff / 60_000
    return when {
        mins < 1 -> "Updated just now"
        mins < 60 -> "Updated ${mins}m ago"
        mins < 1440 -> "Updated ${mins / 60}h ago"
        else -> "Updated ${mins / 1440}d ago"
    }
}

/** True when the data is older than 6 hours. */
fun isStale(epochMillis: Long): Boolean {
    if (epochMillis <= 0L) return true
    return System.currentTimeMillis() - epochMillis > 6L * 60 * 60 * 1000
}

/** Tomorrow as yyyy-MM-dd in the device's default locale/timezone. */
fun tomorrowIso(): String {
    val cal = Calendar.getInstance()
    cal.add(Calendar.DAY_OF_YEAR, 1)
    return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cal.time)
}
