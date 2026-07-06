import SwiftUI

struct AuthView: View {
    @EnvironmentObject private var appState: AppState
    @State private var email = ""
    @State private var password = ""
    @State private var isSignUp = false
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Spacer()
            Text("HEALTH AGG")
                .font(.caption.weight(.semibold))
                .kerning(2)
                .foregroundStyle(.secondary)
            Text("Every night and every mile, on one page")
                .font(.title2.weight(.semibold))
            Text("Sleep, recovery, and training from WHOOP, Eight Sleep, and Strava.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .padding(.bottom, 16)

            TextField("Email", text: $email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .autocapitalization(.none)
                .textFieldStyle(.roundedBorder)
            SecureField("Password", text: $password)
                .textContentType(isSignUp ? .newPassword : .password)
                .textFieldStyle(.roundedBorder)

            if let error {
                Text(error).font(.footnote).foregroundStyle(.red)
            }

            Button(action: submit) {
                if busy {
                    ProgressView().frame(maxWidth: .infinity)
                } else {
                    Text(isSignUp ? "Create account" : "Sign in").frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(busy || email.isEmpty || password.count < 8)

            Button(isSignUp ? "Have an account? Sign in" : "No account? Sign up") {
                isSignUp.toggle()
                error = nil
            }
            .font(.footnote)
            .frame(maxWidth: .infinity)
            Spacer()
        }
        .padding(24)
    }

    private func submit() {
        busy = true
        error = nil
        Task {
            defer { busy = false }
            do {
                if isSignUp {
                    try await appState.supabase.auth.signUp(email: email, password: password)
                } else {
                    try await appState.supabase.auth.signIn(email: email, password: password)
                }
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}
