import SwiftUI
import Combine

// MARK: — Waiting screen shown before the first WatchPayload arrives from the phone

struct AuthView: View {
    @EnvironmentObject var connectivity: ConnectivityService
    @State private var dotCount = 1
    private let timer = Timer.publish(every: 0.5, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 14) {
            Spacer()

            ZStack {
                Circle()
                    .fill(LinearGradient(
                        colors: [Color(hex: "#959af4"), Color(hex: "#433a85")],
                        startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 52, height: 52)
                Text("J")
                    .font(.system(size: 24, design: .rounded).weight(.bold))
                    .foregroundStyle(.white)
            }

            Text("Judith")
                .font(.system(Font.TextStyle.headline, design: .rounded).weight(.bold))
                .foregroundStyle(Color.txtHi)

            Text("Open Judith on your iPhone to sync\(String(repeating: ".", count: dotCount))")
                .font(.system(Font.TextStyle.footnote, design: .rounded))
                .foregroundStyle(Color.txtMid)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 8)

            if connectivity.isPhoneReachable {
                HStack(spacing: 4) {
                    Circle().fill(Color.judithOK).frame(width: 6, height: 6)
                    Text("Phone connected")
                        .font(.system(Font.TextStyle.caption2, design: .rounded))
                        .foregroundStyle(Color.judithOK)
                }
            }

            Spacer()
        }
        .background(Color.black)
        .onReceive(timer) { _ in
            dotCount = dotCount % 3 + 1
        }
    }
}
