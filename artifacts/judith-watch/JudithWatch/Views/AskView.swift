import SwiftUI
import AVFoundation

// MARK: — Ask Judith via voice on the Watch

struct AskView: View {

    @EnvironmentObject var connectivity: ConnectivityService
    @StateObject private var speech = SpeechRecognizer()
    @State private var viewState: AskState = .idle

    private let synthesizer = AVSpeechSynthesizer()

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {

                switch viewState {

                // ── Idle ──────────────────────────────────────────────────
                case .idle:
                    Spacer(minLength: 8)
                    judithAvatar
                    Text("Ask Judith")
                        .font(.system(.headline, design: .rounded, weight: .bold))
                        .foregroundStyle(.txtHi)
                    Text("Tap the mic and ask anything about your bills")
                        .font(.system(.caption2))
                        .foregroundStyle(.txtMid)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 8)
                    micButton

                // ── Recording ─────────────────────────────────────────────
                case .recording:
                    Spacer(minLength: 4)
                    RecordingPulse()
                    if speech.transcript.isEmpty {
                        Text("Listening…")
                            .font(.system(.footnote, design: .rounded))
                            .foregroundStyle(.txtMid)
                    } else {
                        Text(speech.transcript)
                            .font(.system(.footnote, design: .rounded))
                            .foregroundStyle(.txtHi)
                            .multilineTextAlignment(.center)
                            .lineLimit(4)
                            .padding(.horizontal, 6)
                    }
                    Button("Done") {
                        finishRecording()
                    }
                    .buttonStyle(.bordered)
                    .tint(.judithAccent)
                    .font(.system(.footnote, design: .rounded, weight: .semibold))

                // ── Thinking ──────────────────────────────────────────────
                case .thinking:
                    Spacer(minLength: 24)
                    ProgressView()
                        .tint(.judithAccent)
                        .scaleEffect(1.4)
                    Text("Judith is thinking…")
                        .font(.system(.caption, design: .rounded))
                        .foregroundStyle(.txtMid)
                        .padding(.top, 8)

                // ── Answered ──────────────────────────────────────────────
                case .answered(let reply):
                    VStack(alignment: .leading, spacing: 8) {
                        // Judith avatar + label
                        HStack(spacing: 6) {
                            judithAvatar.scaleEffect(0.6)
                            Text("Judith")
                                .font(.system(.caption2, design: .rounded, weight: .semibold))
                                .foregroundStyle(.judithAccent)
                        }

                        Text(reply)
                            .font(.system(.footnote, design: .rounded))
                            .foregroundStyle(.txtHi)
                            .fixedSize(horizontal: false, vertical: true)

                        HStack(spacing: 8) {
                            // Replay audio
                            Button {
                                speak(reply)
                            } label: {
                                Image(systemName: "speaker.wave.2.fill")
                                    .font(.system(.caption))
                                    .foregroundStyle(.judithAccent)
                            }
                            .buttonStyle(.plain)

                            Spacer()

                            // Ask again
                            Button("Ask again") {
                                viewState = .idle
                            }
                            .font(.system(.caption2, design: .rounded, weight: .semibold))
                            .tint(.judithAccent)
                        }
                        .padding(.top, 4)
                    }
                    .padding(.horizontal, 4)

                // ── Error ─────────────────────────────────────────────────
                case .error(let msg):
                    Spacer(minLength: 16)
                    Image(systemName: "exclamationmark.circle")
                        .font(.system(.title2))
                        .foregroundStyle(.judithOverdue)
                    Text(msg)
                        .font(.system(.caption2, design: .rounded))
                        .foregroundStyle(.txtMid)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 8)
                    Button("Try again") {
                        viewState = .idle
                    }
                    .buttonStyle(.bordered)
                    .tint(.judithAccent)
                    .font(.system(.caption2, design: .rounded, weight: .semibold))
                }
            }
            .padding(.bottom, 16)
            .frame(maxWidth: .infinity)
        }
        .background(Color.black)
        .onChange(of: speech.permissionDenied) { _, denied in
            if denied { viewState = .error("Microphone or speech permission denied. Enable in iPhone → Watch settings.") }
        }
    }

    // MARK: — Sub-views

    private var judithAvatar: some View {
        ZStack {
            Circle()
                .fill(LinearGradient(
                    colors: [Color(hex: "#959af4"), Color(hex: "#433a85")],
                    startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(width: 40, height: 40)
            Text("J")
                .font(.system(size: 20, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
        }
    }

    private var micButton: some View {
        Button {
            startRecording()
        } label: {
            ZStack {
                Circle()
                    .fill(Color.judithAccent.opacity(0.15))
                    .frame(width: 56, height: 56)
                Circle()
                    .strokeBorder(Color.judithAccent, lineWidth: 2)
                    .frame(width: 56, height: 56)
                Image(systemName: "mic.fill")
                    .font(.system(size: 22, weight: .medium))
                    .foregroundStyle(.judithAccent)
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: — Actions

    private func startRecording() {
        Task {
            let granted = await speech.requestPermissions()
            guard granted else { return }
            speech.startRecording()
            viewState = .recording
        }
    }

    private func finishRecording() {
        speech.stopRecording()
        let query = speech.transcript.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { viewState = .idle; return }

        viewState = .thinking
        Task {
            do {
                let answer = try await connectivity.sendAsk(query: query)
                viewState = .answered(answer)
                speak(answer)
            } catch ConnectivityService.AskError.phoneNotReachable {
                viewState = .error("iPhone not reachable. Make sure your phone is nearby and the app is open.")
            } catch {
                viewState = .error("Judith couldn't respond right now. Try again in a moment.")
            }
        }
    }

    private func speak(_ text: String) {
        synthesizer.stopSpeaking(at: .immediate)
        let utt = AVSpeechUtterance(string: text)
        utt.rate = 0.52
        utt.pitchMultiplier = 1.05
        utt.volume = 0.9
        synthesizer.speak(utt)
    }
}

// MARK: — AskState

private enum AskState {
    case idle
    case recording
    case thinking
    case answered(String)
    case error(String)
}

// MARK: — Recording pulse animation

private struct RecordingPulse: View {
    @State private var pulsing = false

    var body: some View {
        ZStack {
            Circle()
                .fill(Color.judithOverdue.opacity(0.2))
                .frame(width: 68, height: 68)
                .scaleEffect(pulsing ? 1.18 : 1.0)
                .animation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true), value: pulsing)
            Circle()
                .fill(Color.judithOverdue.opacity(0.12))
                .frame(width: 56, height: 56)
            Image(systemName: "mic.fill")
                .font(.system(size: 22, weight: .medium))
                .foregroundStyle(.judithOverdue)
        }
        .onAppear { pulsing = true }
    }
}
