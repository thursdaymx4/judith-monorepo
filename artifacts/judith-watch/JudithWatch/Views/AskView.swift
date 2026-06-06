import SwiftUI
import AVFoundation

// MARK: — Ask Judith via the Watch's built-in dictation
//
// Tapping the TextField on the Watch opens the system input controller
// (dictation mic, scribble, emoji) — no custom speech recognizer needed.

struct AskView: View {

    @EnvironmentObject var connectivity: ConnectivityService

    @State private var query:     String   = ""
    @State private var viewState: AskState = .idle
    @FocusState private var fieldFocused: Bool

    private let synthesizer = AVSpeechSynthesizer()

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                switch viewState {

                // ── Idle / composing ──────────────────────────────────────
                case .idle:
                    judithAvatar

                    Text("Ask Judith")
                        .font(.system(.headline, design: .rounded, weight: .bold))
                        .foregroundStyle(Color.txtHi)

                    TextField("What do you want to know?", text: $query, axis: .vertical)
                        .focused($fieldFocused)
                        .lineLimit(3)
                        .padding(8)
                        .background(Color.surface1)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .font(.system(.footnote, design: .rounded))
                        .foregroundStyle(Color.txtHi)

                    Button {
                        submitQuery()
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "mic.fill")
                            Text(query.trimmingCharacters(in: .whitespaces).isEmpty
                                 ? "Dictate" : "Ask")
                        }
                        .font(.system(.footnote, design: .rounded, weight: .semibold))
                        .foregroundStyle(.black)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                    }
                    .background(Color.judithAccent)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .onTapGesture {
                        if query.trimmingCharacters(in: .whitespaces).isEmpty {
                            fieldFocused = true
                        } else {
                            submitQuery()
                        }
                    }
                    .simultaneousGesture(TapGesture())

                // ── Asking ────────────────────────────────────────────────
                case .asking:
                    Spacer(minLength: 24)
                    ProgressView()
                        .tint(Color.judithAccent)
                        .scaleEffect(1.4)
                    Text("Judith is thinking…")
                        .font(.system(.caption, design: .rounded))
                        .foregroundStyle(Color.txtMid)
                        .padding(.top, 8)

                // ── Answered ──────────────────────────────────────────────
                case .answered(let reply):
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 6) {
                            judithAvatar.scaleEffect(0.6)
                            Text("Judith")
                                .font(.system(.caption2, design: .rounded, weight: .semibold))
                                .foregroundStyle(Color.judithAccent)
                        }

                        Text(reply)
                            .font(.system(.footnote, design: .rounded))
                            .foregroundStyle(Color.txtHi)
                            .fixedSize(horizontal: false, vertical: true)

                        HStack(spacing: 8) {
                            Button {
                                speak(reply)
                            } label: {
                                Image(systemName: "speaker.wave.2.fill")
                                    .font(.system(.caption))
                                    .foregroundStyle(Color.judithAccent)
                            }
                            .buttonStyle(.plain)

                            Spacer()

                            Button("Ask again") {
                                query     = ""
                                viewState = .idle
                            }
                            .font(.system(.caption2, design: .rounded, weight: .semibold))
                            .tint(Color.judithAccent)
                        }
                        .padding(.top, 4)
                    }
                    .padding(.horizontal, 4)

                // ── Error ─────────────────────────────────────────────────
                case .error(let msg):
                    Spacer(minLength: 16)
                    Image(systemName: "exclamationmark.circle")
                        .font(.system(.title2))
                        .foregroundStyle(Color.judithOverdue)
                    Text(msg)
                        .font(.system(.caption2, design: .rounded))
                        .foregroundStyle(Color.txtMid)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 8)
                    Button("Try again") {
                        query     = ""
                        viewState = .idle
                    }
                    .buttonStyle(.bordered)
                    .tint(Color.judithAccent)
                    .font(.system(.caption2, design: .rounded, weight: .semibold))
                }
            }
            .padding(.bottom, 16)
            .frame(maxWidth: .infinity)
        }
        .background(Color.black)
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

    // MARK: — Actions

    private func submitQuery() {
        let q = query.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { fieldFocused = true; return }

        fieldFocused = false
        viewState    = .asking

        Task {
            do {
                let answer = try await connectivity.sendAsk(query: q)
                viewState = .answered(answer)
                speak(answer)
            } catch ConnectivityService.AskError.phoneNotReachable {
                viewState = .error("iPhone not reachable. Keep your phone nearby and open Judith.")
            } catch {
                viewState = .error("Judith couldn't respond right now. Try again in a moment.")
            }
        }
    }

    private func speak(_ text: String) {
        synthesizer.stopSpeaking(at: .immediate)
        let utt         = AVSpeechUtterance(string: text)
        utt.rate        = 0.52
        utt.pitchMultiplier = 1.05
        utt.volume      = 0.9
        synthesizer.speak(utt)
    }
}

// MARK: — State

private enum AskState {
    case idle
    case asking
    case answered(String)
    case error(String)
}
