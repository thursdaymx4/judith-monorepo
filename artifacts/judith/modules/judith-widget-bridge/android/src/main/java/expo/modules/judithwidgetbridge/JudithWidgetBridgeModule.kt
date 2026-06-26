package expo.modules.judithwidgetbridge

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Where the widget payload is cached for the AppWidgetProvider to read. The
// provider runs in the same process (com.app.judith), so a plain private
// SharedPreferences file is sufficient — no multi-process flags needed. This is
// the Android analog of the iOS App Group UserDefaults key "judith.payload_v2".
internal const val WIDGET_PREFS = "judith.widget"
internal const val WIDGET_KEY_PAYLOAD = "payload_v2"

/**
 * Android counterpart of the iOS JudithWidgetBridge. Registers under the SAME
 * native module name ("JudithWidgetBridge") so the existing JS in index.ts
 * resolves it via requireOptionalNativeModule.
 *
 * Only writePayload is implemented — every other bridge function (FinanceKit,
 * FoundationModels, App-Intents, auto-pay) is iOS-only and stays a JS no-op on
 * Android (see getBridge() in index.ts, which still returns null for those).
 */
class JudithWidgetBridgeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("JudithWidgetBridge")

    // Persist the bill payload JSON, then ask every mounted Judith widget to
    // redraw from it. Synchronous to match the iOS Function + the JS signature
    // writePayload(json): void; the work (a SharedPreferences write + a
    // RemoteViews update) is cheap.
    Function("writePayload") { json: String ->
      val context: Context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      context
        .getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
        .edit()
        .putString(WIDGET_KEY_PAYLOAD, json)
        .apply()
      JudithWidgetProvider.refresh(context)
      JudithCalendarWidgetProvider.refresh(context)
    }
  }
}
