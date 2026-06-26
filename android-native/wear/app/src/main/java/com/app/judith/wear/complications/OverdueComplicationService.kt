package com.app.judith.wear.complications

import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.LongTextComplicationData
import androidx.wear.watchface.complications.data.MonochromaticImageComplicationData
import androidx.wear.watchface.complications.data.NoDataComplicationData
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.data.SmallImageComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import com.app.judith.wear.data.amountDisplay

/**
 * "Overdue" complication — a focused alert glance for past-due bills. SHORT_TEXT
 * shows the count; LONG_TEXT adds the amount. Reads overdueCount/overdueTotal
 * straight off the payload.
 */
class OverdueComplicationService : SuspendingComplicationDataSourceService() {

    override fun getPreviewData(type: ComplicationType): ComplicationData? =
        build(type, currency = "$", count = 2, total = 268.0)

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        val p = JudithComplications.loadPayload(this)
        return build(
            request.complicationType,
            currency = p?.currency ?: "$",
            count = p?.overdueCount ?: 0,
            total = p?.overdueTotal ?: 0.0,
        )
    }

    private fun build(
        type: ComplicationType,
        currency: String,
        count: Int,
        total: Double,
    ): ComplicationData? {
        val tap = JudithComplications.tapAction(this)
        val amount = amountDisplay(currency, total)
        val none = count == 0
        return when (type) {
            ComplicationType.SHORT_TEXT -> ShortTextComplicationData.Builder(
                JudithComplications.text(count.toString()),
                JudithComplications.text(if (none) "No overdue bills" else "$count overdue, $amount"),
            ).setTitle(JudithComplications.text("Overdue"))
                .setMonochromaticImage(JudithComplications.monoIcon(this))
                .setTapAction(tap)
                .build()

            ComplicationType.LONG_TEXT -> LongTextComplicationData.Builder(
                JudithComplications.text(if (none) "No overdue bills" else "$count overdue • $amount"),
                JudithComplications.text(if (none) "No overdue bills" else "$count bills overdue, $amount total"),
            ).setTitle(JudithComplications.text("Overdue"))
                .setMonochromaticImage(JudithComplications.monoIcon(this))
                .setTapAction(tap)
                .build()

            ComplicationType.MONOCHROMATIC_IMAGE -> MonochromaticImageComplicationData.Builder(
                JudithComplications.monoIcon(this),
                JudithComplications.text(if (none) "No overdue bills" else "$count overdue"),
            ).setTapAction(tap).build()

            ComplicationType.SMALL_IMAGE -> SmallImageComplicationData.Builder(
                JudithComplications.avatarImage(this),
                JudithComplications.text("Judith"),
            ).setTapAction(tap).build()

            else -> NoDataComplicationData()
        }
    }
}
