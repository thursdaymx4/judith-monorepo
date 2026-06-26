package com.app.judith.wear.data

import android.app.Application
import android.content.SharedPreferences
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.app.judith.wear.Config
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONObject
import kotlin.math.max

/**
 * Single source of truth for the watch UI. Loads the cached payload from prefs
 * on init, observes prefs changes (Data Layer pushes from the phone), and
 * exposes optimistic local mutations + a pull-refresh.
 */
class BillStore(app: Application) : AndroidViewModel(app) {

    private val gson = Gson()
    private val backend = BackendClient(app)
    private val prefs: SharedPreferences = Prefs.get(app)

    private val _payload = MutableStateFlow<WatchPayload?>(null)
    val payload: StateFlow<WatchPayload?> = _payload.asStateFlow()

    private val _streak = MutableStateFlow(0)
    val streak: StateFlow<Int> = _streak.asStateFlow()

    private val _updatedAt = MutableStateFlow(0L)
    val updatedAt: StateFlow<Long> = _updatedAt.asStateFlow()

    private val _token = MutableStateFlow<String?>(null)
    val token: StateFlow<String?> = _token.asStateFlow()

    private val _refreshing = MutableStateFlow(false)
    val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

    /** Ready to show bills once a payload has arrived. The token is only needed
     *  for backend actions (refresh / Ask / mark-paid), not to render. */
    val isReady: Boolean get() = _payload.value != null

    private val prefsListener =
        SharedPreferences.OnSharedPreferenceChangeListener { _, _ -> reloadFromPrefs() }

    init {
        reloadFromPrefs()
        prefs.registerOnSharedPreferenceChangeListener(prefsListener)
        syncFromDataLayer()
    }

    /**
     * Pull any payload the phone already published to the Wear Data Layer. The
     * DataLayerListenerService only fires on *changes*, so an item the phone
     * pushed before this app was installed (or before a cold launch) would
     * otherwise be missed until the next push. Safe to call repeatedly.
     */
    fun syncFromDataLayer() {
        viewModelScope.launch {
            runCatching {
                val app = getApplication<Application>()
                val buffer = withContext(Dispatchers.IO) {
                    Wearable.getDataClient(app).dataItems.await()
                }
                try {
                    val item = buffer.firstOrNull { it.uri.path == Config.DATA_PATH }
                    if (item != null) {
                        val map = DataMapItem.fromDataItem(item).dataMap
                        Prefs.storeFromPhone(
                            app,
                            map.getString(Config.KEY_PAYLOAD),
                            map.getString(Config.KEY_TOKEN),
                            map.getLong(Config.KEY_TS, System.currentTimeMillis()),
                        )
                        reloadFromPrefs()
                    }
                } finally {
                    buffer.release()
                }
            }
        }
    }

    override fun onCleared() {
        prefs.unregisterOnSharedPreferenceChangeListener(prefsListener)
        super.onCleared()
    }

    fun reloadFromPrefs() {
        val ctx = getApplication<Application>()
        _token.value = Prefs.token(ctx)
        _streak.value = Prefs.streak(ctx)
        _updatedAt.value = Prefs.updatedAt(ctx)
        val json = Prefs.payloadJson(ctx)
        val parsed = if (json.isNullOrBlank()) null else runCatching {
            gson.fromJson(json, WatchPayload::class.java)
        }.getOrNull()
        // Only adopt a successfully-parsed payload. Never clobber a good payload
        // with null from a blank/corrupt reload — otherwise the root `ready`
        // gate would briefly drop to the WaitingScreen and tear down the whole
        // nav/pager back stack on a routine resume or a malformed push.
        if (parsed != null) {
            _payload.value = parsed
        } else if (json.isNullOrBlank()) {
            _payload.value = null
        }
    }

    fun applyPayload(p: WatchPayload) {
        _payload.value = p
    }

    /**
     * Pull fallback: refresh the cached payload from the backend — but only
     * ADOPT it if it's newer than what we already show. /watch-summary returns
     * the server snapshot, which the phone refreshes on its own cadence and can
     * lag behind the latest Data Layer push or an optimistic local edit. Adopting
     * it unconditionally caused the "Up Next total shows correct, then reverts to
     * a stale number" flicker on every open/resume. The newer payload also gets
     * persisted so a later prefs reload can't regress to the stale value.
     */
    fun refresh() {
        if (_token.value == null) return
        viewModelScope.launch {
            _refreshing.value = true
            val fresh = backend.fetchSummary()
            if (fresh != null && isNewer(fresh, _payload.value)) {
                _payload.value = fresh
                val now = System.currentTimeMillis()
                Prefs.setPayloadJson(getApplication(), gson.toJson(fresh), now)
                _updatedAt.value = now
            }
            _refreshing.value = false
        }
    }

    /**
     * True if [candidate] is strictly newer than [current] by `generatedAt`.
     * generatedAt is ISO-8601 UTC ("…Z") from the phone, so lexical order equals
     * chronological order. A blank current means "adopt"; a blank candidate
     * means "keep what we have".
     */
    private fun isNewer(candidate: WatchPayload, current: WatchPayload?): Boolean {
        val cur = current?.generatedAt
        if (cur.isNullOrBlank()) return true
        val cand = candidate.generatedAt
        if (cand.isBlank()) return false
        return cand > cur
    }

    fun findBill(billId: String): UpcomingBill? =
        _payload.value?.upcomingBills?.firstOrNull { it.id == billId }

    /**
     * Optimistic local mark-paid. Mirrors the iOS app exactly:
     * remove the bill, adjust totals/counts via the optimistic deltas,
     * recompute next*, bump paid stats + streak, persist.
     */
    fun optimisticallyMarkPaid(billId: String) {
        val current = _payload.value ?: return
        val removed = current.upcomingBills.firstOrNull { it.id == billId } ?: return

        val remaining = current.upcomingBills.filter { it.id != billId }
        val first = remaining.firstOrNull()

        var overdueCount = current.overdueCount
        var overdueTotal = current.overdueTotal
        if (removed.isOverdue) {
            overdueCount = overdueCount?.let { max(0, it - 1) }
            overdueTotal = overdueTotal?.let { max(0.0, it - removed.amount) }
        }

        var next7Total = current.next7Total
        if (!removed.isOverdue && removed.dueDays <= 7) {
            next7Total = next7Total?.let { max(0.0, it - removed.amount) }
        }

        val updated = current.copy(
            upcomingBills = remaining,
            totalOwed = max(0.0, current.totalOwed - removed.optimisticTotalOwedDelta),
            unpaidCount = current.unpaidCount - removed.optimisticUnpaidCountDelta,
            paidCount = current.paidCount + 1,
            paidAmount = (current.paidAmount ?: 0.0) + removed.amount,
            overdueCount = overdueCount,
            overdueTotal = overdueTotal,
            next7Total = next7Total,
            nextProvider = first?.provider ?: "",
            nextAmount = first?.amount ?: 0.0,
            nextDueDays = first?.dueDays ?: 0,
            nextDueLabel = first?.dueLabel ?: "",
        )
        _payload.value = updated

        // Persist updated payload + bumped streak in a single atomic edit so the
        // prefs listener reloads them together (no streak flicker).
        val ctx = getApplication<Application>()
        val now = System.currentTimeMillis()
        val newStreak = _streak.value + 1
        Prefs.setOptimistic(ctx, gson.toJson(updated), now, newStreak)
        _streak.value = newStreak
        _updatedAt.value = now
        // Keep watch-face complications in step with the optimistic change.
        com.app.judith.wear.complications.JudithComplications.requestUpdateAll(ctx)
    }

    // ---- Network passthroughs (callable from screens) -------------------

    suspend fun postAction(action: String, billId: String, snoozeUntil: String? = null): Boolean =
        backend.action(action, billId, snoozeUntil)

    /**
     * Send an action to the paired phone over the Wear Data Layer so the phone
     * updates its own bill store immediately (cycle roll, streak, Supabase sync,
     * and a fresh payload back to this watch) — the Android analog of the iOS
     * WCSession path. Returns true if a connected phone node received it.
     */
    suspend fun sendActionToPhone(
        action: String,
        billId: String,
        snoozeUntil: String? = null,
    ): Boolean = sendMessageToPhone(JSONObject().apply {
        put("action", action)
        put("billId", billId)
        if (snoozeUntil != null) put("snoozeUntil", snoozeUntil)
    })

    /**
     * Forward the raw /watch-ask `actions` JSON array to the phone so it applies
     * the full action vocabulary (add_bill / add_payment / update_amount /
     * update_bill / mark_paid, single or multiple) against its canonical store —
     * which then re-syncs a fresh payload + snapshot back to this watch. This is
     * the Android analog of the iOS WCSession "applyAction" replay, and the fix
     * for voice mark-paid not reaching the phone.
     */
    suspend fun forwardActionsToPhone(actionsJson: String): Boolean =
        sendMessageToPhone(JSONObject().apply {
            put("action", "applyActions")
            put("payload", actionsJson)
        })

    /**
     * Ask the phone to rebuild + re-upload a fresh watch snapshot. Sent when the
     * Ask screen opens so voice answers (computed server-side from the uploaded
     * snapshot) don't read stale bill data.
     */
    suspend fun requestPhoneRefresh(): Boolean =
        sendMessageToPhone(JSONObject().apply { put("action", "refreshWatchPayload") })

    /** Deliver one Data Layer message to every connected phone node. */
    private suspend fun sendMessageToPhone(obj: JSONObject): Boolean =
        withContext(Dispatchers.IO) {
            runCatching {
                val app = getApplication<Application>()
                val nodes = Wearable.getNodeClient(app).connectedNodes.await()
                if (nodes.isEmpty()) return@runCatching false
                val payload = obj.toString().toByteArray(Charsets.UTF_8)
                var delivered = false
                for (node in nodes) {
                    runCatching {
                        Wearable.getMessageClient(app)
                            .sendMessage(node.id, Config.MSG_PATH, payload).await()
                        delivered = true
                    }
                }
                delivered
            }.getOrDefault(false)
        }

    suspend fun ask(text: String, history: List<ChatTurn>): AskResult =
        backend.ask(text, history.takeLast(5))

    suspend fun stt(bytes: ByteArray): String? = backend.stt(bytes)
}
