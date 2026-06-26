package com.app.judith.wear.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Text
import com.app.judith.wear.JudithColors
import com.app.judith.wear.data.BillStore
import com.app.judith.wear.data.UpcomingBill
import com.app.judith.wear.data.dueLabelShort
import com.app.judith.wear.data.amountDisplay
import com.app.judith.wear.data.rowDueLabelColor
import com.app.judith.wear.data.urgencyFor
import com.app.judith.wear.ui.Dot

@Composable
fun UpNextScreen(store: BillStore, onBill: (String) -> Unit) {
    val payload by store.payload.collectAsState()
    val p = payload ?: return
    val listState = rememberScalingLazyListState()

    ScalingLazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(JudithColors.background),
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Header card.
        item {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(JudithColors.surface1, RoundedCornerShape(16.dp))
                    .padding(horizontal = 12.dp, vertical = 10.dp),
            ) {
                Column {
                    Text("Up next", color = JudithColors.txtHi, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    Text("${p.unpaidCount} unpaid", color = JudithColors.txtMid, fontSize = 11.sp)
                }
                Spacer(Modifier.weight(1f))
                Text(
                    text = p.totalOwedDisplay,
                    color = JudithColors.accent,
                    fontSize = 16.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                )
            }
        }

        if (p.upcomingBills.isEmpty()) {
            item {
                Box(
                    modifier = Modifier.fillMaxWidth().padding(top = 24.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("All paid up", color = JudithColors.txtMid, fontSize = 14.sp)
                }
            }
        } else {
            items(p.upcomingBills, key = { it.id }) { bill ->
                BillRow(bill = bill, currency = p.currency) { onBill(bill.id) }
            }
        }
    }
}

@Composable
private fun BillRow(bill: UpcomingBill, currency: String, onClick: () -> Unit) {
    val u = urgencyFor(bill.dueDays)
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .background(JudithColors.surface1, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
    ) {
        Dot(color = u.color, sizeDp = 8)
        Spacer(Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = bill.provider,
                color = JudithColors.txtHi,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
            )
            Text(
                text = dueLabelShort(bill.dueDays),
                color = rowDueLabelColor(bill.dueDays),
                fontSize = 11.sp,
            )
        }
        Spacer(Modifier.width(8.dp))
        Text(
            text = amountDisplay(currency, bill.amount),
            color = JudithColors.txtHi,
            fontSize = 14.sp,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.SemiBold,
        )
    }
}
