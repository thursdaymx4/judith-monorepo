package com.app.judith.wear.complications

import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.LongTextComplicationData
import androidx.wear.watchface.complications.data.MonochromaticImageComplicationData
import androidx.wear.watchface.complications.data.NoDataComplicationData
import androidx.wear.watchface.complications.data.RangedValueComplicationData
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.data.SmallImageComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import com.app.judith.wear.data.amountDisplay
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * "Due this month" complication. SHORT_TEXT/LONG_TEXT show the amount owed;
 * RANGED_VALUE shows the paid-this-month progress arc (matches the in-app
 * gauge); icon/image variants for faces that only take a glyph.
 */
class DueComplicationService : SuspendingComplicationDataSourceService() {

    override fun getPreviewData(type: ComplicationType): ComplicationData? =
        build(type, currency = "$", total = 438.0, unpaid = 4, paid = 2830.0)

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        val p = JudithComplications.loadPayload(this)
        return build(
            request.complicationType,
            currency = p?.currency ?: "$",
            total = p?.totalOwed ?: 0.0,
            unpaid = p?.unpaidCount ?: 0,
            paid = p?.paidAmount ?: 0.0,
        )
    }

    private fun build(
        type: ComplicationType,
        currency: String,
        total: Double,
        unpaid: Int,
        paid: Double,
    ): ComplicationData? {
        val tap = JudithComplications.tapAction(this)
        val amount = amountDisplay(currency, total)
        return when (type) {
            ComplicationType.SHORT_TEXT -> ShortTextComplicationData.Builder(
                JudithComplications.text(amount),
                JudithComplications.text("$amount due this month"),
            ).setTitle(JudithComplications.text("Due"))
                .setMonochromaticImage(JudithComplications.monoIcon(this))
                .setTapAction(tap)
                .build()

            ComplicationType.LONG_TEXT -> LongTextComplicationData.Builder(
                JudithComplications.text("$amount due"),
                JudithComplications.text("$amount due across $unpaid bills this month"),
            ).setTitle(
                JudithComplications.text(if (unpaid == 1) "1 bill this month" else "$unpaid bills this month"),
            ).setMonochromaticImage(JudithComplications.monoIcon(this))
                .setTapAction(tap)
                .build()

            ComplicationType.RANGED_VALUE -> {
                val totalDue = paid + total
                val pct = if (totalDue > 0) (paid / totalDue * 100).roundToInt() else 0
                RangedValueComplicationData.Builder(
                    paid.toFloat(),
                    0f,
                    max(totalDue, 1.0).toFloat(),
                    JudithComplications.text("$pct% paid this month"),
                ).setText(JudithComplications.text("$pct%"))
                    .setTitle(JudithComplications.text("Paid"))
                    .setMonochromaticImage(JudithComplications.monoIcon(this))
                    .setTapAction(tap)
                    .build()
            }

            ComplicationType.MONOCHROMATIC_IMAGE -> MonochromaticImageComplicationData.Builder(
                JudithComplications.monoIcon(this),
                JudithComplications.text("Judith — $amount due"),
            ).setTapAction(tap).build()

            ComplicationType.SMALL_IMAGE -> SmallImageComplicationData.Builder(
                JudithComplications.avatarImage(this),
                JudithComplications.text("Judith"),
            ).setTapAction(tap).build()

            else -> NoDataComplicationData()
        }
    }
}
