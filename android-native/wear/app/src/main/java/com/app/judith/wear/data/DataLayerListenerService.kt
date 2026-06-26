package com.app.judith.wear.data

import com.app.judith.wear.Config
import com.app.judith.wear.complications.JudithComplications
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.WearableListenerService

/**
 * Receives the JSON payload + auth token pushed by the paired phone over the
 * Wear Data Layer. This is the watch's source of the auth token and the
 * primary data-sync mechanism. Writes everything to SharedPreferences; the
 * BillStore observes that file and refreshes the UI while open.
 */
class DataLayerListenerService : WearableListenerService() {

    override fun onDataChanged(dataEvents: DataEventBuffer) {
        for (event in dataEvents) {
            if (event.type != DataEvent.TYPE_CHANGED) continue
            val item = event.dataItem
            if (item.uri.path != Config.DATA_PATH) continue

            val map = DataMapItem.fromDataItem(item).dataMap
            val payload = map.getString(Config.KEY_PAYLOAD)
            val token = map.getString(Config.KEY_TOKEN)
            val ts = map.getLong(Config.KEY_TS, System.currentTimeMillis())

            Prefs.storeFromPhone(applicationContext, payload, token, ts)
            // Refresh any watch-face complications with the new bill data.
            if (!payload.isNullOrBlank()) JudithComplications.requestUpdateAll(applicationContext)
        }
    }
}
