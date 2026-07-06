import Foundation

// Environment configuration. Point these at your Supabase project.
// (For local dev against `supabase start`, use your Mac's LAN IP so a device
// or simulator can reach it, e.g. http://192.168.1.20:55321)
enum Config {
    static let supabaseURL = URL(string: "https://udvicbcbbdurrnapqecg.supabase.co")!
    static let supabaseAnonKey = "REPLACE_WITH_ANON_KEY" // Settings → API → anon/publishable key

    static var functionsURL: URL { supabaseURL.appendingPathComponent("functions/v1") }
    static let oauthCallbackScheme = "healthagg"
}
