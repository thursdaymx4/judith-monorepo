package expo.modules.judithwidgetbridge

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/**
 * Month-grid bill calendar widget. Reads the same cached payload as the summary
 * widget (SharedPreferences "judith.widget" / "payload_v2") and renders the
 * CURRENT month with due-date markers, mirroring the in-app calendar's heat dots
 * (app/(tabs)/calendar.tsx): each day is coloured by the most-urgent unpaid,
 * non-via-card bill due that day; paid-only days render neutral.
 */
class JudithCalendarWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) {
    for (id in ids) render(context, mgr, id)
  }

  companion object {
    private const val COLOR_ACCENT = 0xFF29D5A5.toInt()
    private const val COLOR_TEXT_HI = 0xFFF3F5F8.toInt()
    private const val COLOR_TEXT_MID = 0xFFA7ADBA.toInt()
    private const val COLOR_TEXT_LOW = 0xFF6A7180.toInt()

    // Most-severe-first, for collapsing multiple bills on one day.
    private val SEVERITY = listOf("overdue", "urgent", "near", "ok")

    fun refresh(context: Context) {
      val mgr = AppWidgetManager.getInstance(context)
      val ids = mgr.getAppWidgetIds(ComponentName(context, JudithCalendarWidgetProvider::class.java))
      for (id in ids) render(context, mgr, id)
    }

    private fun render(context: Context, mgr: AppWidgetManager, id: Int) {
      val views = RemoteViews(context.packageName, R.layout.judith_calendar_widget)
      bind(context, views)

      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      if (launch != null) {
        val pi = PendingIntent.getActivity(
          context, 1, launch,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        views.setOnClickPendingIntent(R.id.judith_cal_root, pi)
      }
      mgr.updateAppWidget(id, views)
    }

    private fun bind(context: Context, views: RemoteViews) {
      val cal = Calendar.getInstance()
      val year = cal.get(Calendar.YEAR)
      val month = cal.get(Calendar.MONTH)
      val todayDate = cal.get(Calendar.DAY_OF_MONTH)

      views.setTextViewText(
        R.id.judith_cal_title,
        SimpleDateFormat("MMMM yyyy", Locale.US).format(cal.time),
      )

      // Collapse the payload markers into per-day state for the current month.
      val urgencyByDay = HashMap<Int, String>()
      val paidDays = HashSet<Int>()
      val raw = context
        .getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
        .getString(WIDGET_KEY_PAYLOAD, null)
      val markers = raw?.takeIf { it.isNotEmpty() }
        ?.let { try { JSONObject(it).optJSONArray("monthDueDays") } catch (e: Exception) { null } }
      if (markers != null) {
        for (i in 0 until markers.length()) {
          val m = markers.optJSONObject(i) ?: continue
          val day = m.optInt("day", 0)
          if (day < 1) continue
          val paid = m.optBoolean("paid", false)
          val viaCard = m.optBoolean("viaCard", false)
          if (paid) { paidDays.add(day); continue }
          if (viaCard) continue // neutral; cost lives on the linked card
          val u = m.optString("urgency", "ok")
          val prev = urgencyByDay[day]
          if (prev == null || SEVERITY.indexOf(u) < SEVERITY.indexOf(prev)) {
            urgencyByDay[day] = u
          }
        }
      }

      // Grid offsets: Sunday-start columns, day 1 at column (dayOfWeek - 1).
      val first = Calendar.getInstance().apply { set(year, month, 1) }
      val offset = first.get(Calendar.DAY_OF_WEEK) - Calendar.SUNDAY
      val dim = first.getActualMaximum(Calendar.DAY_OF_MONTH)

      val pkg = context.packageName
      for (i in 0 until 42) {
        val cellId = context.resources.getIdentifier("cal_cell_$i", "id", pkg)
        if (cellId == 0) continue
        val day = i - offset + 1
        if (day < 1 || day > dim) {
          views.setTextViewText(cellId, "")
          views.setInt(cellId, "setBackgroundResource", 0)
          continue
        }
        views.setTextViewText(cellId, day.toString())

        val urgency = urgencyByDay[day]
        when {
          urgency != null -> {
            views.setInt(cellId, "setBackgroundResource", bgFor(urgency))
            views.setTextColor(cellId, COLOR_TEXT_HI)
          }
          day == todayDate -> {
            views.setInt(cellId, "setBackgroundResource", R.drawable.cal_cell_today)
            views.setTextColor(cellId, COLOR_ACCENT)
          }
          paidDays.contains(day) -> {
            views.setInt(cellId, "setBackgroundResource", 0)
            views.setTextColor(cellId, COLOR_TEXT_LOW)
          }
          else -> {
            views.setInt(cellId, "setBackgroundResource", 0)
            views.setTextColor(cellId, COLOR_TEXT_MID)
          }
        }
      }
    }

    private fun bgFor(urgency: String): Int = when (urgency) {
      "overdue" -> R.drawable.cal_cell_overdue
      "urgent" -> R.drawable.cal_cell_urgent
      "near" -> R.drawable.cal_cell_near
      else -> R.drawable.cal_cell_ok
    }
  }
}
