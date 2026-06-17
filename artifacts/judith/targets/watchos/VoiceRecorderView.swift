import SwiftUI
import AVFoundation

/// Full-screen recording UI shown when the user taps "Speak to Judith" on
/// the watch. Replaces the WatchKit `presentTextInputController` dictation
/// flow because that opens a text-input view with a small mic icon, not the
/// Siri-style waveform Carlo wants.
///
/// Behavior:
///   1. On appear, request microphone permission via AVAudioApplication.
///   2. Start AVAudioRecorder with metering enabled into a temp .m4a file.
///   3. Poll the recorder's average power on a 10Hz timer and animate a row
///      of capsules whose height tracks the recent level history.
///   4. Cancel ✕ discards the file and dismisses.
///   5. Done ✓ stops the recorder and hands the file URL to `onDone`; the
///      caller is responsible for uploading to /watch-stt and clearing the
///      file. On unexpected disappear we discard.
///
/// The view is intentionally minimal (no transcription happens here) so the
/// recording UI stays responsive even if STT is slow or fails.
struct VoiceRecorderView: View {
    /// Called with the temp .m4a URL when the user confirms. Caller MUST
    /// remove the file once done with it.
    let onDone: (URL) -> Void
    /// Called when the user cancels or recording cannot start.
    let onCancel: () -> Void

    @State private var recorder: AVAudioRecorder?
    @State private var fileURL: URL?
    @State private var levels: [CGFloat] = Array(repeating: 0, count: 7)
    @State private var levelTimer: Timer?
    @State private var status: Status = .preparing
    @State private var startedAt: Date?

    private enum Status: Equatable {
        case preparing
        case recording
        case denied
        case failed
    }

    private let recordingSettings: [String: Any] = [
        AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
        AVSampleRateKey: 16_000,
        AVNumberOfChannelsKey: 1,
        AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue,
    ]

    /// Hard cap so a stuck recorder can't generate a 30MB file in pocket.
    private let maxDuration: TimeInterval = 30

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {
                // Top bar — Cancel ✕ on the left, Done ✓ on the right.
                HStack {
                    Button(action: cancelTapped) {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 32, height: 32)
                            .background(Circle().fill(Color.white.opacity(0.15)))
                    }
                    .buttonStyle(.plain)

                    Spacer()

                    Button(action: doneTapped) {
                        Image(systemName: "checkmark")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(.black)
                            .frame(width: 32, height: 32)
                            .background(Circle().fill(Color.judithAccent))
                    }
                    .buttonStyle(.plain)
                    .disabled(status != .recording)
                    .opacity(status == .recording ? 1 : 0.4)
                }
                .padding(.horizontal, 6)
                .padding(.top, 2)

                Spacer()

                content

                Spacer()
            }
        }
        .onAppear { begin() }
        .onDisappear { teardown(discardFile: true) }
    }

    @ViewBuilder
    private var content: some View {
        switch status {
        case .preparing:
            ProgressView()
                .tint(Color.judithAccent)
                .scaleEffect(1.1)
        case .recording:
            HStack(spacing: 6) {
                ForEach(0..<levels.count, id: \.self) { i in
                    Capsule()
                        .fill(Color.judithAccent)
                        .frame(width: 8, height: barHeight(at: i))
                        .animation(.easeOut(duration: 0.12), value: levels[i])
                }
            }
            .frame(minHeight: 90)
        case .denied:
            VStack(spacing: 6) {
                Image(systemName: "mic.slash.fill")
                    .font(.title3)
                    .foregroundStyle(.white.opacity(0.85))
                Text("Microphone access denied.")
                    .font(.system(.caption, design: .rounded))
                    .foregroundStyle(.white.opacity(0.9))
                    .multilineTextAlignment(.center)
                Text("Enable it in Settings → Judith → Privacy.")
                    .font(.system(.caption2, design: .rounded))
                    .foregroundStyle(.white.opacity(0.6))
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 14)
        case .failed:
            VStack(spacing: 6) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.title3)
                    .foregroundStyle(Color.judithOverdue)
                Text("Couldn't start the mic. Try again.")
                    .font(.system(.caption, design: .rounded))
                    .foregroundStyle(.white.opacity(0.85))
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 14)
        }
    }

    private func barHeight(at i: Int) -> CGFloat {
        let level = levels[i]
        // Minimum nub so the row is visible even in silence; scale up to
        // ~80pt at full volume.
        return 14 + level * 70
    }

    // MARK: — Recording lifecycle

    private func begin() {
        Task {
            // 1. Configure audio session for record + playback (we want speech
            //    synthesis to still work after the recording finishes).
            let session = AVAudioSession.sharedInstance()
            do {
                // `.defaultToSpeaker` is unavailable on watchOS — the watch
                // routes audio appropriately on its own. Stick with the
                // minimal option set that works on every supported watchOS.
                try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.duckOthers])
                try session.setActive(true)
            } catch {
                await MainActor.run { status = .failed }
                return
            }

            // 2. Request microphone permission. AVAudioApplication is the
            //    modern entry point; AVAudioSession.requestRecordPermission
            //    is deprecated in watchOS 10+.
            let granted: Bool
            if #available(watchOS 10.0, *) {
                granted = await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
                    AVAudioApplication.requestRecordPermission { ok in
                        cont.resume(returning: ok)
                    }
                }
            } else {
                granted = await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
                    session.requestRecordPermission { ok in
                        cont.resume(returning: ok)
                    }
                }
            }
            guard granted else {
                await MainActor.run { status = .denied }
                return
            }

            // 3. Spin up the recorder into a unique temp file.
            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent("watch-ask-\(UUID().uuidString).m4a")
            do {
                let r = try AVAudioRecorder(url: url, settings: recordingSettings)
                r.isMeteringEnabled = true
                let ok = r.record(forDuration: maxDuration)
                guard ok else { throw NSError(domain: "VoiceRecorderView", code: 1) }
                await MainActor.run {
                    recorder = r
                    fileURL = url
                    startedAt = Date()
                    status = .recording
                    startMetering()
                }
            } catch {
                await MainActor.run { status = .failed }
            }
        }
    }

    private func startMetering() {
        levelTimer?.invalidate()
        levelTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
            guard let r = recorder else { return }
            r.updateMeters()
            // averagePower is in dB; -160 = silence, 0 = clipping. Map the
            // useful range (-50 .. 0) to 0..1 so quiet rooms still show a
            // baseline pulse.
            let raw = r.averagePower(forChannel: 0)
            let norm = max(0, min(1, CGFloat((raw + 50) / 50)))
            DispatchQueue.main.async {
                var next = levels
                next.removeFirst()
                next.append(norm)
                levels = next
            }
        }
    }

    // MARK: — Button actions

    private func doneTapped() {
        guard status == .recording, let url = fileURL else {
            // Misfire (button visible but not yet recording) — treat as cancel.
            cancelTapped()
            return
        }
        recorder?.stop()
        levelTimer?.invalidate()
        levelTimer = nil
        recorder = nil
        // Ensure the recorded clip is at least a fraction of a second so we
        // don't ship an empty file that Scribe will reject.
        let elapsed = startedAt.map { Date().timeIntervalSince($0) } ?? 0
        if elapsed < 0.4 {
            try? FileManager.default.removeItem(at: url)
            onCancel()
            return
        }
        onDone(url)
    }

    private func cancelTapped() {
        teardown(discardFile: true)
        onCancel()
    }

    private func teardown(discardFile: Bool) {
        recorder?.stop()
        recorder = nil
        levelTimer?.invalidate()
        levelTimer = nil
        if discardFile, let url = fileURL {
            try? FileManager.default.removeItem(at: url)
            fileURL = nil
        }
    }
}
