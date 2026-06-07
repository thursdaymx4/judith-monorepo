import SwiftUI

// MARK: — Home "face" tab: paid ring · total owed · next bill · streak

struct FaceView: View {
    @EnvironmentObject var store: WatchStore

    private var fraction: Double { store.paidFraction }

    private var ringColor: Color {
        if store.unpaidCount == 0 { return .judithAccent }
        if store.upcomingBills.first?.urgency == .overdue { return .judithOverdue }
        if store.upcomingBills.first?.urgency == .urgent  { return .judithUrgent }
        return .judithAccent
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {

                // ── Paid progress ring ────────────────────────────────────
                ZStack {
                    Circle()
                        .stroke(Color.surface1, lineWidth: 7)
                        .frame(width: 88, height: 88)

                    Circle()
                        .trim(from: 0, to: fraction)
                        .stroke(
                            ringColor,
                            style: StrokeStyle(lineWidth: 7, lineCap: .round)
                        )
                        .frame(width: 88, height: 88)
                        .rotationEffect(.degrees(-90))
                        .animation(.easeOut(duration: 0.6), value: fraction)

                    if store.totalCount > 0 {
                        VStack(spacing: 1) {
                            Text("\(store.paidCount)")
                                .font(.system(size: 28, design: .rounded).weight(.black))
                                .foregroundStyle(Color.txtHi)
                            Text("of \(store.totalCount)")
                                .font(.system(size: 10, design: .rounded))
                                .foregroundStyle(Color.txtMid)
                        }
                    } else {
                        Image(systemName: "creditcard.fill")
                            .font(.title3)
                            .foregroundStyle(Color.judithAccent)
                    }
                }
                .padding(.top, 6)

                // ── Total owed / all-paid state ───────────────────────────
                if store.totalOwed > 0 {
                    Text(store.payload?.totalOwedDisplay ?? "")
                        .font(.judithMonoLarge)
                        .foregroundStyle(Color.judithAccent)
                } else if store.totalCount > 0 {
                    Label("All paid up!", systemImage: "checkmark.seal.fill")
                        .font(.system(Font.TextStyle.footnote, design: .rounded).weight(.semibold))
                        .foregroundStyle(Color.judithAccent)
                }

                // ── Next bill chip ────────────────────────────────────────
                if let next = store.upcomingBills.first {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(next.urgency.color)
                            .frame(width: 5, height: 5)
                        Text(next.provider)
                            .font(.system(Font.TextStyle.caption, design: .rounded).weight(.medium))
                            .foregroundStyle(Color.txtHi)
                            .lineLimit(1)
                        Spacer()
                        Text(next.dueLabelShort)
                            .font(.system(Font.TextStyle.caption2, design: .monospaced).weight(.semibold))
                            .foregroundStyle(next.urgency.color)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(Color.surface1)
                    .clipShape(RoundedRectangle(cornerRadius: 9))
                }

                // ── Streak badge ──────────────────────────────────────────
                if store.streak > 0 {
                    HStack(spacing: 3) {
                        Text("🔥")
                            .font(.system(size: 11))
                        Text("\(store.streak) paid streak")
                            .font(.system(Font.TextStyle.caption2, design: .rounded).weight(.semibold))
                            .foregroundStyle(Color.judithAccent)
                    }
                    .padding(.horizontal, 9)
                    .padding(.vertical, 4)
                    .background(Color.judithAccent.opacity(0.12))
                    .clipShape(Capsule())
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 6)
            .padding(.bottom, 8)
        }
        .background(Color.black)
    }
}
