package com.app.judith.wear.complications

import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import androidx.wear.watchface.complications.data.MonochromaticImage
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.SmallImage
import androidx.wear.watchface.complications.data.SmallImageType
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester
import com.app.judith.wear.MainActivity
import com.app.judith.wear.R
import com.app.judith.wear.data.Prefs
import com.app.judith.wear.data.WatchPayload
import com.google.gson.Gson

/**
 * Shared plumbing for Judith watch-face complications. Each complication is a
 * background Service (no ViewModel), so it reads the cached payload straight
 * from SharedPreferences — the same file the phone pushes to over the Data Layer
 * and the in-app BillStore observes.
 */
object JudithComplications {

    private val gson = Gson()

    /** Latest bill payload, or null if the phone hasn't synced yet. */
    fun loadPayload(context: Context): WatchPayload? {
        val json = Prefs.payloadJson(context) ?: return null
        return runCatching { gson.fromJson(json, WatchPayload::class.java) }.getOrNull()
    }

    /** Tapping any complication opens the watch app. */
    fun tapAction(context: Context): PendingIntent {
        val intent = Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    /** Tintable monochrome glyph for icon/text complications. */
    fun monoIcon(context: Context): MonochromaticImage =
        MonochromaticImage.Builder(
            Icon.createWithResource(context, R.drawable.ic_complication),
        ).build()

    /** Judith avatar for SMALL_IMAGE (photo) complications. */
    fun avatarImage(context: Context): SmallImage =
        SmallImage.Builder(
            Icon.createWithResource(context, R.drawable.judith_avatar),
            SmallImageType.PHOTO,
        ).build()

    fun text(value: String): PlainComplicationText =
        PlainComplicationText.Builder(value).build()

    /** Ask every Judith complication to refresh — call after a fresh payload. */
    fun requestUpdateAll(context: Context) {
        listOf(
            DueComplicationService::class.java,
            NextBillComplicationService::class.java,
            OverdueComplicationService::class.java,
        ).forEach { cls ->
            runCatching {
                ComplicationDataSourceUpdateRequester
                    .create(context, ComponentName(context, cls))
                    .requestUpdateAll()
            }
        }
    }
}
