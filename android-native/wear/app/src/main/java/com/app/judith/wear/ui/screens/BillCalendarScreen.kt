package com.app.judith.wear.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Text
import com.app.judith.wear.JudithColors
import com.app.judith.wear.data.BillStore
import com.app.judith.wear.data.UpcomingBill
import com.app.judith.wear.data.amountDisplay
import com.app.judith.wear.data.urgencyColorByName
import com.app.judith.wear.data.urgencyFor
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

// Most-severe-first, for collapsing multiple bills on one day.
private val SEVERITY = listOf("overdue", "urgent", "near", "ok")

/**
 * Month-grid bill calendar — the watch counterpart of the phone calendar widget.
 * Styled to match: a "JUDITH" brand header, this-month total, a surface card
 * holding the colour-coded grid, then a per-date agenda ("how much is due on
 * which day") that taps through to the bill detail.
 */
@Composable
fun BillCalendarScreen(store: BillStore, onBill: (String) -> Unit) {
    val payload by store.payload.collectAsState()
    val p = payload ?: return
    val listState = rememberScalingLazyListState()

    // Collapse markers → per-day urgency (unpaid, non-via-card) + paid set.
    val urgencyByDay = HashMap<Int, String>()
    val paidDays = HashSet<Int>()
    p.monthDueDays.forEach { m ->
        if (m.day < 1) return@forEach
        if (m.paid) { paidDays.add(m.day); return@forEach }
        if (m.viaCard) return@forEach
        val prev = urgencyByDay[m.day]
        if (prev == null || SEVERITY.indexOf(m.urgency) < SEVERITY.indexOf(prev)) {
            urgencyByDay[m.day] = m.urgency
        }
    }

    val cal = Calendar.getInstance()
    val today = cal.get(Calendar.DAY_OF_MONTH)
    val first = Calendar.getInstance().apply {
        set(cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), 1)
    }
    val offset = first.get(Calendar.DAY_OF_WEEK) - Calendar.SUNDAY
    val dim = first.getActualMaximum(Calendar.DAY_OF_MONTH)
    val monthLabel = SimpleDateFormat("MMMM yyyy", Locale.US).format(cal.time)
    val overdueTotal = p.overdueTotal ?: 0.0

    ScalingLazyColumn(
        modifier = Modifier.fillMaxSize().background(JudithColors.background),
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Brand + this-month total header.
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(JudithColors.surface1, RoundedCornerShape(16.dp))
                    .padding(horizontal = 12.dp, vertical = 10.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "JUDITH",
                        color = JudithColors.accent,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.4.sp,
                    )
                    Spacer(Modifier.weight(1f))
                    Text(monthLabel, color = JudithColors.txtMid, fontSize = 11.sp)
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    "DUE THIS MONTH",
                    color = JudithColors.txtLow,
                    fontSize = 9.sp,
                    letterSpacing = 0.8.sp,
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        p.totalOwedDisplay,
                        color = JudithColors.txtHi,
                        fontSize = 20.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                    )
                    if (overdueTotal > 0) {
                        Spacer(Modifier.width(8.dp))
                        Text(
                            "${amountDisplay(p.currency, overdueTotal)} late",
                            color = JudithColors.overdue,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                        )
                    }
                }
            }
        }

        // Month grid inside a surface card (echoes the phone widget card).
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(JudithColors.surface1, RoundedCornerShape(16.dp))
                    .padding(horizontal = 8.dp, vertical = 10.dp),
            ) {
                Row(Modifier.fillMaxWidth()) {
                    listOf("S", "M", "T", "W", "T", "F", "S").forEach { d ->
                        Text(
                            d,
                            color = JudithColors.txtLow,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Medium,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                Spacer(Modifier.height(2.dp))
                var day = 1 - offset
                for (week in 0 until 6) {
                    if (day > dim) break
                    Row(Modifier.fillMaxWidth()) {
                        for (col in 0 until 7) {
                            val d = day
                            Box(
                                modifier = Modifier.weight(1f).aspectRatio(1f).padding(1.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                if (d in 1..dim) {
                                    DayCell(d, urgencyByDay[d], paidDays.contains(d), d == today)
                                }
                            }
                            day++
                        }
                    }
                }
            }
        }

        // Per-date agenda — "how much is due, and when", at a glance.
        if (p.upcomingBills.isEmpty()) {
            item {
                Box(
                    modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("All paid up", color = JudithColors.txtMid, fontSize = 14.sp)
                }
            }
        } else {
            items(p.upcomingBills, key = { it.id }) { bill ->
                AgendaRow(bill = bill, currency = p.currency) { onBill(bill.id) }
            }
        }
    }
}

@Composable
private fun DayCell(day: Int, urgency: String?, paid: Boolean, isToday: Boolean) {
    val bgMod = when {
        urgency != null ->
            Modifier.background(urgencyColorByName(urgency).copy(alpha = 0.30f), CircleShape)
        isToday -> Modifier.border(1.5.dp, JudithColors.accent, CircleShape)
        else -> Modifier
    }
    val textColor = when {
        urgency != null -> JudithColors.txtHi
        isToday -> JudithColors.accent
        paid -> JudithColors.txtLow
        else -> JudithColors.txtMid
    }
    Box(
        modifier = Modifier.fillMaxSize().then(bgMod),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            "$day",
            color = textColor,
            fontSize = 11.sp,
            fontWeight = if (urgency != null || isToday) FontWeight.Bold else FontWeight.Normal,
        )
    }
}

/** A due date with its amount: date chip + provider + amount, urgency-coloured. */
@Composable
private fun AgendaRow(bill: UpcomingBill, currency: String, onClick: () -> Unit) {
    val u = urgencyFor(bill.dueDays)
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .background(JudithColors.surface1, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 8.dp),
    ) {
        // Date chip (e.g. "Jun 14"), tinted by urgency.
        Box(
            modifier = Modifier
                .background(u.color.copy(alpha = 0.18f), RoundedCornerShape(8.dp))
                .padding(horizontal = 7.dp, vertical = 4.dp),
        ) {
            Text(
                text = bill.dueLabel.ifEmpty { "—" },
                color = u.color,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        Spacer(Modifier.width(9.dp))
        Text(
            text = bill.provider,
            color = JudithColors.txtHi,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            modifier = Modifier.weight(1f),
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = amountDisplay(currency, bill.amount),
            color = JudithColors.txtHi,
            fontSize = 13.sp,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.SemiBold,
        )
    }
}
