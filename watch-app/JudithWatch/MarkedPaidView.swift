// MarkedPaidView.swift — confirmation after marking a bill paid.
// Big mint check, "Marked paid", provider · amount, + streak nudge. Auto-returns.
import SwiftUI
#if os(watchOS)
import WatchKit
#endif

struct MarkedPaidView: View {
    @EnvironmentObject var store: BillStore
    @Environment(\.dismiss) private var dismiss
    let provider: String
    let amount: Int
    @State private var pop = false

    var body: some View {
        VStack(spacing: 12) {
            ZStack {
                Circle().fill(WatchTheme.accent).frame(width: 64, height: 64)
                Image(systemName: "checkmark")
                    .font(.system(size: 30, weight: .bold))
                    .foregroundStyle(Color.black)
            }
            .scaleEffect(pop ? 1 : 0.4)
            .opacity(pop ? 1 : 0)

            Text("Marked paid")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(WatchTheme.textHi)
            Text("\(provider) · \(Money.format(amount))")
                .font(.system(size: 13))
                .foregroundStyle(WatchTheme.textMid)

            // streak nudge — ties to the retention / track-record system.
            Text("🔥 \(store.streakMonths)-mo streak")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(WatchTheme.near)
                .padding(.top, 2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(WatchTheme.canvas)
        .navigationBarBackButtonHidden(true)
        .onAppear {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.6)) { pop = true }
            #if os(watchOS)
            WKInterfaceDevice.current().play(.success)
            #endif
            // brief, then auto-return to the list
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { dismiss() }
        }
    }
}
