package expo.modules.judithwidgetbridge

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale

/**
 * Home-screen widget showing the next due bill + this-month total. Reads the
 * payload JSON cached by JudithWidgetBridgeModule.writePayload (the same
 * WatchPayload the app already builds in lib/watch.ts) and binds a RemoteViews.
 *
 * Renders the same field subset and urgency/colour model the iOS widget uses
 * (see targets/widget/SharedTypes.swift + WidgetViews.swift).
 */
class JudithWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) {
    for (id in ids) render(context, mgr, id)
  }

  companion object {
    // Design tokens mirrored from constants/theme.ts / SharedTypes.swift.
    private const val COLOR_ACCENT = 0xFF29D5A5.toInt()
    private const val COLOR_OVERDUE = 0xFFEA1D3B.toInt()
    private const val COLOR_URGENT = 0xFFFF645F.toInt()
    private const val COLOR_NEAR = 0xFFF7B83D.toInt()
    private const val COLOR_TEXT_HI = 0xFFF3F5F8.toInt()
    private const val COLOR_TEXT_MID = 0xFFA7ADBA.toInt()

    /** Redraw every mounted Judith widget — called after a fresh payload write. */
    fun refresh(context: Context) {
      val mgr = AppWidgetManager.getInstance(context)
      val ids = mgr.getAppWidgetIds(ComponentName(context, JudithWidgetProvider::class.java))
      for (id in ids) render(context, mgr, id)
    }

    private fun render(context: Context, mgr: AppWidgetManager, id: Int) {
      val views = RemoteViews(context.packageName, R.layout.judith_widget)
      bind(context, views)

      // Tapping anywhere opens the app.
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      if (launch != null) {
        val pi = PendingIntent.getActivity(
          context,
          0,
          launch,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        views.setOnClickPendingIntent(R.id.judith_widget_root, pi)
      }

      mgr.updateAppWidget(id, views)
    }

    private fun bind(context: Context, views: RemoteViews) {
      views.setTextViewText(R.id.judith_widget_brand, "JUDITH")
      views.setTextViewText(R.id.judith_widget_due_label, "DUE THIS MONTH")

      // Brand mark = the app launcher icon (the Judith avatar). Resolved at
      // runtime so the module layout needn't compile-depend on app mipmaps.
      val pkg = context.packageName
      val iconId = context.resources.getIdentifier("ic_launcher_round", "mipmap", pkg)
        .let { if (it != 0) it else context.resources.getIdentifier("ic_launcher", "mipmap", pkg) }
      if (iconId != 0) views.setImageViewResource(R.id.judith_widget_logo, iconId)

      val raw = context
        .getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
        .getString(WIDGET_KEY_PAYLOAD, null)
      val payload = raw?.takeIf { it.isNotEmpty() }?.let {
        try { JSONObject(it) } catch (e: Exception) { null }
      }

      if (payload == null) {
        // No payload yet (fresh install / not signed in) — invite the user in.
        views.setTextViewText(R.id.judith_widget_total, "—")
        views.setTextViewText(R.id.judith_widget_count, "Sync")
        views.setTextColor(R.id.judith_widget_count, COLOR_TEXT_MID)
        views.setProgressBar(R.id.judith_widget_progress, 100, 0, false)
        views.setViewVisibility(R.id.judith_widget_avatar, View.GONE)
        views.setTextViewText(R.id.judith_widget_next_provider, "Open Judith to sync")
        views.setTextColor(R.id.judith_widget_next_provider, COLOR_TEXT_MID)
        views.setTextViewText(R.id.judith_widget_next_due, "")
        views.setTextViewText(R.id.judith_widget_next_amount, "")
        return
      }

      val currency = payload.optString("currency", "₱")
      val totalOwed = payload.optDouble("totalOwed", 0.0)
      val paidAmount = payload.optDouble("paidAmount", 0.0)
      val unpaidCount = payload.optInt("unpaidCount", 0)
      val nextProvider = payload.optString("nextProvider", "")
      val nextAmount = payload.optDouble("nextAmount", 0.0)
      val nextDueDays = payload.optInt("nextDueDays", 0)

      views.setTextViewText(R.id.judith_widget_total, money(currency, totalOwed))

      // Paid-this-month bar: paid / (paid + still-owed), matching the app's
      // Home gauge basis.
      val denom = paidAmount + totalOwed
      val pct = if (denom > 0) Math.round(paidAmount / denom * 100).toInt() else 0
      views.setProgressBar(R.id.judith_widget_progress, 100, pct, false)

      if (unpaidCount == 0 || nextProvider.isEmpty()) {
        views.setTextViewText(R.id.judith_widget_count, "All paid")
        views.setTextColor(R.id.judith_widget_count, COLOR_ACCENT)
        views.setViewVisibility(R.id.judith_widget_avatar, View.GONE)
        views.setTextViewText(R.id.judith_widget_next_provider, "All bills paid")
        views.setTextColor(R.id.judith_widget_next_provider, COLOR_ACCENT)
        views.setTextViewText(R.id.judith_widget_next_due, "")
        views.setTextViewText(R.id.judith_widget_next_amount, "")
        return
      }

      views.setTextViewText(R.id.judith_widget_count, "$unpaidCount due")
      views.setTextColor(R.id.judith_widget_count, COLOR_TEXT_MID)

      views.setViewVisibility(R.id.judith_widget_avatar, View.VISIBLE)
      views.setTextViewText(R.id.judith_widget_avatar, nextProvider.take(1).uppercase())

      views.setTextViewText(R.id.judith_widget_next_provider, nextProvider)
      views.setTextColor(R.id.judith_widget_next_provider, COLOR_TEXT_HI)
      views.setTextViewText(R.id.judith_widget_next_due, dueLabelShort(nextDueDays))
      views.setTextColor(R.id.judith_widget_next_due, urgencyColor(nextDueDays))
      views.setTextViewText(R.id.judith_widget_next_amount, money(currency, nextAmount))
      views.setTextColor(R.id.judith_widget_next_amount, urgencyColor(nextDueDays))
    }

    /** Currency symbol + grouped integer, matching the iOS amount format. */
    private fun money(symbol: String, amount: Double): String {
      val n = NumberFormat.getIntegerInstance(Locale.US).format(Math.round(amount))
      return "$symbol$n"
    }

    /** 0→Today, <0→"{n}d late", 1→Tomorrow, else "{n}d" (see SharedTypes.swift). */
    private fun dueLabelShort(days: Int): String = when {
      days == 0 -> "Today"
      days < 0 -> "${-days}d late"
      days == 1 -> "Tomorrow"
      else -> "${days}d"
    }

    private fun urgencyColor(days: Int): Int = when {
      days < 0 -> COLOR_OVERDUE
      days <= 3 -> COLOR_URGENT
      days <= 7 -> COLOR_NEAR
      else -> COLOR_ACCENT
    }
  }
}
