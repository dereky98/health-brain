import Charts
import SwiftUI

enum MetricKind: String {
    case sleep, recovery, activity

    var title: String {
        switch self {
        case .sleep: "Sleep"
        case .recovery: "Recovery"
        case .activity: "Activity"
        }
    }

    var color: Color {
        switch self {
        case .sleep: Color(red: 0.36, green: 0.36, blue: 0.84)
        case .recovery: Color(red: 0.09, green: 0.54, blue: 0.39)
        case .activity: Color(red: 0.84, green: 0.38, blue: 0.12)
        }
    }
}

/// One list view parameterized by domain: 30-day chart + provider-tagged rows.
struct MetricListView: View {
    @EnvironmentObject private var appState: AppState
    let kind: MetricKind

    @State private var sleep: [SleepSession] = []
    @State private var recovery: [RecoveryMetric] = []
    @State private var workouts: [Workout] = []
    @State private var error: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    chart
                        .frame(height: 160)
                        .listRowInsets(EdgeInsets(top: 12, leading: 8, bottom: 12, trailing: 12))
                }
                if let error {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }
                Section("Last 30 days") {
                    rows
                }
            }
            .navigationTitle(kind.title)
            .refreshable { await load() }
            .task { await load() }
        }
    }

    @ViewBuilder private var chart: some View {
        switch kind {
        case .sleep:
            Chart(sleep.filter { !$0.isNap }) { s in
                LineMark(
                    x: .value("Night", s.localDate),
                    y: .value("Hours", Double(s.durationAsleepS ?? 0) / 3600)
                )
                .foregroundStyle(by: .value("Source", Fmt.providerLabel(s.provider)))
                .interpolationMethod(.monotone)
            }
            .chartXAxis(.hidden)
        case .recovery:
            Chart(recovery) { r in
                LineMark(x: .value("Day", r.localDate), y: .value("Score", r.recoveryScore ?? 0))
                    .foregroundStyle(kind.color)
                    .interpolationMethod(.monotone)
            }
            .chartXAxis(.hidden)
        case .activity:
            Chart(workouts) { w in
                BarMark(x: .value("Day", w.localDate), y: .value("Minutes", Double(w.durationS ?? 0) / 60))
                    .foregroundStyle(kind.color)
            }
            .chartXAxis(.hidden)
        }
    }

    @ViewBuilder private var rows: some View {
        switch kind {
        case .sleep:
            ForEach(sleep) { s in
                row(
                    title: Fmt.dayLabel(s.localDate),
                    provider: s.provider,
                    primary: Fmt.clockDuration(s.durationAsleepS),
                    secondary: "Deep \(Fmt.clockDuration(s.stageDeepS)) · REM \(Fmt.clockDuration(s.stageRemS)) · Score \(Fmt.int(s.score))"
                )
            }
        case .recovery:
            ForEach(recovery) { r in
                row(
                    title: Fmt.dayLabel(r.localDate),
                    provider: r.provider,
                    primary: Fmt.pct(r.recoveryScore),
                    secondary: "HRV \(Fmt.int(r.hrvRmssdMs)) ms · RHR \(Fmt.int(r.restingHrBpm)) · Strain \(r.dayStrain.map { String(format: "%.1f", $0) } ?? "—")"
                )
            }
        case .activity:
            ForEach(workouts) { w in
                row(
                    title: "\(Fmt.dayLabel(w.localDate)) · \(w.sport.capitalized)",
                    provider: w.provider,
                    primary: Fmt.duration(w.durationS),
                    secondary: [
                        w.distanceM.map { Fmt.km($0) },
                        w.avgHrBpm.map { "\(Fmt.int($0)) bpm" },
                        w.caloriesKcal.map { "\(Fmt.int($0)) kcal" },
                    ].compactMap { $0 }.joined(separator: " · ")
                )
            }
        }
    }

    private func row(title: String, provider: String, primary: String, secondary: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack {
                Text(title).font(.subheadline.weight(.medium))
                Spacer()
                Text(primary).font(.subheadline.monospacedDigit())
            }
            HStack {
                Text(Fmt.providerLabel(provider))
                    .font(.caption2.weight(.medium))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(kind.color.opacity(0.12), in: Capsule())
                    .foregroundStyle(kind.color)
                Text(secondary).font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }

    private func load() async {
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        let start = df.string(from: Calendar.current.date(byAdding: .day, value: -29, to: .now)!)
        do {
            switch kind {
            case .sleep:
                sleep = try await appState.supabase.from("sleep_sessions").select()
                    .gte("local_date", value: start)
                    .order("local_date", ascending: false)
                    .execute().value
            case .recovery:
                recovery = try await appState.supabase.from("recovery_metrics").select()
                    .gte("local_date", value: start)
                    .order("local_date", ascending: false)
                    .execute().value
            case .activity:
                workouts = try await appState.supabase.from("workouts").select()
                    .gte("local_date", value: start)
                    .order("start_at", ascending: false)
                    .execute().value
            }
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }
}
