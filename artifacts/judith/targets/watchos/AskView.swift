import SwiftUI
import AVFoundation
import WatchKit

// MARK: — Ask Judith via the watchOS text input controller

struct AskView: View {

    @EnvironmentObject var connectivity: ConnectivityService

    @State private var query: String = ""
    @State private var viewState: AskState = .idle
    @State private var autoStartedOnAppear = false

    /// Running conversation log so follow-up questions ("what about next
    /// month?") carry the prior turns to the backend. Capped to the last 5
    /// turns by the server. Cleared only when the user fully resets the
    /// conversation — "Ask again" preserves it.
    @State private var history: [ConnectivityService.AskTurn] = []

    /// Drives the full-screen voice recorder sheet. Tapping "Speak to Judith"
    /// (or auto-start from the Action Button) flips this to true so the user
    /// gets the Siri-style waveform UI instead of WatchKit's text-input
    /// chooser. "Type or Scribble" continues to use presentTextInputController.
    @State private var showVoiceRecorder = false

    /// TabView selection binding owned by ContentView. AskView reasserts
    /// `selectedTab = tagValue` after every WatchKit interop call so the
    /// user stays on the "Judith is thinking…" / answered screen instead
    /// of being silently switched to FaceView or UpNextView.
    @Binding var selectedTab: Int
    let tagValue: Int

    private let synthesizer = AVSpeechSynthesizer()

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                switch viewState {

                case .idle:
                    judithAvatar

                    Text("Ask Judith")
                        .font(.system(Font.TextStyle.headline, design: .rounded).weight(.bold))
                        .foregroundStyle(Color.txtHi)

                    if connectivity.aiConsented {
                        promptCard

                        VStack(spacing: 8) {
                            Button {
                                beginVoiceAsk()
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: "mic.fill")
                                    Text("Speak to Judith")
                                }
                                .font(.system(Font.TextStyle.footnote, design: .rounded).weight(.semibold))
                                .foregroundStyle(.black)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 10)
                            }
                            .background(Color.judithAccent)
                            .clipShape(RoundedRectangle(cornerRadius: 12))

                            Button {
                                beginAskFlow(voiceOnly: false)
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: "hand.draw.fill")
                                    Text("Type or Scribble")
                                }
                                .font(.system(Font.TextStyle.caption, design: .rounded).weight(.semibold))
                                .foregroundStyle(Color.txtHi)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                            }
                            .background(Color.surface1)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }

                        if !connectivity.isPhoneReachable {
                            Text("Open Judith on your iPhone if this takes a while.")
                                .font(.system(Font.TextStyle.caption2, design: .rounded))
                                .foregroundStyle(Color.txtLow)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 8)
                        }
                    } else {
                        // AI is off on the paired iPhone — hide the CTA and
                        // tell the user where to flip it back on. Matches
                        // Apple Guideline 5.1.1(i)/5.1.2(i) — no third-party
                        // AI surface is reachable without explicit consent.
                        Text("Open Judith on iPhone → Settings → AI Features to enable Ask Judith on your watch.")
                            .font(.system(Font.TextStyle.caption, design: .rounded))
                            .foregroundStyle(Color.txtMid)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 14)
                            .padding(.top, 10)
                    }

                case .capturing:
                    Spacer(minLength: 24)
                    ProgressView()
                        .tint(Color.judithAccent)
                        .scaleEffect(1.2)
                    Text("Open dictation or Scribble…")
                        .font(.system(Font.TextStyle.caption, design: .rounded))
                        .foregroundStyle(Color.txtMid)
                        .padding(.top, 8)

                case .asking:
                    promptCard
                        .padding(.bottom, 4)
                    ProgressView()
                        .tint(Color.judithAccent)
                        .scaleEffect(1.4)
                    Text("Judith is thinking…")
                        .font(.system(Font.TextStyle.caption, design: .rounded))
                        .foregroundStyle(Color.txtMid)
                        .padding(.top, 8)
                    // watchOS suspends the app when the wrist drops, which
                    // pauses the in-flight URL request. A small hint nudges
                    // the user to keep the watch face up; if they don't,
                    // ConnectivityService's 30s timeout surfaces a retryable
                    // error instead of an indefinite spinner.
                    Text("Keep your wrist raised")
                        .font(.system(Font.TextStyle.caption2, design: .rounded))
                        .foregroundStyle(Color.txtLow)
                        .padding(.top, 2)

                case .answered(let reply):
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 6) {
                            judithAvatar.scaleEffect(0.6)
                            Text("Judith")
                                .font(.system(Font.TextStyle.caption2, design: .rounded).weight(.semibold))
                                .foregroundStyle(Color.judithAccent)
                        }

                        if !query.isEmpty {
                            Text(query)
                                .font(.system(Font.TextStyle.caption2, design: .rounded))
                                .foregroundStyle(Color.txtLow)
                                .fixedSize(horizontal: false, vertical: true)
                        }

                        Text(reply)
                            .font(.system(Font.TextStyle.footnote, design: .rounded))
                            .foregroundStyle(Color.txtHi)
                            .fixedSize(horizontal: false, vertical: true)

                        HStack(spacing: 8) {
                            Button {
                                speak(reply)
                            } label: {
                                Label("Play", systemImage: "speaker.wave.2.fill")
                                    .font(.system(Font.TextStyle.caption2, design: .rounded).weight(.semibold))
                                    .foregroundStyle(Color.judithAccent)
                            }
                            .buttonStyle(.plain)

                            Spacer()

                            Button("Ask again") {
                                query = ""
                                viewState = .idle
                            }
                            .font(.system(Font.TextStyle.caption2, design: .rounded).weight(.semibold))
                            .tint(Color.judithAccent)
                        }
                        .padding(.top, 4)
                    }
                    .padding(.horizontal, 4)

                case .error(let message):
                    Spacer(minLength: 16)
                    Image(systemName: "exclamationmark.circle")
                        .font(.title2)
                        .foregroundStyle(Color.judithOverdue)
                    Text(message)
                        .font(.system(Font.TextStyle.caption2, design: .rounded))
                        .foregroundStyle(Color.txtMid)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 8)
                    Button("Ask Judith") {
                        beginVoiceAsk()
                    }
                    .buttonStyle(.bordered)
                    .tint(Color.judithAccent)
                    .font(.system(Font.TextStyle.caption2, design: .rounded).weight(.semibold))
                }
            }
            .padding(.bottom, 16)
            .frame(maxWidth: .infinity)
        }
        .background(Color.black)
        .onAppear {
            guard shouldAutoStartAsk else { return }
            autoStartedOnAppear = true
            // Action-Button / Siri auto-start opens the Siri-style waveform
            // recorder directly — one press, mic on, no chooser.
            beginVoiceAsk()
        }
        .onDisappear {
            autoStartedOnAppear = false
        }
        .fullScreenCover(isPresented: $showVoiceRecorder) {
            VoiceRecorderView(
                onDone: { url in
                    showVoiceRecorder = false
                    Task { await transcribeAndAsk(audioURL: url) }
                },
                onCancel: {
                    showVoiceRecorder = false
                }
            )
        }
    }

    // MARK: — Sub-views

    private var promptCard: some View {
        Text(query.isEmpty ? "Speak right away, or choose type / Scribble if you're in public." : query)
            .frame(maxWidth: .infinity, alignment: .leading)
            .lineLimit(4)
            .padding(10)
            .background(Color.surface1)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .font(.system(Font.TextStyle.footnote, design: .rounded))
            .foregroundStyle(query.isEmpty ? Color.txtLow : Color.txtHi)
    }

    private var judithAvatar: some View {
        Image("JudithAvatar")
            .resizable()
            .scaledToFill()
            .frame(width: 40, height: 40)
            .clipShape(Circle())
    }

    private var shouldAutoStartAsk: Bool {
        guard !autoStartedOnAppear, query.isEmpty else { return false }
        if case .idle = viewState {
            return true
        }
        return false
    }

    // MARK: — Actions

    private func beginAskFlow(voiceOnly: Bool) {
        guard canStartInput else { return }
        Task { await requestInputAndAsk(voiceOnly: voiceOnly) }
    }

    /// Open the Siri-style waveform recorder. Used by the "Speak to Judith"
    /// CTA, the Action-Button auto-start path, and the retry button on the
    /// error state.
    ///
    /// IMPORTANT: do NOT mutate viewState here. The cover is full-screen, so
    /// what's behind it is invisible to the user. If we set .capturing here
    /// and the user taps ✕, the cover-dismiss animation lands before the
    /// onCancel state-reset propagates — the user is briefly stranded on the
    /// legacy ".capturing" UI ("Open dictation or Scribble…") with no way
    /// out. Keeping viewState = .idle means the chooser is already rendered
    /// behind the cover and appears the instant the cover closes.
    private func beginVoiceAsk() {
        guard canStartInput else { return }
        showVoiceRecorder = true
    }

    /// Upload the recorded clip from VoiceRecorderView to /watch-stt and
    /// feed the transcription into the existing submitQuery path. The temp
    /// .m4a file is deleted whether transcription succeeds or fails so the
    /// watch isn't left with growing audio files in tmp.
    @MainActor
    private func transcribeAndAsk(audioURL: URL) async {
        defer { try? FileManager.default.removeItem(at: audioURL) }
        viewState = .asking
        do {
            let text = try await connectivity.transcribeAudio(at: audioURL)
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            // Defensive: ElevenLabs Scribe sometimes returns empty/whitespace
            // for sub-second clips. Don't ship that to /watch-ask.
            guard !trimmed.isEmpty else {
                viewState = .error("Couldn't hear that. Try again.")
                return
            }
            query = trimmed
            submitQuery()
        } catch ConnectivityService.AskError.aiConsentMissing {
            viewState = .error("Open Judith on your iPhone and accept the AI consent to enable voice and Ask.")
        } catch ConnectivityService.AskError.phoneNotReachable {
            viewState = .error("Pair your watch with Judith on iPhone first.")
        } catch {
            viewState = .error("Couldn't transcribe that. Try again.")
        }
    }

    private var canStartInput: Bool {
        switch viewState {
        case .capturing, .asking:
            return false
        case .idle, .answered, .error:
            return true
        }
    }

    @MainActor
    private func requestInputAndAsk(voiceOnly: Bool) async {
        viewState = .capturing

        let captured = await presentTextInput(voiceOnly: voiceOnly)

        // The WatchKit text-input controller dismissed — reassert our tab
        // selection so SwiftUI doesn't drop us onto a different page when
        // control returns to it. Doing this in both branches (cancel and
        // confirm) covers every dismissal path.
        selectedTab = tagValue

        guard let text = captured,
              !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            viewState = .idle
            return
        }

        query = text.trimmingCharacters(in: .whitespacesAndNewlines)
        submitQuery()
    }

    @MainActor
    private func presentTextInput(voiceOnly: Bool) async -> String? {
        guard let controller = WKExtension.shared().visibleInterfaceController else {
            return nil
        }

        // Per Apple's WKInterfaceController docs: passing an EMPTY suggestion
        // array makes presentTextInputController skip the chooser entirely
        // and open the dictation UI directly — matching the Siri long-press
        // UX Carlo wants from the Action Button + "Speak to Judith" CTA. The
        // suggestions array is reserved for the explicit "Type or Scribble"
        // path, which still benefits from canned prompts.
        let suggestions: [String] = voiceOnly ? [] : [
            "What's due this week and how much?",
            "Remaining bills that needs to get paid this month",
            "What's the total due for all my credit cards this month?",
            "What's my estimated total bill for next month?",
            "How much will be left from my income next month after bills?",
            "Can I afford to go on vacation next month?",
            "How much have I paid this month?",
            "Which bills have I already paid this month?",
            "How much do I still owe this month?",
            "What bills are overdue and how much?",
            "Which bill should I pay first?",
            "What's due today?",
            "What's due tomorrow?",
            "What bills are due in the next 7 days?",
            "How much is due before my next payday?",
            "Will my next paycheck cover the bills due before then?",
            "How much do I spend on subscriptions this month?",
            "How much do I spend on utilities this month?",
            "What business bills still need to be paid?",
            "What are my largest bills this month?"
        ]

        let results = await controller.presentTextInputController(
            withSuggestions: suggestions,
            allowedInputMode: .plain
        )

        guard let first = results?.first else { return nil }
        if let text = first as? String { return text }
        if let data = first as? Data,
           let emoji = String(data: data, encoding: .utf8) {
            return emoji
        }
        return nil
    }

    private func submitQuery() {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            viewState = .idle
            return
        }

        query = trimmed
        viewState = .asking

        // Snapshot history BEFORE appending the new turn so the server sees
        // only prior turns as context and the current question stays in the
        // `text` field — same shape the phone /ask endpoint expects.
        let priorHistory = history
        Task {
            do {
                let answer = try await connectivity.sendAsk(query: trimmed, history: priorHistory)
                history.append(.init(role: "user", text: trimmed))
                history.append(.init(role: "assistant", text: answer))
                // Cap locally at the same 5 turns the server caps at, so a
                // long session doesn't grow the @State array unboundedly.
                if history.count > 5 {
                    history.removeFirst(history.count - 5)
                }
                viewState = .answered(answer)
                speak(answer)
            } catch ConnectivityService.AskError.aiConsentMissing {
                viewState = .error("Open Judith on your iPhone and accept the AI consent to enable voice and Ask.")
            } catch ConnectivityService.AskError.phoneNotReachable {
                viewState = .error("iPhone not reachable. Keep your phone nearby and open Judith.")
            } catch ConnectivityService.AskError.serverError(let message) {
                viewState = .error(message.isEmpty ? "Judith couldn't respond right now. Try again in a moment." : message)
            } catch {
                viewState = .error("Judith couldn't respond right now. Try again in a moment.")
            }
        }
    }

    private func speak(_ text: String) {
        synthesizer.stopSpeaking(at: .immediate)

        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            // Best-effort only — speech can still proceed with the default session.
        }

        let utterance = AVSpeechUtterance(string: text)
        utterance.rate = 0.52
        utterance.pitchMultiplier = 1.05
        utterance.volume = 0.9
        utterance.voice = AVSpeechSynthesisVoice(language: Locale.preferredLanguages.first ?? "en-US")
        synthesizer.speak(utterance)
    }
}

// MARK: — State

private enum AskState {
    case idle
    case capturing
    case asking
    case answered(String)
    case error(String)
}
