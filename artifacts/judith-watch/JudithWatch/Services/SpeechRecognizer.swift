import Foundation
import Speech
import AVFoundation

// MARK: — SpeechRecognizer
// Wraps SFSpeechRecognizer + AVAudioEngine for live transcription on watchOS.
// Requires NSMicrophoneUsageDescription + NSSpeechRecognitionUsageDescription
// entries in the Watch app's Info.plist.

@MainActor
final class SpeechRecognizer: ObservableObject {

    @Published var transcript: String = ""
    @Published var isRecording: Bool  = false
    @Published var permissionDenied: Bool = false

    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask:    SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()
    private let recognizer  = SFSpeechRecognizer()

    // MARK: — Permissions

    func requestPermissions() async -> Bool {
        let speechOK = await withCheckedContinuation { cont in
            SFSpeechRecognizer.requestAuthorization { status in
                cont.resume(returning: status == .authorized)
            }
        }
        guard speechOK else { permissionDenied = true; return false }

        let micOK = await AVAudioApplication.requestRecordPermission()
        if !micOK { permissionDenied = true }
        return micOK
    }

    // MARK: — Recording

    func startRecording() {
        guard !isRecording else { return }
        transcript = ""

        // Cancel any prior task
        recognitionTask?.cancel()
        recognitionTask = nil

        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

            recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
            guard let req = recognitionRequest else { return }
            req.shouldReportPartialResults = true

            let inputNode = audioEngine.inputNode
            recognitionTask = recognizer?.recognitionTask(with: req) { [weak self] result, error in
                Task { @MainActor [weak self] in
                    if let result {
                        self?.transcript = result.bestTranscription.formattedString
                    }
                    if error != nil || result?.isFinal == true {
                        self?.stopRecording()
                    }
                }
            }

            let fmt = inputNode.outputFormat(forBus: 0)
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: fmt) { buf, _ in
                req.append(buf)
            }

            audioEngine.prepare()
            try audioEngine.start()
            isRecording = true
        } catch {
            stopRecording()
        }
    }

    func stopRecording() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        recognitionTask    = nil
        isRecording = false

        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
