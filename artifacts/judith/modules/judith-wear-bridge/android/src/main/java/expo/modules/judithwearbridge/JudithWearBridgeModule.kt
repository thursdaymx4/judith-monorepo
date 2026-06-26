package expo.modules.judithwearbridge

import android.content.Context
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Wear Data Layer contract — must match android-native/wear/.../Config.kt and
// the JS bridge in modules/judith-wear-bridge/index.ts.
private const val DATA_PATH = "/judith/watch-payload"
private const val KEY_PAYLOAD = "judith_payload_v2"
private const val KEY_TOKEN = "judith_watch_token"
private const val KEY_TS = "updated_at"
// Watch -> phone action messages (mark paid / snooze).
private const val MSG_PATH = "/judith/watch-action"

class JudithWearBridgeModule : Module() {
  // Held so we can unregister when JS stops listening.
  private var messageListener: MessageClient.OnMessageReceivedListener? = null

  override fun definition() = ModuleDefinition {
    Name("JudithWearBridge")

    // Emitted to JS when the watch sends an action message (mark paid / snooze).
    // Payload: { "json": "<raw action JSON from the watch>" }.
    Events("onWatchMessage")

    // Publishes the latest bill payload (+ watch token) as a single Data Layer
    // item. putDataItem replaces the previous value in place, so the watch
    // always reads the latest state — the Android analog of WatchConnectivity's
    // updateApplicationContext. Runs on Expo's background executor, so the
    // blocking Tasks.await is safe here. Throws on failure; the JS layer
    // swallows it (no paired watch / no Play Services is a normal no-op).
    AsyncFunction("pushToWatch") { payloadJson: String, token: String? ->
      val context: Context =
        appContext.reactContext ?: throw Exceptions.ReactContextLost()

      val request = PutDataMapRequest.create(DATA_PATH).apply {
        dataMap.putString(KEY_PAYLOAD, payloadJson)
        if (!token.isNullOrEmpty()) {
          dataMap.putString(KEY_TOKEN, token)
        }
        // Bump the timestamp so the DataItem bytes change every sync — Wear
        // dedupes identical items, which would otherwise drop a re-push of an
        // unchanged payload.
        dataMap.putLong(KEY_TS, System.currentTimeMillis())
      }

      val putRequest = request.asPutDataRequest().setUrgent()
      Tasks.await(Wearable.getDataClient(context).putDataItem(putRequest))
      true
    }

    // Register a MessageClient listener while JS has a subscriber. This mirrors
    // iOS WCSession's message channel: the watch sends {action, billId} and the
    // phone updates its own store. Only active while the app is running, which
    // matches the iOS "reachable" model.
    OnStartObserving {
      val context = appContext.reactContext ?: return@OnStartObserving
      val listener = MessageClient.OnMessageReceivedListener { event: MessageEvent ->
        if (event.path == MSG_PATH) {
          sendEvent("onWatchMessage", mapOf("json" to String(event.data, Charsets.UTF_8)))
        }
      }
      messageListener = listener
      Wearable.getMessageClient(context).addListener(listener)
    }

    OnStopObserving {
      val context = appContext.reactContext
      val listener = messageListener
      if (context != null && listener != null) {
        Wearable.getMessageClient(context).removeListener(listener)
      }
      messageListener = null
    }
  }
}
