package com.app.judith.wear.ui.screens

import android.Manifest
import android.media.MediaRecorder
import android.os.Build
import android.speech.tts.TextToSpeech
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.Text
import com.app.judith.wear.JudithColors
import com.app.judith.wear.R
import com.app.judith.wear.data.BillStore
import com.app.judith.wear.data.ChatTurn
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.Locale

private enum class AskState { IDLE, CAPTURING, ASKING, ANSWERED, ERROR }

private val SUGGESTIONS = listOf(
    "What's due this week and how much?",
    "What bills are overdue and how much?",
    "Which bill should I pay first?",
)

@Composable
fun AskScreen(store: BillStore) {
    val payload by store.payload.collectAsState()
    val token by store.token.collectAsState()
    val consented = payload?.aiConsented == true
    val hasToken = token != null
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var state by remember { mutableStateOf(AskState.IDLE) }
    var query by remember { mutableStateOf("") }
    var answer by remember { mutableStateOf("") }
    var errorMsg by remember { mutableStateOf("") }
    val history = remember { mutableStateListOf<ChatTurn>() }

    // ---- TextToSpeech ----
    // init runs async on a binder thread; speak() before SUCCESS is a no-op on
    // many devices, so gate playback on ttsReady. Fall back to US English if the
    // default-locale voice data isn't installed on the watch.
    var ttsReady by remember { mutableStateOf(false) }
    val tts = remember {
        var engine: TextToSpeech? = null
        engine = TextToSpeech(context.applicationContext) { status ->
            if (status == TextToSpeech.SUCCESS) {
                val lang = engine?.setLanguage(Locale.getDefault())
                if (lang == TextToSpeech.LANG_MISSING_DATA || lang == TextToSpeech.LANG_NOT_SUPPORTED) {
                    engine?.language = Locale.US
                }
                engine?.setSpeechRate(0.95f)
                ttsReady = true
            }
        }
        engine
    }
    DisposableEffect(Unit) { onDispose { tts?.shutdown() } }

    // ---- Recorder helper ----
    val recorder = remember { AudioRecorder(context) }

    // Nudge the phone to re-upload a fresh snapshot as soon as Ask opens, so the
    // server-side voice answer (computed from that snapshot) reflects current
    // bills rather than the last sync. Best-effort; no-op if no phone connected.
    LaunchedEffect(Unit) { store.requestPhoneRefresh() }

    fun submit(text: String) {
        if (text.isBlank()) {
            errorMsg = "Couldn't hear that. Try again."
            state = AskState.ERROR
            return
        }
        query = text
        state = AskState.ASKING
        scope.launch {
            val priorHistory = history.toList()
            val result = store.ask(text, priorHistory)
            if (result.error != null) {
                errorMsg = result.error
                state = AskState.ERROR
                return@launch
            }
            val reply = result.answer.orEmpty()
            answer = reply
            history.add(ChatTurn("user", text))
            history.add(ChatTurn("assistant", reply))
            // Forward the FULL action set to the phone so it applies them against
            // its canonical store (add_bill / add_payment / update_amount /
            // update_bill / mark_paid, single or multiple) and re-syncs a fresh
            // payload + snapshot back here. Without this, voice actions never
            // reached the phone — they only hit the backend, which the phone's
            // next sync could overwrite from stale local state.
            result.rawActions?.let { store.forwardActionsToPhone(it) }
            // mark_paid also gets an instant optimistic local update + a backend
            // write, so the watch face reacts immediately and the action still
            // persists if no phone is currently connected.
            result.actions?.forEach { action ->
                if (action.type == "mark_paid" && action.id != null) {
                    store.optimisticallyMarkPaid(action.id)
                    store.postAction("mark_paid", action.id)
                }
            }
            state = AskState.ANSWERED
        }
    }

    fun startRecordingFlow() {
        state = AskState.CAPTURING
        scope.launch {
            val bytes = withContext(Dispatchers.IO) {
                recorder.recordOnce(maxMillis = 30_000)
            }
            if (bytes == null || bytes.isEmpty()) {
                errorMsg = "Couldn't hear that. Try again."
                state = AskState.ERROR
                return@launch
            }
            state = AskState.ASKING
            val transcript = store.stt(bytes)
            if (transcript.isNullOrBlank()) {
                errorMsg = "Couldn't hear that. Try again."
                state = AskState.ERROR
                return@launch
            }
            submit(transcript)
        }
    }

    // Mic permission request.
    val micPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) startRecordingFlow()
        else {
            errorMsg = "Microphone permission needed to talk to Judith."
            state = AskState.ERROR
        }
    }

    // Typed input via the system speech/voice keyboard.
    val voiceInput = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { res ->
        val spoken = res.data
            ?.getStringArrayListExtra(android.speech.RecognizerIntent.EXTRA_RESULTS)
            ?.firstOrNull()
        if (!spoken.isNullOrBlank()) submit(spoken)
    }

    fun launchVoiceKeyboard(prefill: String) {
        val intent = android.content.Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(
                android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM,
            )
            putExtra(android.speech.RecognizerIntent.EXTRA_PROMPT, prefill.ifBlank { "Ask Judith" })
        }
        runCatching { voiceInput.launch(intent) }
    }

    fun requestMicAndRecord() {
        micPermission.launch(Manifest.permission.RECORD_AUDIO)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(JudithColors.background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        when (state) {
            AskState.IDLE -> IdleView(
                consented = consented,
                hasToken = hasToken,
                onSpeak = { requestMicAndRecord() },
                onType = { launchVoiceKeyboard("") },
                onSuggestion = { launchVoiceKeyboard(it) },
            )

            AskState.CAPTURING -> StatusView(
                spinner = true,
                title = "Listening…",
            )

            AskState.ASKING -> StatusView(
                spinner = true,
                title = "Judith is thinking…",
                subtitle = "Keep your wrist raised",
            )

            AskState.ANSWERED -> AnsweredView(
                query = query,
                answer = answer,
                onPlay = { if (ttsReady) tts?.speak(answer, TextToSpeech.QUEUE_FLUSH, null, "judith") },
                onAskAgain = {
                    // Preserve history; reset transient fields.
                    query = ""
                    answer = ""
                    state = AskState.IDLE
                },
            )

            AskState.ERROR -> ErrorView(
                message = errorMsg,
                onRetry = { state = AskState.IDLE },
            )
        }
    }
}

@Composable
private fun IdleView(
    consented: Boolean,
    hasToken: Boolean,
    onSpeak: () -> Unit,
    onType: () -> Unit,
    onSuggestion: (String) -> Unit,
) {
    Box(
        modifier = Modifier.size(56.dp),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            painter = painterResource(R.drawable.judith_avatar),
            contentDescription = "Judith",
            tint = Color.Unspecified,
            modifier = Modifier.size(56.dp),
        )
    }
    Spacer(Modifier.size(8.dp))
    Text("Ask Judith", color = JudithColors.txtHi, fontSize = 16.sp, fontWeight = FontWeight.Bold)

    if (!hasToken) {
        Spacer(Modifier.size(10.dp))
        Text(
            text = "Sign in on the Judith app on your phone to use Ask Judith on your watch.",
            color = JudithColors.txtMid,
            fontSize = 12.sp,
            textAlign = TextAlign.Center,
        )
        return
    }

    if (!consented) {
        Spacer(Modifier.size(10.dp))
        Text(
            text = "Open Judith on your phone → Settings → AI Features to enable Ask Judith on your watch.",
            color = JudithColors.txtMid,
            fontSize = 12.sp,
            textAlign = TextAlign.Center,
        )
        return
    }

    Spacer(Modifier.size(12.dp))
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(JudithColors.surface1, RoundedCornerShape(14.dp))
            .padding(12.dp),
    ) {
        Text("Tap to ask about your bills.", color = JudithColors.txtMid, fontSize = 12.sp)
    }

    Spacer(Modifier.size(12.dp))
    Button(
        onClick = onSpeak,
        colors = ButtonDefaults.buttonColors(
            backgroundColor = JudithColors.accent,
            contentColor = JudithColors.background,
        ),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Icon(Icons.Outlined.Mic, contentDescription = null, modifier = Modifier.size(18.dp))
        Spacer(Modifier.size(8.dp))
        Text("Speak to Judith", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
    }

    Spacer(Modifier.size(8.dp))
    Button(
        onClick = onType,
        colors = ButtonDefaults.buttonColors(
            backgroundColor = JudithColors.surface1,
            contentColor = JudithColors.txtHi,
        ),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text("Type", fontSize = 14.sp)
    }

    Spacer(Modifier.size(12.dp))
    SUGGESTIONS.forEach { s ->
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 3.dp)
                .background(JudithColors.surface2, RoundedCornerShape(12.dp))
                .clickable { onSuggestion(s) }
                .padding(horizontal = 10.dp, vertical = 8.dp),
        ) {
            Text(s, color = JudithColors.txtMid, fontSize = 11.sp)
        }
    }
}

@Composable
private fun StatusView(spinner: Boolean, title: String, subtitle: String? = null) {
    if (spinner) {
        CircularProgressIndicator(
            modifier = Modifier.size(28.dp),
            indicatorColor = JudithColors.accent,
            strokeWidth = 3.dp,
        )
        Spacer(Modifier.size(12.dp))
    }
    Text(title, color = JudithColors.txtHi, fontSize = 14.sp, fontWeight = FontWeight.Medium)
    if (subtitle != null) {
        Spacer(Modifier.size(4.dp))
        Text(subtitle, color = JudithColors.txtLow, fontSize = 11.sp)
    }
}

@Composable
private fun AnsweredView(
    query: String,
    answer: String,
    onPlay: () -> Unit,
    onAskAgain: () -> Unit,
) {
    Box(
        modifier = Modifier.size(40.dp),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            painter = painterResource(R.drawable.judith_avatar),
            contentDescription = "Judith",
            tint = Color.Unspecified,
            modifier = Modifier.size(40.dp),
        )
    }
    Spacer(Modifier.size(6.dp))
    Text("Judith", color = JudithColors.accent, fontSize = 14.sp, fontWeight = FontWeight.Bold)

    if (query.isNotBlank()) {
        Spacer(Modifier.size(8.dp))
        Text(
            text = "“$query”",
            color = JudithColors.txtLow,
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
        )
    }

    Spacer(Modifier.size(8.dp))
    Text(
        text = answer,
        color = JudithColors.txtHi,
        fontSize = 13.sp,
        textAlign = TextAlign.Center,
    )

    Spacer(Modifier.size(14.dp))
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Button(
            onClick = onPlay,
            colors = ButtonDefaults.buttonColors(
                backgroundColor = JudithColors.accent,
                contentColor = JudithColors.background,
            ),
        ) {
            Icon(Icons.Filled.VolumeUp, contentDescription = "Play", modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.size(8.dp))
        Button(
            onClick = onAskAgain,
            colors = ButtonDefaults.buttonColors(
                backgroundColor = JudithColors.surface1,
                contentColor = JudithColors.txtHi,
            ),
            modifier = Modifier.weight(1f),
        ) {
            Icon(Icons.Filled.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
            Spacer(Modifier.size(6.dp))
            Text("Ask again", fontSize = 13.sp)
        }
    }
}

@Composable
private fun ErrorView(message: String, onRetry: () -> Unit) {
    Icon(
        Icons.Filled.Warning,
        contentDescription = null,
        tint = JudithColors.overdue,
        modifier = Modifier.size(30.dp),
    )
    Spacer(Modifier.size(10.dp))
    Text(
        text = message,
        color = JudithColors.txtHi,
        fontSize = 13.sp,
        textAlign = TextAlign.Center,
    )
    Spacer(Modifier.size(14.dp))
    Button(
        onClick = onRetry,
        colors = ButtonDefaults.buttonColors(
            backgroundColor = JudithColors.accent,
            contentColor = JudithColors.background,
        ),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text("Try again", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
    }
}

/**
 * Records a single AAC/m4a clip (mono, 16 kHz) for up to [maxMillis], then
 * returns the raw bytes. Blocking — call from Dispatchers.IO.
 */
private class AudioRecorder(private val context: android.content.Context) {

    fun recordOnce(maxMillis: Long): ByteArray? {
        val file = File(context.cacheDir, "judith_ask.m4a")
        if (file.exists()) file.delete()

        val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(context)
        } else {
            @Suppress("DEPRECATION")
            MediaRecorder()
        }

        return try {
            recorder.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioChannels(1)
                setAudioSamplingRate(16_000)
                setMaxDuration(maxMillis.toInt())
                setOutputFile(file.absolutePath)
                prepare()
                start()
            }
            // Simple fixed-window capture. A production app would stop on
            // silence or a user tap; here we record a fixed window (10s is long
            // enough for a spoken bill question without an on-screen stop).
            Thread.sleep(maxMillis.coerceAtMost(10_000))
            // stop() throws if the clip is too short / has no frames (e.g. mic
            // blocked). Treat that as "no audio" rather than crashing the flow.
            val stopped = runCatching { recorder.stop() }.isSuccess
            runCatching { recorder.release() }
            if (stopped && file.exists() && file.length() > 0) file.readBytes() else null
        } catch (_: Exception) {
            runCatching { recorder.release() }
            null
        }
    }
}
