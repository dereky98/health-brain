import AuthenticationServices
import SwiftUI

struct ConnectionsView: View {
    @EnvironmentObject private var appState: AppState
    @State private var connections: [ProviderConnection] = []
    @State private var error: String?
    @State private var busyProvider: Provider?
    @State private var showEightSleepForm = false

    var body: some View {
        NavigationStack {
            List {
                if let error {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }
                Section("Providers") {
                    ForEach(Provider.allCases, id: \.rawValue) { provider in
                        providerRow(provider)
                    }
                }
                Section {
                    Button("Sync all now") { Task { await syncNow() } }
                    Button("Sign out", role: .destructive) {
                        Task { try? await appState.supabase.auth.signOut() }
                    }
                }
            }
            .navigationTitle("Connections")
            .refreshable { await load() }
            .task { await load() }
            .sheet(isPresented: $showEightSleepForm) {
                EightSleepConnectSheet {
                    showEightSleepForm = false
                    Task { await load() }
                }
            }
            .onOpenURL { url in
                // healthagg://connected?provider=X or healthagg://connect-error
                if url.host == "connected" { Task { await load() } }
            }
        }
    }

    private func connection(for provider: Provider) -> ProviderConnection? {
        connections.first { $0.provider == provider.rawValue && $0.status != "disconnected" }
    }

    @ViewBuilder private func providerRow(_ provider: Provider) -> some View {
        let conn = connection(for: provider)
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(provider.displayName).font(.subheadline.weight(.medium))
                    if provider == .eightSleep {
                        Text("BETA").font(.caption2.weight(.semibold)).foregroundStyle(.orange)
                    }
                }
                if let conn {
                    Text(statusLabel(conn))
                        .font(.caption)
                        .foregroundStyle(conn.status == "active" ? .secondary : Color.red)
                } else {
                    Text("Not connected").font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
            if busyProvider == provider {
                ProgressView()
            } else if conn == nil || conn?.status == "reauth_required" {
                Button(conn == nil ? "Connect" : "Reconnect") { connect(provider) }
                    .font(.footnote.weight(.semibold))
                    .buttonStyle(.bordered)
            } else {
                Button("Disconnect", role: .destructive) { Task { await disconnect(provider) } }
                    .font(.footnote)
                    .buttonStyle(.borderless)
            }
        }
    }

    private func statusLabel(_ conn: ProviderConnection) -> String {
        switch conn.status {
        case "active":
            if let last = conn.lastSyncedAt {
                return "Synced \(last.formatted(.relative(presentation: .named)))"
            }
            return "Connected"
        case "reauth_required": return "Reconnect needed"
        case "error": return conn.lastSyncError ?? "Sync error"
        default: return conn.status
        }
    }

    // MARK: - Actions

    private func connect(_ provider: Provider) {
        guard provider.usesOAuth else {
            showEightSleepForm = true
            return
        }
        busyProvider = provider
        Task {
            defer { busyProvider = nil }
            do {
                let data = try await appState.callFunction(
                    path: "oauth/start?provider=\(provider.rawValue)&platform=ios",
                    method: "GET"
                )
                guard let body = try JSONSerialization.jsonObject(with: data) as? [String: String],
                      let urlString = body["url"], let url = URL(string: urlString) else {
                    throw URLError(.badServerResponse)
                }
                _ = try await webAuth(url: url)
                await load()
            } catch {
                self.error = error.localizedDescription
            }
        }
    }

    private func webAuth(url: URL) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: Config.oauthCallbackScheme
            ) { callbackURL, error in
                if let callbackURL {
                    continuation.resume(returning: callbackURL)
                } else {
                    continuation.resume(throwing: error ?? URLError(.userCancelledAuthentication))
                }
            }
            session.presentationContextProvider = WebAuthPresenter.shared
            session.start()
        }
    }

    private func disconnect(_ provider: Provider) async {
        busyProvider = provider
        defer { busyProvider = nil }
        do {
            _ = try await appState.callFunction(path: "disconnect?provider=\(provider.rawValue)")
            await load()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func syncNow() async {
        do {
            _ = try await appState.callFunction(path: "sync/now")
            await load()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func load() async {
        do {
            connections = try await appState.supabase
                .from("provider_connections")
                .select("id, provider, status, last_synced_at, last_sync_error")
                .execute().value
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }
}

final class WebAuthPresenter: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = WebAuthPresenter()
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        ASPresentationAnchor()
    }
}

// MARK: - Eight Sleep credentials sheet

struct EightSleepConnectSheet: View {
    @EnvironmentObject private var appState: AppState
    let onConnected: () -> Void

    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Eight Sleep email", text: $email)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                    SecureField("Eight Sleep password", text: $password)
                } footer: {
                    Text("Eight Sleep has no official API, so we sign in with your account once, exchange it for access tokens, and never store your password.")
                }
                if let error {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }
                Button(busy ? "Connecting…" : "Connect") {
                    submit()
                }
                .disabled(busy || email.isEmpty || password.isEmpty)
            }
            .navigationTitle("Connect Eight Sleep")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func submit() {
        busy = true
        error = nil
        Task {
            defer { busy = false }
            do {
                let body = try JSONSerialization.data(withJSONObject: ["email": email, "password": password])
                _ = try await appState.callFunction(path: "connect-eightsleep", body: body)
                onConnected()
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}
