import Foundation
import Speech
import AVFoundation
import Darwin

let engine = AVAudioEngine()
let request = SFSpeechAudioBufferRecognitionRequest()
var task: SFSpeechRecognitionTask?
var transcript = ""
var finished = false
func finish(_ code: Int32 = 0) {
    guard !finished else { return }; finished = true
    engine.stop(); request.endAudio(); task?.cancel()
    if code == 0 { let data = try! JSONSerialization.data(withJSONObject: ["text": transcript]); print(String(data: data, encoding: .utf8)!) }
    exit(code)
}
func start() {
    guard let recognizer = SFSpeechRecognizer(), recognizer.isAvailable, recognizer.supportsOnDeviceRecognition else {
        fputs("Enable on-device dictation for your language in macOS settings.\n", stderr); finish(1); return
    }
    request.requiresOnDeviceRecognition = true
    request.shouldReportPartialResults = true
    do {
        let input = engine.inputNode
        input.installTap(onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0)) { buffer, _ in request.append(buffer) }
        engine.prepare(); try engine.start()
        task = recognizer.recognitionTask(with: request) { result, error in
            if let result = result { transcript = result.bestTranscription.formattedString; if result.isFinal { finish() } }
            if error != nil { if !transcript.isEmpty { finish() } else { fputs("Speech recognition failed. Check microphone and dictation permissions.\n", stderr); finish(1) } }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 30) { engine.stop(); request.endAudio(); DispatchQueue.main.asyncAfter(deadline: .now() + 3) { finish() } }
    } catch { fputs("Microphone could not be started.\n", stderr); finish(1) }
}
signal(SIGUSR1, SIG_IGN)
let stopSignal = DispatchSource.makeSignalSource(signal: SIGUSR1, queue: .main)
stopSignal.setEventHandler { engine.stop(); request.endAudio(); DispatchQueue.main.asyncAfter(deadline: .now() + 3) { finish() } }
stopSignal.resume()
SFSpeechRecognizer.requestAuthorization { status in
    guard status == .authorized else { fputs("Speech recognition permission denied.\n", stderr); finish(1); return }
    AVCaptureDevice.requestAccess(for: .audio) { allowed in
        guard allowed else { fputs("Microphone permission denied.\n", stderr); finish(1); return }
        DispatchQueue.main.async { start() }
    }
}
RunLoop.main.run()
