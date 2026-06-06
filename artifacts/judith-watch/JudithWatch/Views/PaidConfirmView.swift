import SwiftUI

// MARK: — Paid confirmation (auto-dismisses after 2.5s)

struct PaidConfirmView: View {
    let provider: String
    let amountDisplay: String
    let streak: Int

    @Environment(\.dismiss) private var dismiss

    @State private var scale: CGFloat = 0.4
    @State private var opacity: Double = 0

    var body: some View {
        VStack(spacing: 10) {
            Spacer()

            ZStack {
                Circle()
                    .fill(Color.judithAccent.opacity(0.15))
                    .frame(width: 68, height: 68)
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 44))
                    .foregroundStyle(Color.judithAccent)
            }
            .scaleEffect(scale)
            .opacity(opacity)

            Text("Marked paid")
                .font(.system(.headline, design: .rounded, weight: .bold))
                .foregroundStyle(Color.txtHi)

            Text("\(provider) · \(amountDisplay)")
                .font(.system(.footnote, design: .rounded))
                .foregroundStyle(Color.txtMid)
                .multilineTextAlignment(.center)

            if streak > 1 {
                HStack(spacing: 4) {
                    Text("🔥")
                    Text("\(streak)-bill streak")
                        .font(.system(.caption, design: .rounded, weight: .semibold))
                        .foregroundStyle(Color.judithAccent)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 5)
                .background(Color.judithAccent.opacity(0.12))
                .clipShape(Capsule())
            }

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
        .onAppear {
            withAnimation(.spring(response: 0.45, dampingFraction: 0.65)) {
                scale   = 1.0
                opacity = 1.0
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { dismiss() }
        }
    }
}
