import SwiftUI

// MARK: — Sign-in (email/password fallback when no phone is paired)

struct AuthView: View {
    @EnvironmentObject var store: BillStore

    @State private var email    = ""
    @State private var password = ""
    @State private var loading  = false
    @State private var errorMsg: String? = nil

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                // Judith avatar placeholder
                ZStack {
                    Circle()
                        .fill(LinearGradient(
                            colors: [Color(hex: "#959af4"), Color(hex: "#433a85")],
                            startPoint: .topLeading, endPoint: .bottomTrailing))
                        .frame(width: 52, height: 52)
                    Text("J")
                        .font(.system(size: 24, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                }
                .padding(.top, 8)

                Text("Judith")
                    .font(.system(.headline, design: .rounded, weight: .bold))
                    .foregroundStyle(.txtHi)

                Text("Sign in with your Judith account, or open the app on your iPhone to sync automatically.")
                    .font(.system(.footnote))
                    .foregroundStyle(.txtMid)
                    .multilineTextAlignment(.center)

                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .padding(10)
                    .background(Color.surface1)
                    .clipShape(RoundedRectangle(cornerRadius: 10))

                SecureField("Password", text: $password)
                    .textContentType(.password)
                    .padding(10)
                    .background(Color.surface1)
                    .clipShape(RoundedRectangle(cornerRadius: 10))

                if let msg = errorMsg {
                    Text(msg)
                        .font(.system(.caption2))
                        .foregroundStyle(.judithOverdue)
                        .multilineTextAlignment(.center)
                }

                Button(action: signIn) {
                    if loading {
                        ProgressView()
                            .tint(.black)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                    } else {
                        Text("Sign in")
                            .font(.system(.body, design: .rounded, weight: .semibold))
                            .foregroundStyle(.black)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                    }
                }
                .background(Color.judithAccent)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .disabled(loading || email.isEmpty || password.isEmpty)
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 16)
        }
        .background(Color.black)
    }

    private func signIn() {
        loading = true
        errorMsg = nil
        Task {
            do {
                let auth = try await SupabaseClient.shared.signIn(email: email, password: password)
                await MainActor.run { store.applyToken(auth.access_token) }
            } catch {
                await MainActor.run {
                    errorMsg = "Couldn't sign in — check your email and password."
                    loading = false
                }
            }
        }
    }
}
