import Foundation
import Supabase

@MainActor
final class AppState: ObservableObject {
    static let shared = AppState()

    let supabase = SupabaseClient(
        supabaseURL: Config.supabaseURL,
        supabaseKey: Config.supabaseAnonKey,
        options: SupabaseClientOptions(db: .init(decoder: .healthAgg))
    )

    @Published var isSignedIn = false

    private init() {
        Task {
            for await (event, session) in supabase.auth.authStateChanges {
                if [.initialSession, .signedIn, .signedOut].contains(event) {
                    isSignedIn = session != nil
                }
            }
        }
    }

    // MARK: - Edge function helpers

    /// Calls an edge function with the user's JWT; returns the decoded JSON body.
    func callFunction(path: String, method: String = "POST", body: Data? = nil) async throws -> Data {
        guard let session = try? await supabase.auth.session else {
            throw URLError(.userAuthenticationRequired)
        }
        var request = URLRequest(url: Config.functionsURL.appendingPathComponent(path))
        request.httpMethod = method
        request.httpBody = body
        request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode([String: String].self, from: data))?["error"]
            throw NSError(
                domain: "HealthAgg",
                code: (response as? HTTPURLResponse)?.statusCode ?? -1,
                userInfo: [NSLocalizedDescriptionKey: message ?? "Request failed"]
            )
        }
        return data
    }
}

extension JSONDecoder {
    /// Decoder for canonical rows: snake-case handled per-model, dates are ISO8601 with fractional seconds fallback.
    static let healthAgg: JSONDecoder = {
        let decoder = JSONDecoder()
        let isoFrac = ISO8601DateFormatter()
        isoFrac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let iso = ISO8601DateFormatter()
        decoder.dateDecodingStrategy = .custom { d in
            let value = try d.singleValueContainer().decode(String.self)
            if let date = isoFrac.date(from: value) ?? iso.date(from: value) { return date }
            throw DecodingError.dataCorrupted(.init(codingPath: d.codingPath, debugDescription: "bad date \(value)"))
        }
        return decoder
    }()
}
