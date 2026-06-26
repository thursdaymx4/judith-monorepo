package com.app.judith.wear.ui.screens

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.Text
import com.app.judith.wear.JudithColors
import com.app.judith.wear.data.BillStore
import com.app.judith.wear.data.amountDisplay
import com.app.judith.wear.data.dueSubtitle
import com.app.judith.wear.data.urgencyFor
import com.app.judith.wear.ui.Capsule
import com.app.judith.wear.ui.alpha15
import com.app.judith.wear.ui.tomorrowIso
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun BillDetailScreen(store: BillStore, billId: String, onDone: () -> Unit) {
    val payload by store.payload.collectAsState()
    val token by store.token.collectAsState()
    val bill = remember(billId, payload) { store.findBill(billId) }
    val scope = rememberCoroutineScope()
    val streak by store.streak.collectAsState()

    var inFlight by remember { mutableStateOf(false) }
    var showConfirm by remember { mutableStateOf(false) }
    var confirmProvider by remember { mutableStateOf("") }
    var confirmAmount by remember { mutableStateOf("") }

    if (bill == null) {
        // Bill no longer exists (e.g. already paid) — bounce back.
        LaunchedEffect(Unit) { onDone() }
        return
    }

    val u = urgencyFor(bill.dueDays)
    val currency = payload?.currency.orEmpty()

    if (showConfirm) {
        PaidConfirm(
            provider = confirmProvider,
            amount = confirmAmount,
            streak = streak,
            onDismiss = onDone,
        )
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(JudithColors.background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 26.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Capsule(text = u.label, bg = u.color, textColor = JudithColors.background)

        Spacer(Modifier.size(10.dp))
        Text(
            text = bill.provider,
            color = JudithColors.txtHi,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.size(6.dp))
        Text(
            text = amountDisplay(currency, bill.amount),
            color = JudithColors.txtHi,
            fontSize = 34.sp,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
        )

        Spacer(Modifier.size(4.dp))
        Text(
            text = dueSubtitle(bill.dueDays),
            color = u.color,
            fontSize = 13.sp,
        )

        Spacer(Modifier.size(16.dp))

        // PRIMARY — Mark paid.
        Button(
            onClick = {
                if (inFlight) return@Button
                inFlight = true
                confirmProvider = bill.provider
                confirmAmount = amountDisplay(currency, bill.amount)
                // Optimistic local update first.
                store.optimisticallyMarkPaid(bill.id)
                scope.launch {
                    // Tell the phone so it updates its own store and re-syncs
                    // everywhere (mirrors the iOS WCSession markPaid path).
                    store.sendActionToPhone("markPaid", bill.id)
                    // Also write to the backend so it persists if the phone app
                    // isn't foregrounded to receive the message.
                    store.postAction("mark_paid", bill.id)
                    // Reconcile with server truth.
                    store.refresh()
                    inFlight = false
                    showConfirm = true
                }
            },
            enabled = !inFlight,
            colors = ButtonDefaults.buttonColors(
                backgroundColor = JudithColors.accent,
                contentColor = JudithColors.background,
            ),
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (inFlight) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    indicatorColor = JudithColors.background,
                    strokeWidth = 2.dp,
                )
                Spacer(Modifier.size(8.dp))
                Text("Marking…", color = JudithColors.background, fontSize = 14.sp)
            } else {
                Icon(Icons.Filled.Check, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(8.dp))
                Text("Mark paid", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            }
        }

        Spacer(Modifier.size(8.dp))

        // SECONDARY — Snooze 1 day.
        Button(
            onClick = {
                if (inFlight) return@Button
                inFlight = true
                scope.launch {
                    store.postAction("snooze", bill.id, tomorrowIso())
                    store.refresh()
                    inFlight = false
                    onDone()
                }
            },
            enabled = !inFlight,
            colors = ButtonDefaults.buttonColors(
                backgroundColor = JudithColors.surface1,
                contentColor = JudithColors.txtHi,
            ),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Snooze 1 day", fontSize = 14.sp)
        }

        // Without a watch token (phone not signed in) these actions update the
        // watch locally but can't be written back to your bills. Set expectations.
        if (token == null) {
            Spacer(Modifier.size(12.dp))
            Text(
                text = "Sign in on the Judith phone app to sync paid/snooze to your bills.",
                color = JudithColors.txtLow,
                fontSize = 11.sp,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun PaidConfirm(provider: String, amount: String, streak: Int, onDismiss: () -> Unit) {
    var visible by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(
        targetValue = if (visible) 1f else 0.4f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy),
        label = "checkScale",
    )
    LaunchedEffect(Unit) {
        visible = true
        delay(2500)
        onDismiss()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(JudithColors.background),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(horizontal = 16.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(68.dp)
                    .scale(scale)
                    .background(JudithColors.accent.alpha15(), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Filled.Check,
                    contentDescription = null,
                    tint = JudithColors.accent,
                    modifier = Modifier.size(44.dp),
                )
            }
            Spacer(Modifier.size(12.dp))
            Text("Marked paid", color = JudithColors.txtHi, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.size(4.dp))
            Text("$provider · $amount", color = JudithColors.txtMid, fontSize = 12.sp)
            if (streak > 1) {
                Spacer(Modifier.size(10.dp))
                Box(
                    modifier = Modifier
                        .background(JudithColors.accent.copy(alpha = 0.12f), RoundedCornerShape(50))
                        .padding(horizontal = 12.dp, vertical = 5.dp),
                ) {
                    Text(
                        text = "🔥 $streak-bill streak",
                        color = JudithColors.accent,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
    }
}
