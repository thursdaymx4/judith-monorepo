import ExpoModulesCore
import Foundation
#if canImport(FinanceKit)
import FinanceKit
#endif

/// On-device discovery of recurring bills via Apple's FinanceKit framework.
///
/// **Privacy invariant**: raw transactions never cross the RN bridge. The
/// Swift side queries FK, clusters merchant + amount + cadence locally, and
/// emits aggregate `BillCandidate` dictionaries containing only:
///   - normalized merchant name
///   - median paid amount
///   - typical day-of-month
///   - occurrence count
///   - confidence score
///
/// Available iOS 17.4+ on devices where the user has an eligible Apple
/// account (typically requires Apple Card history). Everywhere else the
/// public functions report unavailability so the JS layer can silently
/// skip the FK-gated UI.
public final class JudithFinanceKitModule: Module {
    public func definition() -> ModuleDefinition {
        Name("JudithFinanceKitModule")

        AsyncFunction("isAvailable") { () -> Bool in
            await Self.computeAvailability()
        }

        AsyncFunction("currentAuthorizationStatus") { () -> String in
            await Self.computeAuthorizationStatus().rawJSValue
        }

        AsyncFunction("requestAuthorization") { () -> String in
            await Self.computeRequestAuthorization().rawJSValue
        }

        AsyncFunction("findRecurringBills") { (days: Int) -> [[String: Any]] in
            await Self.findRecurringBills(days: max(1, min(days, 365)))
        }
    }

    // MARK: — Availability + auth

    /// True iff FK is present + the user's data store reports availability.
    /// FK is only present on iOS 17.4+; the framework canImport check at the
    /// top of this file means non-17.4 builds compile but report false here.
    private static func computeAvailability() async -> Bool {
        #if canImport(FinanceKit)
        guard #available(iOS 17.4, *) else { return false }
        do {
            return try await FinanceStore.shared.isDataAvailable(.financialData)
        } catch {
            return false
        }
        #else
        return false
        #endif
    }

    private static func computeAuthorizationStatus() async -> JudithFKAuthStatus {
        #if canImport(FinanceKit)
        guard #available(iOS 17.4, *) else { return .unavailable }
        let available = (try? await FinanceStore.shared.isDataAvailable(.financialData)) ?? false
        guard available else { return .unavailable }
        do {
            let status = try await FinanceStore.shared.authorizationStatus()
            return JudithFKAuthStatus.from(status)
        } catch {
            return .unavailable
        }
        #else
        return .unavailable
        #endif
    }

    private static func computeRequestAuthorization() async -> JudithFKAuthStatus {
        #if canImport(FinanceKit)
        guard #available(iOS 17.4, *) else { return .unavailable }
        let available = (try? await FinanceStore.shared.isDataAvailable(.financialData)) ?? false
        guard available else { return .unavailable }
        do {
            let status = try await FinanceStore.shared.requestAuthorization()
            return JudithFKAuthStatus.from(status)
        } catch {
            return .unavailable
        }
        #else
        return .unavailable
        #endif
    }

    // MARK: — Recurring-bill discovery

    private static func findRecurringBills(days: Int) async -> [[String: Any]] {
        #if canImport(FinanceKit)
        guard #available(iOS 17.4, *) else { return [] }
        let status = await computeAuthorizationStatus()
        guard status == .authorized else { return [] }

        let txns = await fetchTransactions(days: days)
        guard !txns.isEmpty else { return [] }

        let candidates = clusterRecurring(transactions: txns)
        return candidates.map { $0.asDictionary() }
        #else
        return []
        #endif
    }

    #if canImport(FinanceKit)
    @available(iOS 17.4, *)
    private static func fetchTransactions(days: Int) async -> [FinanceKit.Transaction] {
        let since = Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date()
        let predicate = #Predicate<FinanceKit.Transaction> { txn in
            txn.transactionDate >= since
        }
        let query = TransactionQuery(
            sortDescriptors: [SortDescriptor(\.transactionDate, order: .reverse)],
            predicate: predicate
        )
        do {
            return try await FinanceStore.shared.transactions(query: query)
        } catch {
            return []
        }
    }

    /// Pure clustering pipeline — same merchant + same approximate amount +
    /// ~monthly cadence = a recurring bill candidate. Runs entirely
    /// in-process; never touches network or persistence.
    @available(iOS 17.4, *)
    private static func clusterRecurring(
        transactions: [FinanceKit.Transaction]
    ) -> [DetectedBill] {
        // Only outflows (purchases / debits). Refunds / credits / transfers
        // confuse the recurrence signal.
        let debits = transactions.filter { txn in
            let amount = txn.transactionAmount.amount
            return amount > 0 && txn.transactionType == .purchase
        }

        // Group by normalized merchant name.
        var groups: [String: [FinanceKit.Transaction]] = [:]
        for txn in debits {
            let key = normalizeMerchant(txn.merchantName ?? "")
            guard !key.isEmpty else { continue }
            groups[key, default: []].append(txn)
        }

        var detected: [DetectedBill] = []
        for (key, items) in groups where items.count >= 2 {
            // Sort by date so cadence comparisons are meaningful.
            let sorted = items.sorted { $0.transactionDate < $1.transactionDate }
            let amounts = sorted.map { ($0.transactionAmount.amount as NSDecimalNumber).doubleValue }
            let dueDays = sorted.map { day(of: $0.transactionDate) }
            guard let median = median(of: amounts), median > 0 else { continue }

            // Cadence: median inter-occurrence days. Accept 25..35 as monthly.
            let intervals = zip(sorted.dropFirst(), sorted).map {
                Calendar.current.dateComponents([.day], from: $1.transactionDate, to: $0.transactionDate).day ?? 0
            }
            let medianInterval = median(of: intervals.map(Double.init)) ?? 0
            let isMonthlyish = (25.0...35.0).contains(medianInterval)
            guard isMonthlyish else { continue }

            // Amount stability: how tight is the cluster? 1 - (stddev / median),
            // clamped to [0, 1]. A perfectly stable cluster scores 1.0.
            let amtScore = amountTightness(amounts: amounts, median: median)

            // Cadence stability: similar — tighter intervals score higher.
            let cadScore = cadenceTightness(intervals: intervals.map(Double.init))

            // Confidence combines amount + cadence stability + occurrence
            // count (more = more confident). 4+ occurrences floors at 1.0;
            // 2 occurrences scores 0.5x the rest.
            let occScore = min(1.0, Double(items.count) / 4.0)
            let confidence = 0.4 * amtScore + 0.4 * cadScore + 0.2 * occScore

            // Provider name: use the actual cased name from the most-recent
            // transaction (rather than the lowercase normalized key).
            let displayName = sorted.last?.merchantName ?? key

            detected.append(DetectedBill(
                provider: displayName.trimmingCharacters(in: .whitespacesAndNewlines),
                medianAmount: median,
                typicalDueDay: medianDay(dueDays),
                occurrences: items.count,
                confidence: confidence
            ))
        }

        // Strongest first.
        detected.sort { $0.confidence > $1.confidence }
        // Cap output so a noisy account doesn't drown the picker UI.
        return Array(detected.prefix(20))
    }

    private static func normalizeMerchant(_ raw: String) -> String {
        var s = raw.lowercased()
        // Strip common card-statement noise: "STORE *1234ABCD", trailing
        // city/state suffixes, repeating whitespace.
        s = s.replacingOccurrences(of: #"\*\w+"#, with: "", options: .regularExpression)
        s = s.replacingOccurrences(of: #"\s+#\d+"#, with: "", options: .regularExpression)
        s = s.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        return s.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func day(of date: Date) -> Int {
        Calendar.current.component(.day, from: date)
    }

    private static func median(of values: [Double]) -> Double? {
        guard !values.isEmpty else { return nil }
        let sorted = values.sorted()
        let mid = sorted.count / 2
        if sorted.count % 2 == 1 {
            return sorted[mid]
        }
        return (sorted[mid - 1] + sorted[mid]) / 2.0
    }

    private static func medianDay(_ days: [Int]) -> Int {
        guard !days.isEmpty else { return 1 }
        let sorted = days.sorted()
        return sorted[sorted.count / 2]
    }

    private static func amountTightness(amounts: [Double], median: Double) -> Double {
        guard median > 0, amounts.count > 1 else { return 1.0 }
        let mean = amounts.reduce(0, +) / Double(amounts.count)
        let variance = amounts.reduce(0) { $0 + pow($1 - mean, 2) } / Double(amounts.count)
        let stddev = sqrt(variance)
        let coefficient = stddev / median
        return max(0, min(1, 1 - coefficient))
    }

    private static func cadenceTightness(intervals: [Double]) -> Double {
        guard intervals.count > 1 else { return 0.7 } // single-interval gets a neutral score
        let mean = intervals.reduce(0, +) / Double(intervals.count)
        guard mean > 0 else { return 0 }
        let variance = intervals.reduce(0) { $0 + pow($1 - mean, 2) } / Double(intervals.count)
        let stddev = sqrt(variance)
        let coefficient = stddev / mean
        return max(0, min(1, 1 - coefficient))
    }
    #endif
}

// MARK: — Cross-platform value types

private enum JudithFKAuthStatus: String {
    case notDetermined
    case authorized
    case denied
    case unavailable

    var rawJSValue: String { rawValue }

    #if canImport(FinanceKit)
    @available(iOS 17.4, *)
    static func from(_ status: AuthorizationStatus) -> JudithFKAuthStatus {
        switch status {
        case .notDetermined: return .notDetermined
        case .authorized:    return .authorized
        case .denied:        return .denied
        @unknown default:    return .unavailable
        }
    }
    #endif
}

private struct DetectedBill {
    let provider: String
    let medianAmount: Double
    let typicalDueDay: Int
    let occurrences: Int
    let confidence: Double

    func asDictionary() -> [String: Any] {
        [
            "provider": provider,
            "medianAmount": medianAmount,
            "typicalDueDay": typicalDueDay,
            "occurrences": occurrences,
            "confidence": confidence,
        ]
    }
}
