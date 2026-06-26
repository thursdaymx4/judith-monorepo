package com.app.judith.wear.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.Text
import com.app.judith.wear.JudithColors
import com.app.judith.wear.data.Urgency
import com.app.judith.wear.data.dueLabelShort
import com.app.judith.wear.data.urgencyFor
import com.app.judith.wear.ui.Dot
import com.app.judith.wear.ui.alpha12
import com.app.judith.wear.ui.isStale
import com.app.judith.wear.ui.relativeUpdated
import com.app.judith.wear.data.BillStore

@Composable
fun FaceScreen(store: BillStore) {
    val payload by store.payload.collectAsState()
    val streak by store.streak.collectAsState()
    val updatedAt by store.updatedAt.collectAsState()
    val refreshing by store.refreshing.collectAsState()
    val p = payload ?: return

    // Paid-progress fraction.
    val fraction = when {
        p.paidAmount != null && (p.paidAmount + p.totalOwed) > 0 ->
            (p.paidAmount / (p.paidAmount + p.totalOwed)).toFloat()
        p.totalCount > 0 -> p.paidCount.toFloat() / p.totalCount
        else -> 0f
    }.coerceIn(0f, 1f)

    val firstUrgency = p.upcomingBills.firstOrNull()?.let { urgencyFor(it.dueDays) }
    val ringColor = when {
        p.unpaidCount == 0 -> JudithColors.accent
        firstUrgency == Urgency.OVERDUE -> JudithColors.overdue
        firstUrgency == Urgency.URGENT -> JudithColors.urgent
        else -> JudithColors.accent
    }

    val animated by animateFloatAsState(
        targetValue = fraction,
        animationSpec = tween(700),
        label = "ringFraction",
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(JudithColors.background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 14.dp, vertical = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        // ---- Progress ring ----
        Box(contentAlignment = Alignment.Center, modifier = Modifier.size(88.dp)) {
            val stroke = 7.dp
            Box(
                modifier = Modifier
                    .size(88.dp)
                    .drawBehind {
                        val strokePx = stroke.toPx()
                        val inset = strokePx / 2f
                        val arcSize = Size(size.width - strokePx, size.height - strokePx)
                        val topLeft = Offset(inset, inset)
                        drawArc(
                            color = JudithColors.surface1,
                            startAngle = 0f,
                            sweepAngle = 360f,
                            useCenter = false,
                            topLeft = topLeft,
                            size = arcSize,
                            style = Stroke(width = strokePx, cap = StrokeCap.Round),
                        )
                        drawArc(
                            color = ringColor,
                            startAngle = -90f,
                            sweepAngle = 360f * animated,
                            useCenter = false,
                            topLeft = topLeft,
                            size = arcSize,
                            style = Stroke(width = strokePx, cap = StrokeCap.Round),
                        )
                    },
            )
            if (p.totalCount > 0) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = p.paidCount.toString(),
                        color = JudithColors.txtHi,
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Black,
                    )
                    Text(
                        text = "of ${p.totalCount}",
                        color = JudithColors.txtMid,
                        fontSize = 10.sp,
                    )
                }
            } else {
                Icon(
                    imageVector = Icons.Filled.CreditCard,
                    contentDescription = null,
                    tint = JudithColors.accent,
                    modifier = Modifier.size(28.dp),
                )
            }
        }

        Spacer(Modifier.size(12.dp))

        // ---- Total owed / all-paid ----
        if (p.totalOwed > 0) {
            Text(
                text = p.totalOwedDisplay,
                color = JudithColors.accent,
                fontSize = 24.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
            )
        } else if (p.totalCount > 0) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Filled.CheckCircle,
                    contentDescription = null,
                    tint = JudithColors.accent,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    text = "All paid up!",
                    color = JudithColors.accent,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }

        // ---- Updated caption ----
        val stale = isStale(updatedAt) && !refreshing
        Text(
            text = if (stale) "${relativeUpdated(updatedAt)} · pull to refresh"
            else relativeUpdated(updatedAt),
            color = if (stale) JudithColors.near else JudithColors.txtLow,
            fontSize = 10.sp,
            modifier = Modifier.padding(top = 8.dp),
        )

        // ---- Next-bill chip ----
        p.upcomingBills.firstOrNull()?.let { bill ->
            val u = urgencyFor(bill.dueDays)
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .padding(top = 12.dp)
                    .fillMaxWidth()
                    .background(JudithColors.surface1, RoundedCornerShape(20.dp))
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            ) {
                Dot(color = u.color, sizeDp = 5)
                Spacer(Modifier.width(8.dp))
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
                    text = dueLabelShort(bill.dueDays),
                    color = u.color,
                    fontSize = 13.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }

        // ---- Streak badge ----
        if (streak > 0) {
            Box(
                modifier = Modifier
                    .padding(top = 10.dp)
                    .background(JudithColors.accent.alpha12(), RoundedCornerShape(50))
                    .padding(horizontal = 12.dp, vertical = 5.dp),
            ) {
                Text(
                    text = "🔥 $streak paid streak",
                    color = JudithColors.accent,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}
