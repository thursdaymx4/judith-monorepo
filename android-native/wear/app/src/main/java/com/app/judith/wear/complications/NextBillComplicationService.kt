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
import com.app.judith.wear.data.dueLabelShort

/**
 * "Next bill" complication — the single most actionable glance: who's next, how
 * much, and when. SHORT_TEXT = amount + provider title; LONG_TEXT = provider +
 * amount + due label.
 */
class NextBillComplicationService : SuspendingComplicationDataSourceService() {

    override fun getPreviewData(type: ComplicationType): ComplicationData? =
        build(type, currency = "$", provider = "Con Edison", amount = 134.0, dueDays = -12, unpaid = 4)

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        val p = JudithComplications.loadPayload(this)
        return build(
            request.complicationType,
            currency = p?.currency ?: "$",
            provider = p?.nextProvider ?: "",
            amount = p?.nextAmount ?: 0.0,
            dueDays = p?.nextDueDays ?: 0,
            unpaid = p?.unpaidCount ?: 0,
        )
    }

    private fun build(
        type: ComplicationType,
        currency: String,
        provider: String,
        amount: Double,
        dueDays: Int,
        unpaid: Int,
    ): ComplicationData? {
        val tap = JudithComplications.tapAction(this)
        val allPaid = unpaid == 0 || provider.isEmpty()
        val amountStr = amountDisplay(currency, amount)
        val due = dueLabelShort(dueDays)
        return when (type) {
            ComplicationType.SHORT_TEXT ->
                if (allPaid) {
                    ShortTextComplicationData.Builder(
                        JudithComplications.text("Paid"),
                        JudithComplications.text("All bills paid"),
                    ).setMonochromaticImage(JudithComplications.monoIcon(this)).setTapAction(tap).build()
                } else {
                    ShortTextComplicationData.Builder(
                        JudithComplications.text(amountStr),
                        JudithComplications.text("$provider $amountStr due $due"),
                    ).setTitle(JudithComplications.text(provider))
                        .setMonochromaticImage(JudithComplications.monoIcon(this))
                        .setTapAction(tap)
                        .build()
                }

            ComplicationType.LONG_TEXT ->
                if (allPaid) {
                    LongTextComplicationData.Builder(
                        JudithComplications.text("All bills paid"),
                        JudithComplications.text("All bills paid"),
                    ).setMonochromaticImage(JudithComplications.monoIcon(this)).setTapAction(tap).build()
                } else {
                    LongTextComplicationData.Builder(
                        JudithComplications.text("$amountStr • $due"),
                        JudithComplications.text("$provider: $amountStr due $due"),
                    ).setTitle(JudithComplications.text(provider))
                        .setMonochromaticImage(JudithComplications.monoIcon(this))
                        .setTapAction(tap)
                        .build()
                }

            ComplicationType.MONOCHROMATIC_IMAGE -> MonochromaticImageComplicationData.Builder(
                JudithComplications.monoIcon(this),
                JudithComplications.text(if (allPaid) "All bills paid" else "Next: $provider"),
            ).setTapAction(tap).build()

            ComplicationType.SMALL_IMAGE -> SmallImageComplicationData.Builder(
                JudithComplications.avatarImage(this),
                JudithComplications.text("Judith"),
            ).setTapAction(tap).build()

            else -> NoDataComplicationData()
        }
    }
}
