import SwiftUI
import AVFoundation
import WatchKit

// MARK: — Ask Judith via the watchOS text input controller

struct AskView: View {

    @EnvironmentObject var connectivity: ConnectivityService

    @State private var query: String = ""
    @State private var viewState: AskState = .idle
    @State private var autoStartedOnAppear = false

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

                    promptCard

                    VStack(spacing: 8) {
                        Button {
                            beginAskFlow()
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
                            beginAskFlow()
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
                        beginAskFlow()
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
            beginAskFlow()
        }
        .onDisappear {
            autoStartedOnAppear = false
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

    private func beginAskFlow() {
        guard canStartInput else { return }
        Task { await requestInputAndAsk() }
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
    private func requestInputAndAsk() async {
        viewState = .capturing

        let captured = await presentTextInput()

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
    private func presentTextInput() async -> String? {
        guard let controller = WKExtension.shared().visibleInterfaceController else {
            return nil
        }

        let suggestions = [
            "What bills are due this week?",
            "How much do I still owe this month?",
            "Which bill should I pay first?"
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

        Task {
            do {
                let answer = try await connectivity.sendAsk(query: trimmed)
                viewState = .answered(answer)
                speak(answer)
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
