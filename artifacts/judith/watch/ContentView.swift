/**
 * ContentView.swift — replace the default ContentView in JudithWatch
 *
 * Shows:
 *   • Next due bill (provider, amount, days remaining)
 *   • Urgent bills list (due ≤ 3 days)
 *   • Total owed across all unpaid bills
 *
 * Data arrives via JudithWatchSession from the Judith iOS app.
 */

import SwiftUI

struct ContentView: View {
    @StateObject private var session = JudithWatchSession.shared

    var body: some View {
        Group {
            if !session.hasData {
                waitingView
            } else if session.unpaidCount == 0 {
                allClearView
            } else {
                billsView
            }
        }
    }

    // MARK: - States

    private var waitingView: some View {
        VStack(spacing: 6) {
            Text("👋")
                .font(.title2)
            Text("Judith")
                .font(.headline)
                .foregroundColor(.purple)
            Text("Open the app\non your iPhone")
                .font(.caption2)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
    }

    private var allClearView: some View {
        VStack(spacing: 6) {
            Text("✅")
                .font(.title2)
            Text("All clear!")
                .font(.headline)
            Text("No unpaid bills")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }

    private var billsView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {

                // ── Header ──────────────────────────────
                HStack {
                    Text("JUDITH")
                        .font(.system(size: 9, weight: .black))
                        .foregroundColor(.purple)
                    Spacer()
                    Text("\(session.unpaidCount) unpaid")
                        .font(.system(size: 9))
                        .foregroundColor(.secondary)
                }

                // ── Next due ────────────────────────────
                VStack(alignment: .leading, spacing: 3) {
                    Text(session.nextProvider)
                        .font(.headline)
                        .lineLimit(1)
                    Text(session.pesoStr(session.nextAmount))
                        .font(.title3)
                        .bold()
                        .foregroundColor(.purple)
                    Text(session.nextDueDaysText)
                        .font(.caption2)
                        .foregroundColor(
                            session.nextDueDays == 0 ? .red :
                            session.nextDueDays <= 3 ? .orange : .secondary
                        )
                }
                .padding(9)
                .background(Color.purple.opacity(0.12))
                .cornerRadius(10)

                // ── Urgent list (others) ─────────────────
                let others = session.urgentBills.filter { $0.provider != session.nextProvider }
                if !others.isEmpty {
                    Text("ALSO DUE SOON")
                        .font(.system(size: 8, weight: .semibold))
                        .foregroundColor(.secondary)
                        .padding(.top, 2)

                    ForEach(others) { bill in
                        HStack(spacing: 4) {
                            Text(bill.provider)
                                .font(.caption2)
                                .lineLimit(1)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            Text(session.pesoStr(bill.amount))
                                .font(.caption2)
                                .bold()
                            Text(bill.dueDaysText)
                                .font(.system(size: 8))
                                .foregroundColor(.orange)
                        }
                    }
                }

                // ── Total ────────────────────────────────
                Divider()
                HStack {
                    Text("Total")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    Spacer()
                    Text(session.pesoStr(session.totalOwed))
                        .font(.caption2)
                        .bold()
                }
            }
            .padding(.horizontal, 2)
        }
    }
}

#Preview {
    ContentView()
}
