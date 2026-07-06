import Foundation

enum Fmt {
    static func clockDuration(_ seconds: Int?) -> String {
        guard let seconds else { return "—" }
        let totalMin = Int((Double(seconds) / 60).rounded())
        return "\(totalMin / 60):" + String(format: "%02d", totalMin % 60)
    }

    static func duration(_ seconds: Int?) -> String {
        guard let seconds else { return "—" }
        let totalMin = Int((Double(seconds) / 60).rounded())
        let h = totalMin / 60, m = totalMin % 60
        return h == 0 ? "\(m)m" : "\(h)h \(String(format: "%02d", m))m"
    }

    static func km(_ meters: Double?) -> String {
        guard let meters else { return "—" }
        return String(format: "%.1f km", meters / 1000)
    }

    static func int(_ value: Double?) -> String {
        guard let value else { return "—" }
        return String(Int(value.rounded()))
    }

    static func pct(_ value: Double?) -> String {
        guard let value else { return "—" }
        return "\(Int(value.rounded()))%"
    }

    static func time(_ date: Date?) -> String {
        guard let date else { return "—" }
        return date.formatted(date: .omitted, time: .shortened)
    }

    static func dayLabel(_ localDate: String) -> String {
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        guard let date = df.date(from: localDate) else { return localDate }
        return date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
    }

    static func providerLabel(_ slug: String) -> String {
        Provider(rawValue: slug)?.displayName ?? slug
    }
}
