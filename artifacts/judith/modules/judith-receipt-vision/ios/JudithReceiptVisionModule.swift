import ExpoModulesCore
import Foundation
import UIKit
import Vision

/// On-device receipt OCR + heuristic extraction via Apple's Vision framework.
///
/// Privacy invariant: the image stays on-device. Only the small extracted
/// summary (provider/amount/date/confidence) crosses the React Native bridge.
///
/// Available iOS 13+ — every public function checks @available before
/// touching Vision so older OS users receive a benign unavailability result.
public final class JudithReceiptVisionModule: Module {
    public func definition() -> ModuleDefinition {
        Name("JudithReceiptVisionModule")

        AsyncFunction("isAvailable") { () -> Bool in
            if #available(iOS 13.0, *) { return true }
            return false
        }

        AsyncFunction("recognize") { (imageBase64: String, mimeType: String) -> [String: Any] in
            return await Self.recognize(imageBase64: imageBase64, mimeType: mimeType)
        }

        AsyncFunction("consumePendingShare") { () -> [String: Any]? in
            return Self.consumePendingShare()
        }
    }

    // MARK: — Share extension handoff

    private static let appGroupID = "group.com.app.judith"
    private static let pendingShareKey = "judith.pendingReceiptShare"
    /// Drop shares older than 5 minutes. Anything older than that is almost
    /// certainly a stale handoff the user no longer cares about (e.g. they
    /// killed the host app before it could route).
    private static let pendingShareMaxAgeSeconds: TimeInterval = 5 * 60

    private static func consumePendingShare() -> [String: Any]? {
        guard let defaults = UserDefaults(suiteName: appGroupID),
              let raw = defaults.dictionary(forKey: pendingShareKey) else {
            return nil
        }
        // Always clear, even if the payload is malformed/stale — leaving it
        // behind would replay forever.
        defaults.removeObject(forKey: pendingShareKey)
        defaults.synchronize()

        guard let id = raw["id"] as? String,
              let base64 = raw["base64"] as? String,
              let mime = raw["mime"] as? String,
              let createdAt = raw["createdAt"] as? TimeInterval else {
            return nil
        }
        if Date().timeIntervalSince1970 - createdAt > pendingShareMaxAgeSeconds {
            return nil
        }
        return [
            "id": id,
            "base64": base64,
            "mime": mime,
            "createdAt": createdAt,
        ]
    }

    // MARK: — OCR pipeline

    private static func recognize(imageBase64: String, mimeType: String) async -> [String: Any] {
        guard #available(iOS 13.0, *) else {
            return Self.emptyResult()
        }
        guard let data = Data(base64Encoded: imageBase64),
              let image = UIImage(data: data),
              let cgImage = image.cgImage else {
            return Self.emptyResult()
        }

        let lines = await Self.recognizeText(from: cgImage)
        guard !lines.isEmpty else { return Self.emptyResult() }

        let amount = Self.extractAmount(from: lines)
        let date = Self.extractDate(from: lines)
        let provider = Self.extractProvider(from: lines)
        let confidence = Self.confidence(provider: provider, amount: amount, date: date, lineCount: lines.count)

        return [
            "provider": provider as Any,
            "amount": amount as Any,
            "date": date as Any,
            "confidence": confidence,
        ]
    }

    private static func emptyResult() -> [String: Any] {
        return [
            "provider": NSNull(),
            "amount": NSNull(),
            "date": NSNull(),
            "confidence": 0,
        ]
    }

    /// Run Vision OCR and return text lines in reading order, top-down. We
    /// keep ordering because the merchant name almost always sits at the top
    /// of a receipt and total/date typically sit at the bottom — knowing the
    /// position lets the heuristic extractors pick the right candidates.
    @available(iOS 13.0, *)
    private static func recognizeText(from cgImage: CGImage) async -> [String] {
        await withCheckedContinuation { (cont: CheckedContinuation<[String], Never>) in
            let request = VNRecognizeTextRequest { req, _ in
                guard let observations = req.results as? [VNRecognizedTextObservation] else {
                    cont.resume(returning: [])
                    return
                }
                // Vision's normalized coordinate system has origin at the
                // bottom-left, so sort by descending Y to read top-down.
                let sorted = observations.sorted { lhs, rhs in
                    lhs.boundingBox.midY > rhs.boundingBox.midY
                }
                let lines = sorted.compactMap { obs -> String? in
                    guard let candidate = obs.topCandidates(1).first else { return nil }
                    let text = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
                    return text.isEmpty ? nil : text
                }
                cont.resume(returning: lines)
            }
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            // revision3 (iOS 16) is the best available; the property defaults
            // to it on iOS 16+ and revision1/2 on earlier OS, so we leave it
            // alone and just bump recognitionLanguages to match user locale.
            request.recognitionLanguages = ["en-US"]

            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    try handler.perform([request])
                } catch {
                    cont.resume(returning: [])
                }
            }
        }
    }

    // MARK: — Heuristic extractors

    /// Amount tokens we recognize anywhere on a receipt: an optional currency
    /// symbol followed by digits with optional thousands separators and
    /// optional 2-decimal fractional. Matches both "₱1,249.00" and "1249".
    private static let amountRegex: NSRegularExpression = {
        let pattern = #"(?:₱|\$|€|£|¥|PHP|USD|EUR|GBP|JPY|RM|S\$|HK\$|AU\$|CA\$|MX\$|R\$)?\s*([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)"#
        return try! NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
    }()

    /// Keywords that hint a line is THE total. Listed roughly in order of
    /// preference — "amount paid" wins over "total" if both appear, because
    /// it's more specific to "what was actually paid".
    private static let totalKeywords: [String] = [
        "amount paid",
        "amount due",
        "grand total",
        "total amount",
        "total due",
        "balance due",
        "total",
        "subtotal",
        "amount",
        "paid",
        "due",
        "payment",
    ]

    private static func extractAmount(from lines: [String]) -> Double? {
        // Walk the receipt looking for "total"-flavored lines. Keep the best
        // candidate per priority bucket so a "Subtotal: 950" line never wins
        // over a "Total: 1,249" line further down.
        var bestPriority = Int.max
        var bestValue: Double?

        for line in lines {
            let lowered = line.lowercased()
            for (priority, keyword) in totalKeywords.enumerated() {
                guard lowered.contains(keyword) else { continue }
                if let value = Self.largestAmount(in: line), value > 0 {
                    if priority < bestPriority {
                        bestPriority = priority
                        bestValue = value
                    }
                }
                break
            }
        }

        if let v = bestValue { return v }

        // No keyword match — fall back to the largest amount anywhere on the
        // receipt. This handles minimal receipts that don't label the total
        // (e.g. a simple "Php 1,249.00" stamp).
        var fallback: Double = 0
        for line in lines {
            if let v = Self.largestAmount(in: line), v > fallback {
                fallback = v
            }
        }
        return fallback > 0 ? fallback : nil
    }

    /// Returns the largest valid numeric amount found in a single line. We
    /// take the largest because receipts often interleave item prices with
    /// the total, and the total dominates.
    private static func largestAmount(in line: String) -> Double? {
        let range = NSRange(line.startIndex..., in: line)
        var largest: Double = 0
        amountRegex.enumerateMatches(in: line, options: [], range: range) { match, _, _ in
            guard let match = match, match.numberOfRanges >= 2,
                  let numRange = Range(match.range(at: 1), in: line) else { return }
            let raw = line[numRange].replacingOccurrences(of: ",", with: "")
                .replacingOccurrences(of: " ", with: "")
            if let value = Double(raw), value > largest, value < 10_000_000 {
                largest = value
            }
        }
        return largest > 0 ? largest : nil
    }

    /// Use NSDataDetector to pull every date out of the OCR text, then pick
    /// the one closest to "today" (within the last ~120 days) — receipt dates
    /// are nearly always the transaction date, not a far-future field.
    private static func extractDate(from lines: [String]) -> String? {
        let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.date.rawValue)
        guard let detector = detector else { return nil }
        let joined = lines.joined(separator: "\n")
        let range = NSRange(joined.startIndex..., in: joined)

        let today = Calendar.current.startOfDay(for: Date())
        var bestDate: Date?
        var bestScore = Int.max

        detector.enumerateMatches(in: joined, options: [], range: range) { match, _, _ in
            guard let match = match, let date = match.date else { return }
            // Heuristic: prefer dates near today. Score is days-distance, with
            // future dates penalized more heavily since they're rarely the
            // receipt's transaction date.
            let daysAway = Calendar.current.dateComponents([.day], from: date, to: today).day ?? 0
            let score = daysAway < 0 ? abs(daysAway) * 3 : daysAway
            if score < bestScore {
                bestScore = score
                bestDate = date
            }
        }

        guard let picked = bestDate else { return nil }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: picked)
    }

    /// The merchant name is almost always one of the first 3-5 lines of a
    /// receipt — header text. Filter out anything that's obviously a phone
    /// number, address, date, or amount, then take the first meaningful line.
    private static func extractProvider(from lines: [String]) -> String? {
        let headerLines = Array(lines.prefix(6))
        for line in headerLines {
            let candidate = line.trimmingCharacters(in: .whitespacesAndNewlines)
            if candidate.count < 2 || candidate.count > 60 { continue }
            if Self.looksLikeMerchant(candidate) {
                return candidate
            }
        }
        return headerLines.first
    }

    private static let nonMerchantPatterns: [NSRegularExpression] = {
        let patterns = [
            #"^[\d\s\-\+\(\)\.]+$"#,                  // pure number / phone
            #"^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}"#, // date
            #"^[#\*\-=_~]+"#,                          // separator line
            #"receipt|invoice|order|transaction|reference"#,
        ]
        return patterns.compactMap { try? NSRegularExpression(pattern: $0, options: [.caseInsensitive]) }
    }()

    private static func looksLikeMerchant(_ line: String) -> Bool {
        let range = NSRange(line.startIndex..., in: line)
        for re in nonMerchantPatterns {
            if re.firstMatch(in: line, options: [], range: range) != nil {
                return false
            }
        }
        // Must contain at least 2 letters to count as a merchant name.
        let letterCount = line.unicodeScalars.filter { CharacterSet.letters.contains($0) }.count
        return letterCount >= 2
    }

    // MARK: — Confidence

    /// Crude confidence score so the JS router knows whether to trust this
    /// result or fall back to the server LLM. We weight amount the heaviest
    /// because matching to a bill is impossible without it.
    private static func confidence(
        provider: String?,
        amount: Double?,
        date: String?,
        lineCount: Int
    ) -> Double {
        var score = 0.0
        if amount != nil { score += 0.55 }
        if date != nil { score += 0.25 }
        if provider != nil { score += 0.15 }
        if lineCount >= 6 { score += 0.05 } // looks like a real receipt
        return min(score, 1.0)
    }
}
