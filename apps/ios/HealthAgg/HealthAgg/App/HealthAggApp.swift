import SwiftUI

@main
struct HealthAggApp: App {
    @StateObject private var appState = AppState.shared

    var body: some Scene {
        WindowGroup {
            if appState.isSignedIn {
                MainTabView()
                    .environmentObject(appState)
            } else {
                AuthView()
                    .environmentObject(appState)
            }
        }
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            DashboardView()
                .tabItem { Label("Today", systemImage: "sun.max") }
            MetricListView(kind: .sleep)
                .tabItem { Label("Sleep", systemImage: "moon.zzz") }
            MetricListView(kind: .recovery)
                .tabItem { Label("Recovery", systemImage: "heart") }
            MetricListView(kind: .activity)
                .tabItem { Label("Activity", systemImage: "figure.run") }
            ConnectionsView()
                .tabItem { Label("Connections", systemImage: "link") }
        }
        .tint(Color(red: 0.36, green: 0.36, blue: 0.84))
    }
}
