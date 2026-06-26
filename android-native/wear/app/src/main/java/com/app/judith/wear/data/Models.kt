package com.app.judith.wear.data

import androidx.compose.ui.graphics.Color
import com.app.judith.wear.JudithColors
import kotlin.math.roundToInt

/**
 * Decoded as-is from the backend / phone payload. Field names MUST match the
 * JSON exactly. Defaults are provided so a partial payload won't crash Gson.
 */
data class WatchPayload(
    val generatedAt: String = "",
    val currency: String = "",
    val totalOwed: Double = 0.0,
    val unpaidCount: Int = 0,
    val nextProvider: String = "",
    val nextAmount: Double = 0.0,
    val nextDueDays: Int = 0,
    val nextDueLabel: String = "",
    val persona: String = "",
    val upcomingBills: List<UpcomingBill> = emptyList(),
    val paidCount: Int = 0,
    val totalCount: Int = 0,
    val paidAmount: Double? = null,
    val overdueCount: Int? = null,
    val overdueTotal: Double? = null,
    val next7Total: Double? = null,
    val aiConsented: Boolean? = null,
    /** Per-bill markers for the current month — drives the calendar screen.
     *  Additive/optional; empty for payloads from older phone builds. */
    val monthDueDays: List<DayMarker> = emptyList(),
) {
    val totalOwedDisplay: String get() = currency + totalOwed.roundToInt()
}

/** One bill's marker on the current-month calendar grid. Consumers collapse by
 *  `day`, taking the most-urgent unpaid, non-via-card entry per day. Mirrors the
 *  phone payload's DayMarker (lib/watch.ts). */
data class DayMarker(
    val day: Int = 0,
    val urgency: String = "ok",
    val paid: Boolean = false,
    val viaCard: Boolean = false,
)

data class UpcomingBill(
    val id: String = "",
    val provider: String = "",
    val cat: String? = null,
    val amount: Double = 0.0,
    val dueDays: Int = 0,
    val dueLabel: String = "",
    val isOverdue: Boolean = false,
    val optimisticTotalOwedDelta: Double = 0.0,
    val optimisticUnpaidCountDelta: Int = 0,
)

/** currency + rounded amount, e.g. "₱4500". */
fun amountDisplay(currency: String, amount: Double): String =
    currency + amount.roundToInt()

// ---- Display helpers -----------------------------------------------------

fun dueLabelShort(dueDays: Int): String = when {
    dueDays == 0 -> "Today"
    dueDays < 0 -> "${-dueDays}d late"
    dueDays == 1 -> "Tomorrow"
    else -> "${dueDays}d"
}

fun dueSubtitle(dueDays: Int): String = when {
    dueDays == 0 -> "Due today"
    dueDays < 0 -> {
        val d = -dueDays
        if (d == 1) "1 day overdue" else "$d days overdue"
    }
    dueDays == 1 -> "Due tomorrow"
    else -> "Due in $dueDays days"
}

// ---- Urgency model -------------------------------------------------------

enum class Urgency(val color: Color, val label: String) {
    OVERDUE(JudithColors.overdue, "Overdue"),
    URGENT(JudithColors.urgent, "Due soon"),
    NEAR(JudithColors.near, "Coming up"),
    OK(JudithColors.ok, "Upcoming");
}

fun urgencyFor(dueDays: Int): Urgency = when {
    dueDays < 0 -> Urgency.OVERDUE
    dueDays <= 3 -> Urgency.URGENT
    dueDays <= 7 -> Urgency.NEAR
    else -> Urgency.OK
}

/** Maps a payload urgency string (overdue/urgent/near/ok) to its colour. */
fun urgencyColorByName(name: String): Color = when (name) {
    "overdue" -> JudithColors.overdue
    "urgent" -> JudithColors.urgent
    "near" -> JudithColors.near
    else -> JudithColors.ok
}

/**
 * Due-label colour for the Up-next ROW only: the OK case is muted to txtMid,
 * everything else uses the urgency colour.
 */
fun rowDueLabelColor(dueDays: Int): Color {
    val u = urgencyFor(dueDays)
    return if (u == Urgency.OK) JudithColors.txtMid else u.color
}

// ---- Ask conversation ----------------------------------------------------

data class ChatTurn(val role: String, val text: String) // role: "user" | "assistant"

data class AskResult(
    val answer: String? = null,
    val actions: List<AskAction>? = null,
    val error: String? = null,
    /** The raw `actions` JSON array from /watch-ask, forwarded verbatim to the
     *  phone so it can apply the full action vocabulary (add_bill, add_payment,
     *  update_amount, update_bill, mark_paid — single or multiple) via its own
     *  applyJudithAction. Set manually in BackendClient (not from Gson). */
    val rawActions: String? = null,
)

data class AskAction(val type: String = "", val id: String? = null)
