import BackgroundTasks
import CoreSpotlight
import ExpoModulesCore
import Foundation
import UniformTypeIdentifiers
import UserNotifications
import WidgetKit

#if canImport(FinanceKit)
import FinanceKit
#endif

#if canImport(FoundationModels)
import FoundationModels
#endif

public final class JudithWidgetBridgeModule: Module {
    private enum Config {
        static let appGroupID = "group.com.app.judith"
        static let payloadCacheKey = "judith.payload_v2"
        static let askAccessKey = "judith.ask_access_v1"
        static let intentCommandsKey = "judith.intent_commands_v1"
        static let spotlightDomain = "com.app.judith.bills"
        static let spotlightIndexName = "JudithBills"
        // Phase 3 Sprint 3 — Auto-pay background scan App Group keys.
        // JS writes the snapshot whenever bills/toggles change so the BG
        // handler has fresh inputs without needing to wake the RN runtime.
        static let autoPaySnapshotKey = "judith.autopay.snapshot.v1"
        // Swift writes pending match entries here when a BG-fired
        // notification matches a bill. JS reads + clears on next launch
        // and reconciles with its AsyncStorage activity log.
        static let autoPayPendingKey  = "judith.autopay.pending.v1"
    }

    private struct Payload: Decodable {
        let currency: String
        let upcomingBills: [Bill]
    }

    private struct Bill: Decodable {
        let id: String
        let provider: String
        let amount: Double
        let dueDays: Int
        let dueLabel: String
        let isOverdue: Bool
    }

    private struct BillPaymentCandidate {
        let id: String
        let provider: String
        let amount: Double
    }

    public func definition() -> ModuleDefinition {
        Name("JudithWidgetBridge")

        Function("writePayload") { (json: String) in
            guard let defaults = UserDefaults(suiteName: Config.appGroupID),
                  let data = json.data(using: .utf8) else {
                return
            }

            defaults.set(data, forKey: Config.payloadCacheKey)
            indexBillsForSpotlight(data: data)
            WidgetCenter.shared.reloadAllTimelines()
        }

        Function("writeAskAccess") { (tier: String, asksLeft: Int) in
            guard let defaults = UserDefaults(suiteName: Config.appGroupID) else {
                return
            }

            let payload: [String: Any] = [
                "tier": tier,
                "asksLeft": max(0, asksLeft),
                "updatedAt": ISO8601DateFormatter().string(from: Date()),
            ]
            guard JSONSerialization.isValidJSONObject(payload),
                  let data = try? JSONSerialization.data(withJSONObject: payload) else {
                return
            }
            defaults.set(data, forKey: Config.askAccessKey)
        }

        Function("readIntentCommands") { () -> String in
            guard let defaults = UserDefaults(suiteName: Config.appGroupID),
                  let data = defaults.data(forKey: Config.intentCommandsKey),
                  let json = String(data: data, encoding: .utf8) else {
                return "[]"
            }

            return json
        }

        Function("clearIntentCommands") { (idsJson: String) in
            guard let defaults = UserDefaults(suiteName: Config.appGroupID),
                  let data = defaults.data(forKey: Config.intentCommandsKey),
                  let idsData = idsJson.data(using: .utf8),
                  let ids = try? JSONDecoder().decode([String].self, from: idsData) else {
                return
            }

            struct IntentCommand: Codable {
                let id: String
            }

            let commands = (try? JSONDecoder().decode([IntentCommand].self, from: data)) ?? []
            let remaining = commands.filter { !ids.contains($0.id) }
            if let encoded = try? JSONEncoder().encode(remaining) {
                defaults.set(encoded, forKey: Config.intentCommandsKey)
            }
        }

        AsyncFunction("foundationModelStatus") { () async -> String in
            self.encode(Self.foundationModelStatusPayload())
        }

        AsyncFunction("classifyBillCategory") { (provider: String, categoriesJson: String) async -> String in
            await self.classifyBillCategory(provider: provider, categoriesJson: categoriesJson)
        }

        AsyncFunction("classifyAskIntent") { (prompt: String, billsJson: String, currency: String) async -> String in
            await self.classifyAskIntent(prompt: prompt, billsJson: billsJson, currency: currency)
        }

        AsyncFunction("financeKitStatus") { () async -> String in
            await self.financeKitStatusPayload(requestAuthorization: false)
        }

        AsyncFunction("requestFinanceKitAuthorization") { () async -> String in
            await self.financeKitStatusPayload(requestAuthorization: true)
        }

        AsyncFunction("findRecentBillPaymentMatches") { (billsJson: String, currency: String, lookbackDays: Int) async -> String in
            await self.findRecentBillPaymentMatches(
                billsJson: billsJson,
                currency: currency,
                lookbackDays: lookbackDays
            )
        }

        // ─── Phase 3 Sprint 3 — Auto-pay background scan ────────────────
        // JS calls these to seed the snapshot the BG task reads, drain the
        // pending match queue the BG task fills, and (re)schedule the
        // task. None of these run FinanceKit themselves — they only move
        // bytes through App Group UserDefaults and the BGTaskScheduler.

        Function("writeAutoPaySnapshot") { (json: String) in
            guard let defaults = UserDefaults(suiteName: Config.appGroupID),
                  let data = json.data(using: .utf8) else { return }
            defaults.set(data, forKey: Config.autoPaySnapshotKey)
        }

        Function("readAutoPayPending") { () -> String in
            guard let defaults = UserDefaults(suiteName: Config.appGroupID),
                  let data = defaults.data(forKey: Config.autoPayPendingKey),
                  let text = String(data: data, encoding: .utf8) else {
                return "[]"
            }
            return text
        }

        Function("clearAutoPayPending") { () in
            guard let defaults = UserDefaults(suiteName: Config.appGroupID) else { return }
            defaults.removeObject(forKey: Config.autoPayPendingKey)
        }

        Function("scheduleAutoPayBGTask") { () -> Bool in
            return Self.scheduleAutoPayBGTask()
        }

        Function("cancelAutoPayBGTask") { () in
            BGTaskScheduler.shared.cancel(
                taskRequestWithIdentifier: JudithWidgetBridgeAppDelegate.autoPayBGTaskIdentifier
            )
        }
    }

    // MARK: — Auto-pay BG scan plumbing

    /// Submits a BGAppRefreshTaskRequest asking iOS to wake us in ≥4h. The
    /// system honors this loosely — typical real-world cadence is 1-2x/day
    /// depending on user habits + device thermals + Low Power Mode. Returns
    /// false when the OS rejects the submit (already scheduled, throttled,
    /// or Background App Refresh disabled in Settings).
    static func scheduleAutoPayBGTask() -> Bool {
        let request = BGAppRefreshTaskRequest(
            identifier: JudithWidgetBridgeAppDelegate.autoPayBGTaskIdentifier
        )
        request.earliestBeginDate = Date(timeIntervalSinceNow: 4 * 60 * 60)
        do {
            try BGTaskScheduler.shared.submit(request)
            return true
        } catch {
            return false
        }
    }

    /// Invoked from JudithWidgetBridgeAppDelegate's launchHandler. Must:
    ///   1. Re-arm the next scheduled run BEFORE doing real work, so a
    ///      crash inside the handler doesn't leave the user with no
    ///      future scans.
    ///   2. Set an expiration handler that cleanly cancels async work
    ///      when iOS revokes the runtime budget (≈30s typical).
    ///   3. Read the snapshot JS wrote, do the FK match + notification
    ///      fan-out, and call task.setTaskCompleted(success:) exactly once.
    static func handleAutoPayBGTask(_ task: BGAppRefreshTask) {
        _ = scheduleAutoPayBGTask()

        let work = Task {
            await Self.runAutoPayScanAndNotify()
            task.setTaskCompleted(success: true)
        }

        task.expirationHandler = {
            work.cancel()
            task.setTaskCompleted(success: false)
        }
    }

    /// Reads the snapshot, calls FinanceKit, and emits one local
    /// notification per actionable match. Auto-mark vs suggest semantics
    /// mirror the JS-side scanAndApply():
    ///   confidence ≥ 0.85 + autoPayMark on  → "Marked X as paid" + UNDO
    ///   confidence ≥ 0.85 + autoPayMark off → "X cleared. Mark paid?"
    ///   0.60 ≤ confidence < 0.85            → "Did you pay X?"
    ///
    /// The JS-side activity log + bill state changes are applied later via
    /// readAutoPayPending() at the next app launch. Until then the user
    /// sees the notification(s) but the in-app activity log lags by one
    /// open — acceptable because the notification is the contemporaneous
    /// record.
    private static func runAutoPayScanAndNotify() async {
        guard let defaults = UserDefaults(suiteName: Config.appGroupID),
              let raw = defaults.data(forKey: Config.autoPaySnapshotKey),
              let snapshot = try? JSONSerialization.jsonObject(with: raw) as? [String: Any]
        else { return }

        guard let bills = snapshot["bills"] as? [[String: Any]], !bills.isEmpty else { return }
        let currency = snapshot["currency"] as? String ?? "$"
        let suggestEnabled = (snapshot["suggestEnabled"] as? Bool) ?? true
        let autoMarkEnabled = (snapshot["autoMarkEnabled"] as? Bool) ?? false
        guard suggestEnabled || autoMarkEnabled else { return }

        let blacklist: [String: Bool]
        if let dict = snapshot["blacklist"] as? [String: Bool] {
            blacklist = dict
        } else if let dict = snapshot["blacklist"] as? [String: NSNumber] {
            // JSON arrives with NSNumber for booleans on some payload paths.
            blacklist = dict.mapValues { $0.boolValue }
        } else {
            blacklist = [:]
        }

        let candidates: [BillPaymentCandidate] = bills.compactMap { dict in
            guard let id = dict["id"] as? String,
                  let provider = dict["provider"] as? String,
                  let amount = (dict["amount"] as? Double) ?? (dict["amount"] as? NSNumber)?.doubleValue
            else { return nil }
            return BillPaymentCandidate(id: id, provider: provider, amount: amount)
        }
        guard !candidates.isEmpty else { return }

        let candidatesJson: String = {
            let payload = candidates.map { ["id": $0.id, "provider": $0.provider, "amount": $0.amount] }
            if let data = try? JSONSerialization.data(withJSONObject: payload),
               let s = String(data: data, encoding: .utf8) { return s }
            return "[]"
        }()

        // Reuse the live match path so confidence + dedup logic stays
        // identical between BG and foreground scans. We talk through a
        // brand-new module instance because the AppDelegate path doesn't
        // hold a reference to the RN-side instance.
        let module = JudithWidgetBridgeModule()
        let matchesJson = await module.findRecentBillPaymentMatches(
            billsJson: candidatesJson,
            currency: currency,
            lookbackDays: 45
        )

        guard let matchesData = matchesJson.data(using: .utf8),
              let response = try? JSONSerialization.jsonObject(with: matchesData) as? [String: Any],
              let matches = response["matches"] as? [[String: Any]],
              !matches.isEmpty
        else { return }

        // Track + append pending entries for JS to reconcile next launch.
        var pending: [[String: Any]] = readPendingEntries(defaults: defaults)

        for raw in matches {
            guard let billId = raw["billId"] as? String,
                  let provider = raw["provider"] as? String,
                  let txnId = raw["transactionId"] as? String,
                  let amount = (raw["amount"] as? Double) ?? (raw["amount"] as? NSNumber)?.doubleValue,
                  let confidence = (raw["confidence"] as? Double) ?? (raw["confidence"] as? NSNumber)?.doubleValue
            else { continue }
            if blacklist["\(billId)__\(txnId)"] == true { continue }
            if confidence < 0.6 { continue }

            let high = confidence >= 0.85
            let entryId = "\(billId)__\(txnId)__\(Int(Date().timeIntervalSince1970 * 1000))"

            let title: String
            let body: String
            let category: String
            let kind: String

            if high && autoMarkEnabled {
                title = "Marked \(provider) as paid"
                body  = "\(format(currency: currency, amount: amount)) cleared on your Apple Card. Tap to undo."
                category = "AUTO_MARK_UNDO"
                kind = "auto-marked"
            } else if suggestEnabled {
                title = high ? "\(provider) \(format(currency: currency, amount: amount)) cleared" : "Did you pay \(provider)?"
                body  = high ? "Looks like this bill cleared on your Apple Card. Tap to mark paid." : "A \(format(currency: currency, amount: amount)) charge looks like this bill. Confirm to mark paid."
                category = "SUGGEST_PAID"
                kind = "suggested"
            } else {
                continue
            }

            await fireNotification(
                title: title,
                body: body,
                category: category,
                entryId: entryId
            )

            pending.append([
                "id": entryId,
                "ts": Int(Date().timeIntervalSince1970 * 1000),
                "kind": kind,
                "billId": billId,
                "billProvider": provider,
                "amount": amount,
                "currency": currency,
                "txnId": txnId,
                "confidence": confidence,
            ])
        }

        if !pending.isEmpty,
           let encoded = try? JSONSerialization.data(withJSONObject: pending) {
            defaults.set(encoded, forKey: Config.autoPayPendingKey)
        }
    }

    private static func readPendingEntries(defaults: UserDefaults) -> [[String: Any]] {
        guard let data = defaults.data(forKey: Config.autoPayPendingKey),
              let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
        else { return [] }
        return parsed
    }

    private static func fireNotification(
        title: String,
        body: String,
        category: String,
        entryId: String
    ) async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else { return }

        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.categoryIdentifier = category
        content.userInfo = ["entryId": entryId, "source": "autopay-bg"]

        let request = UNNotificationRequest(
            identifier: "autopay-\(entryId)",
            content: content,
            trigger: nil
        )
        try? await center.add(request)
    }

    private static func format(currency: String, amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 0
        let rounded = formatter.string(from: NSNumber(value: amount)) ?? "\(Int(amount))"
        return "\(currency)\(rounded)"
    }

    private func indexBillsForSpotlight(data: Data) {
        guard let payload = try? JSONDecoder().decode(Payload.self, from: data) else {
            return
        }

        let items = payload.upcomingBills.map { bill in
            let attributes = CSSearchableItemAttributeSet(contentType: .data)
            attributes.title = bill.provider
            attributes.displayName = "\(bill.provider) bill"
            attributes.contentDescription = spotlightDescription(for: bill, currency: payload.currency)
            attributes.keywords = [
                "Judith",
                "bill",
                "bills",
                bill.provider,
                bill.dueLabel,
                bill.isOverdue ? "overdue" : "upcoming"
            ]

            let item = CSSearchableItem(
                uniqueIdentifier: bill.id,
                domainIdentifier: Config.spotlightDomain,
                attributeSet: attributes
            )
            item.expirationDate = Date(timeIntervalSinceNow: 60 * 60 * 24 * 370)
            return item
        }

        let index = CSSearchableIndex(name: Config.spotlightIndexName)
        index.deleteSearchableItems(withDomainIdentifiers: [Config.spotlightDomain]) { _ in
            guard !items.isEmpty else { return }
            index.indexSearchableItems(items, completionHandler: nil)
        }
    }

    private func spotlightDescription(for bill: Bill, currency: String) -> String {
        let dueText: String
        if bill.dueDays == 0 {
            dueText = "due today"
        } else if bill.dueDays == 1 {
            dueText = "due tomorrow"
        } else if bill.dueDays < 0 {
            dueText = "\(-bill.dueDays) days overdue"
        } else {
            dueText = "due in \(bill.dueDays) days"
        }

        let formattedAmount = NumberFormatter.judithSpotlightAmount.string(
            from: NSNumber(value: bill.amount)
        ) ?? String(format: "%.0f", bill.amount)
        return "\(currency)\(formattedAmount), \(dueText). Tracked in Judith."
    }

    private func classifyBillCategory(provider: String, categoriesJson: String) async -> String {
        let categories = decodeStringArray(categoriesJson)
        let fallback = heuristicCategory(provider: provider, categories: categories)

        guard Self.isFoundationModelAvailable else {
            return encode(fallback)
        }

        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            do {
                let categoryList = categories.joined(separator: ", ")
                let session = LanguageModelSession(
                    instructions: """
                    Classify a bill provider into exactly one category from the allowed list.
                    Reply with compact JSON only: {"category":"...","confidence":0.0}
                    The category must be copied exactly from the allowed list.
                    """
                )
                let response = try await session.respond(
                    to: "Provider: \(provider)\nAllowed categories: \(categoryList)"
                )
                var result = parseCategoryResult(response.content, categories: categories) ?? fallback
                result["source"] = "foundationModels"
                return encode(result)
            } catch {
                return encode(fallback)
            }
        }
        #endif

        return encode(fallback)
    }

    private func classifyAskIntent(prompt: String, billsJson: String, currency: String) async -> String {
        let fallback = heuristicAskIntent(prompt: prompt)

        guard Self.isFoundationModelAvailable else {
            return encode(fallback)
        }

        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            do {
                let compactBills = compactBillsForPrompt(billsJson)
                let session = LanguageModelSession(
                    instructions: """
                    Classify a user request for a bill-tracking app.
                    Return compact JSON only with fields:
                    intent, billName, answer, shouldUseCloud, confidence.
                    Allowed intent values: queryDue, queryOverdue, queryTotal, queryBill, markPaid, addBill, updateBill, reminder, budgetAdvice, unknown.
                    Use shouldUseCloud true for broad financial advice, affordability, income planning, or anything not answerable from the provided bills.
                    For simple due-date, overdue, total, or specific bill questions, use shouldUseCloud false.
                    """
                )
                let response = try await session.respond(
                    to: "Currency: \(currency)\nBills JSON: \(compactBills)\nUser request: \(prompt)"
                )
                var result = parseAskResult(response.content) ?? fallback
                result["source"] = "foundationModels"
                return encode(result)
            } catch {
                return encode(fallback)
            }
        }
        #endif

        return encode(fallback)
    }

    private func financeKitStatusPayload(requestAuthorization: Bool) async -> String {
        #if canImport(FinanceKit)
        if #available(iOS 17.4, *) {
            do {
                let store = FinanceStore.shared
                let status = requestAuthorization
                    ? try await store.requestAuthorization()
                    : try await store.authorizationStatus()
                return encode([
                    "supported": true,
                    "authorizationStatus": Self.financeAuthorizationStatusString(status)
                ])
            } catch {
                return encode([
                    "supported": false,
                    "authorizationStatus": "unknown",
                    "reason": error.localizedDescription
                ])
            }
        }
        #endif

        return encode([
            "supported": false,
            "authorizationStatus": "frameworkUnavailable",
            "reason": "FinanceKit is unavailable in this SDK or on this OS."
        ])
    }

    private func findRecentBillPaymentMatches(billsJson: String, currency: String, lookbackDays: Int) async -> String {
        let bills = decodeBillPaymentCandidates(billsJson)
        guard !bills.isEmpty else {
            return encode([
                "supported": true,
                "authorizationStatus": "notRequired",
                "matches": []
            ])
        }

        #if canImport(FinanceKit)
        if #available(iOS 17.4, *) {
            do {
                let store = FinanceStore.shared
                let status = try await store.authorizationStatus()
                guard status == .authorized else {
                    return encode([
                        "supported": true,
                        "authorizationStatus": Self.financeAuthorizationStatusString(status),
                        "matches": []
                    ])
                }

                let transactionQuery = TransactionQuery(
                    sortDescriptors: [SortDescriptor(\Transaction.transactionDate, order: .reverse)],
                    limit: 500
                )
                let transactions = try await store.transactions(query: transactionQuery)
                let since = Date().addingTimeInterval(-Double(max(1, lookbackDays)) * 24 * 60 * 60)
                let matches = matchBillPayments(
                    bills: bills,
                    transactions: transactions,
                    currency: currency,
                    since: since
                )

                return encode([
                    "supported": true,
                    "authorizationStatus": "authorized",
                    "matches": matches
                ])
            } catch {
                return encode([
                    "supported": false,
                    "authorizationStatus": "unknown",
                    "reason": error.localizedDescription,
                    "matches": []
                ])
            }
        }
        #endif

        return encode([
            "supported": false,
            "authorizationStatus": "frameworkUnavailable",
            "reason": "FinanceKit is unavailable in this SDK or on this OS.",
            "matches": []
        ])
    }

    private static func foundationModelStatusPayload() -> [String: Any] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            let model = SystemLanguageModel.default
            switch model.availability {
            case .available:
                return ["supported": true, "availability": "available"]
            case .unavailable(let reason):
                return [
                    "supported": false,
                    "availability": foundationAvailabilityReasonString(reason),
                    "reason": "\(reason)"
                ]
            @unknown default:
                return ["supported": false, "availability": "unknown"]
            }
        }
        return [
            "supported": false,
            "availability": "unsupportedOS",
            "reason": "Foundation Models requires iOS 26 or later."
        ]
        #else
        return [
            "supported": false,
            "availability": "frameworkUnavailable",
            "reason": "FoundationModels is unavailable in this SDK."
        ]
        #endif
    }

    private static var isFoundationModelAvailable: Bool {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            if case .available = SystemLanguageModel.default.availability {
                return true
            }
        }
        #endif
        return false
    }

    private func decodeStringArray(_ json: String) -> [String] {
        guard let data = json.data(using: .utf8),
              let values = try? JSONDecoder().decode([String].self, from: data) else {
            return []
        }
        return values
    }

    private func compactBillsForPrompt(_ json: String) -> String {
        guard let data = json.data(using: .utf8),
              let decoded = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return "[]"
        }

        let compact = decoded.prefix(30).map { bill -> [String: Any] in
            [
                "provider": bill["provider"] as? String ?? "",
                "amount": numericValue(bill["amount"]),
                "dueDays": bill["dueDays"] as? Int ?? 0,
                "dueLabel": bill["dueLabel"] as? String ?? "",
                "status": bill["status"] as? String ?? "",
                "cat": bill["cat"] as? String ?? ""
            ]
        }

        guard let encoded = try? JSONSerialization.data(withJSONObject: Array(compact)),
              let string = String(data: encoded, encoding: .utf8) else {
            return "[]"
        }
        return string
    }

    private func numericValue(_ value: Any?) -> Double {
        if let double = value as? Double { return double }
        if let int = value as? Int { return Double(int) }
        if let number = value as? NSNumber { return number.doubleValue }
        return 0
    }

    private func decodeBillPaymentCandidates(_ json: String) -> [BillPaymentCandidate] {
        guard let data = json.data(using: .utf8),
              let decoded = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return []
        }

        return decoded.compactMap { object in
            guard let id = object["id"] as? String,
                  let provider = object["provider"] as? String else {
                return nil
            }
            let amount = numericValue(object["amount"])
            guard !id.isEmpty, !provider.isEmpty, amount > 0 else {
                return nil
            }
            return BillPaymentCandidate(id: id, provider: provider, amount: amount)
        }
    }

    private func normalizedTokenText(_ value: String) -> String {
        value
            .lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }

    private func paymentTextScore(provider: String, transactionText: String) -> Double {
        let providerText = normalizedTokenText(provider)
        let transactionText = normalizedTokenText(transactionText)
        guard !providerText.isEmpty, !transactionText.isEmpty else {
            return 0
        }

        if transactionText.contains(providerText) || providerText.contains(transactionText) {
            return 0.58
        }

        let providerTokens = Set(providerText.split(separator: " ").map(String.init).filter { $0.count > 2 })
        let transactionTokens = Set(transactionText.split(separator: " ").map(String.init).filter { $0.count > 2 })
        guard !providerTokens.isEmpty else {
            return 0
        }

        let overlap = providerTokens.intersection(transactionTokens).count
        return min(0.5, Double(overlap) / Double(providerTokens.count) * 0.5)
    }

    private func isoString(_ date: Date?) -> String {
        guard let date else { return "" }
        return ISO8601DateFormatter().string(from: date)
    }

    #if canImport(FinanceKit)
    @available(iOS 17.4, *)
    private func matchBillPayments(
        bills: [BillPaymentCandidate],
        transactions: [Transaction],
        currency: String,
        since: Date
    ) -> [[String: Any]] {
        var matches: [[String: Any]] = []
        let requestedCurrency = currency.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()

        for bill in bills {
            var bestMatch: [String: Any]?
            var bestScore = 0.0

            for transaction in transactions {
                guard transaction.transactionDate >= since else { continue }
                guard transaction.status == .booked || transaction.status == .authorized else { continue }

                let transactionCurrency = transaction.transactionAmount.currencyCode.uppercased()
                if !requestedCurrency.isEmpty, transactionCurrency != requestedCurrency {
                    continue
                }

                let transactionAmount = NSDecimalNumber(decimal: transaction.transactionAmount.amount).doubleValue
                let amountDifference = abs(abs(transactionAmount) - bill.amount)
                let tolerance = max(1.0, bill.amount * 0.05)
                guard amountDifference <= tolerance else { continue }

                let transactionText = [
                    transaction.merchantName,
                    transaction.transactionDescription,
                    transaction.originalTransactionDescription
                ]
                    .compactMap { $0 }
                    .joined(separator: " ")
                let textScore = paymentTextScore(provider: bill.provider, transactionText: transactionText)
                guard textScore > 0 else { continue }

                let amountScore = max(0, 0.32 * (1 - amountDifference / tolerance))
                let directionScore = transaction.creditDebitIndicator == .debit ? 0.1 : 0.04
                let score = min(0.99, textScore + amountScore + directionScore)

                if score > bestScore {
                    bestScore = score
                    bestMatch = [
                        "billId": bill.id,
                        "provider": bill.provider,
                        "transactionId": transaction.id.uuidString,
                        "merchantName": transaction.merchantName ?? "",
                        "transactionDescription": transaction.transactionDescription,
                        "amount": abs(transactionAmount),
                        "currency": transactionCurrency,
                        "transactionDate": isoString(transaction.transactionDate),
                        "postedDate": isoString(transaction.postedDate),
                        "confidence": score
                    ]
                }
            }

            if let bestMatch, bestScore >= 0.7 {
                matches.append(bestMatch)
            }
        }

        return matches.sorted {
            numericValue($0["confidence"]) > numericValue($1["confidence"])
        }
    }
    #endif

    private func parseCategoryResult(_ text: String, categories: [String]) -> [String: Any]? {
        guard let object = parseJSONObject(text),
              let category = object["category"] as? String else {
            return nil
        }

        let safeCategory = categories.contains(category) ? category : "Custom"
        return [
            "category": safeCategory,
            "confidence": min(1, max(0, numericValue(object["confidence"]))),
            "source": "foundationModels"
        ]
    }

    private func parseAskResult(_ text: String) -> [String: Any]? {
        guard let object = parseJSONObject(text),
              let intent = object["intent"] as? String else {
            return nil
        }

        let allowed = Set([
            "queryDue", "queryOverdue", "queryTotal", "queryBill", "markPaid",
            "addBill", "updateBill", "reminder", "budgetAdvice", "unknown"
        ])
        return [
            "intent": allowed.contains(intent) ? intent : "unknown",
            "billName": object["billName"] as? String ?? "",
            "answer": object["answer"] as? String ?? "",
            "shouldUseCloud": object["shouldUseCloud"] as? Bool ?? true,
            "confidence": min(1, max(0, numericValue(object["confidence"]))),
            "source": "foundationModels"
        ]
    }

    private func parseJSONObject(_ text: String) -> [String: Any]? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let jsonText: String
        if let start = trimmed.firstIndex(of: "{"),
           let end = trimmed.lastIndex(of: "}"),
           start <= end {
            jsonText = String(trimmed[start...end])
        } else {
            jsonText = trimmed
        }

        guard let data = jsonText.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return object
    }

    private func heuristicCategory(provider: String, categories: [String]) -> [String: Any] {
        let lower = provider.lowercased()
        func pick(_ category: String) -> String { categories.contains(category) ? category : "Custom" }
        let result: (String, Double)
        if lower.range(of: "meralco|electric|power|energy", options: .regularExpression) != nil {
            result = (pick("Electricity"), 0.9)
        } else if lower.range(of: "water|maynilad|manila water", options: .regularExpression) != nil {
            result = (pick("Water"), 0.9)
        } else if lower.range(of: "internet|wifi|pldt|converge|fiber", options: .regularExpression) != nil {
            result = (pick("Internet"), 0.86)
        } else if lower.range(of: "globe|smart|mobile|phone", options: .regularExpression) != nil {
            result = (pick("Mobile"), 0.84)
        } else if lower.range(of: "netflix|spotify|disney|prime|subscription", options: .regularExpression) != nil {
            result = (pick("Subscription"), 0.84)
        } else if lower.range(of: "visa|mastercard|amex|bpi|bdo|metrobank|card", options: .regularExpression) != nil {
            result = (pick("Credit card"), 0.78)
        } else if lower.range(of: "rent|mortgage|condo|hoa|assoc", options: .regularExpression) != nil {
            result = (pick("Rent / Mortgage"), 0.8)
        } else {
            result = (pick("Custom"), 0.35)
        }

        return ["category": result.0, "confidence": result.1, "source": "heuristic"]
    }

    private func heuristicAskIntent(prompt: String) -> [String: Any] {
        let lower = prompt.lowercased()
        func matches(_ pattern: String) -> Bool {
            lower.range(of: pattern, options: .regularExpression) != nil
        }

        if matches("overdue|late|past due") {
            return askPayload(intent: "queryOverdue", cloud: false, confidence: 0.85)
        }
        if matches("total|how much|owe|monthly|month") {
            return askPayload(intent: "queryTotal", cloud: false, confidence: 0.78)
        }
        if matches("paid|mark.*paid") {
            return askPayload(intent: "markPaid", cloud: false, confidence: 0.78)
        }
        if matches("add|new bill") {
            return askPayload(intent: "addBill", cloud: false, confidence: 0.72)
        }
        if matches("remind|reminder|snooze") {
            return askPayload(intent: "reminder", cloud: false, confidence: 0.72)
        }
        if matches("afford|budget|income|vacation|save") {
            return askPayload(intent: "budgetAdvice", cloud: true, confidence: 0.72)
        }
        if matches("due|today|week|next") {
            return askPayload(intent: "queryDue", cloud: false, confidence: 0.76)
        }
        return askPayload(intent: "unknown", cloud: true, confidence: 0.2)
    }

    private func askPayload(intent: String, cloud: Bool, confidence: Double) -> [String: Any] {
        [
            "intent": intent,
            "shouldUseCloud": cloud,
            "confidence": confidence,
            "source": "heuristic"
        ]
    }

    private func encode(_ object: [String: Any]) -> String {
        guard JSONSerialization.isValidJSONObject(object),
              let data = try? JSONSerialization.data(withJSONObject: object),
              let string = String(data: data, encoding: .utf8) else {
            return "{}"
        }
        return string
    }

    #if canImport(FoundationModels)
    @available(iOS 26.0, *)
    private static func foundationAvailabilityReasonString(_ reason: SystemLanguageModel.Availability.UnavailableReason) -> String {
        switch reason {
        case .deviceNotEligible:
            return "deviceNotEligible"
        case .appleIntelligenceNotEnabled:
            return "appleIntelligenceNotEnabled"
        case .modelNotReady:
            return "modelNotReady"
        @unknown default:
            return "unknown"
        }
    }
    #endif

    #if canImport(FinanceKit)
    @available(iOS 17.4, *)
    private static func financeAuthorizationStatusString(_ status: AuthorizationStatus) -> String {
        switch status {
        case .authorized:
            return "authorized"
        case .denied:
            return "denied"
        case .notDetermined:
            return "notDetermined"
        @unknown default:
            return "unknown"
        }
    }
    #endif
}

private extension NumberFormatter {
    static let judithSpotlightAmount: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 0
        formatter.groupingSeparator = ","
        return formatter
    }()
}
