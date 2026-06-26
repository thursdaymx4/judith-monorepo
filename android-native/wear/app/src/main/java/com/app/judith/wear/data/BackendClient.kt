package com.app.judith.wear.data

import android.content.Context
import android.util.Base64
import com.app.judith.wear.Config
import com.google.gson.Gson
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.net.SocketTimeoutException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

/**
 * REST client. Reads the auth token from SharedPreferences on every call so it
 * always uses whatever the phone last pushed. Data Layer push is the primary
 * sync mechanism; these calls are the pull fallback + writes.
 */
class BackendClient(private val context: Context) {

    private val gson = Gson()

    private val http = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val jsonMedia = "application/json".toMediaType()

    private fun token(): String? = Prefs.token(context)

    private fun newRequest(path: String): Request.Builder {
        val b = Request.Builder()
            .url(Config.API_BASE + path)
            .header("Accept", "application/json")
        token()?.let { b.header("Authorization", "Bearer $it") }
        return b
    }

    /** Pull the latest summary and persist it. Returns the decoded payload. */
    suspend fun fetchSummary(): WatchPayload? = withContext(Dispatchers.IO) {
        if (token() == null) return@withContext null
        try {
            http.newCall(newRequest("/watch-summary").get().build()).execute().use { res ->
                val body = res.body?.string().orEmpty()
                if (!res.isSuccessful) return@withContext null
                val root = gson.fromJson(body, JsonObject::class.java) ?: return@withContext null
                val payloadObj = root.getAsJsonObject("payload") ?: return@withContext null
                // Pure fetch — do NOT persist here. /watch-summary returns the
                // server snapshot, which the phone refreshes on its own cadence
                // and can be OLDER than the latest Data Layer push or an
                // optimistic local edit. BillStore.refresh decides whether it's
                // newer before adopting/persisting it; persisting unconditionally
                // here overwrote the fresh cached payload with a stale one (the
                // "Up Next total reverts to a stale number" flicker).
                gson.fromJson(payloadObj, WatchPayload::class.java)
            }
        } catch (_: SocketTimeoutException) {
            null
        } catch (_: Exception) {
            null
        }
    }

    /** Ask Judith. history is sent capped to the last 5 turns by the caller. */
    suspend fun ask(text: String, history: List<ChatTurn>): AskResult =
        withContext(Dispatchers.IO) {
            try {
                val now = Date()
                val localDate = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(now)
                val localWeekday = SimpleDateFormat("EEEE", Locale.US).format(now)

                val body = JsonObject().apply {
                    addProperty("text", text)
                    addProperty("localDate", localDate)
                    addProperty("localWeekday", localWeekday)
                    if (history.isNotEmpty()) {
                        add("history", gson.toJsonTree(history.map {
                            JsonObject().apply {
                                addProperty("role", it.role)
                                addProperty("text", it.text)
                            }
                        }))
                    }
                }

                val req = newRequest("/watch-ask")
                    .header("Content-Type", "application/json")
                    .post(gson.toJson(body).toRequestBody(jsonMedia))
                    .build()

                http.newCall(req).execute().use { res ->
                    val raw = res.body?.string().orEmpty()
                    val root = gson.fromJson(raw, JsonObject::class.java)
                    val serverError = root?.get("error")?.asString
                    if (serverError != null) return@withContext AskResult(error = serverError)
                    if (!res.isSuccessful || root == null) {
                        return@withContext AskResult(error = "Something went wrong. Try again.")
                    }
                    val result = gson.fromJson(root, AskResult::class.java)
                    if (result.answer.isNullOrBlank()) {
                        AskResult(error = "Judith had no answer. Try rephrasing.")
                    } else {
                        // Keep the raw actions array so the watch can forward the
                        // full action objects to the phone (Gson's AskAction only
                        // captures type+id; add_bill/add_payment/etc. need more).
                        result.copy(rawActions = root.getAsJsonArray("actions")?.toString())
                    }
                }
            } catch (_: SocketTimeoutException) {
                AskResult(error = "Took too long — keep your wrist raised and try again.")
            } catch (_: Exception) {
                AskResult(error = "Network error. Try again.")
            }
        }

    /** Speech-to-text. Returns the transcript or null. */
    suspend fun stt(audioBytes: ByteArray): String? = withContext(Dispatchers.IO) {
        try {
            val b64 = Base64.encodeToString(audioBytes, Base64.NO_WRAP)
            val body = JsonObject().apply {
                addProperty("audioBase64", b64)
                addProperty("mimeType", "audio/m4a")
            }
            val req = newRequest("/watch-stt")
                .header("Content-Type", "application/json")
                .post(gson.toJson(body).toRequestBody(jsonMedia))
                .build()
            http.newCall(req).execute().use { res ->
                val raw = res.body?.string().orEmpty()
                if (!res.isSuccessful) return@withContext null
                val root = gson.fromJson(raw, JsonObject::class.java) ?: return@withContext null
                root.get("text")?.asString
            }
        } catch (_: Exception) {
            null
        }
    }

    /** Canonical mark-paid / snooze write. Returns true on { "ok": true }. */
    suspend fun action(
        action: String,
        billId: String,
        snoozeUntil: String? = null,
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val body = JsonObject().apply {
                addProperty("action", action)
                addProperty("billId", billId)
                if (snoozeUntil != null) addProperty("snoozeUntil", snoozeUntil)
            }
            val req = newRequest("/watch-action")
                .header("Content-Type", "application/json")
                .post(gson.toJson(body).toRequestBody(jsonMedia))
                .build()
            http.newCall(req).execute().use { res ->
                if (!res.isSuccessful) return@withContext false
                val raw = res.body?.string().orEmpty()
                val root = gson.fromJson(raw, JsonObject::class.java)
                root?.get("ok")?.asBoolean == true
            }
        } catch (_: Exception) {
            false
        }
    }
}
