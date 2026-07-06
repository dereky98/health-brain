import Charts
import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var appState: AppState
    @State private var days: [DailySummary] = []
    @State private var error: String?

    private var today: DailySummary? { days.last }
    private static let sleepColor = Color(red: 0.36, green: 0.36, blue: 0.84)
    private static let recoveryColor = Color(red: 0.09, green: 0.54, blue: 0.39)
    private static let activityColor = Color(red: 0.84, green: 0.38, blue: 0.12)

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    if let error {
                        Text(error).font(.footnote).foregroundStyle(.red)
                    }
                    if days.isEmpty && error == nil {
                        ContentUnavailableView(
                            "No data yet",
                            systemImage: "waveform.path.ecg",
                            description: Text("Connect a provider in the Connections tab to see your first morning report.")
                        )
                        .padding(.top, 60)
                    }

                    if let today {
                        metricCard(
                            title: "SLEEP", color: Self.sleepColor,
                            big: Fmt.clockDuration(today.durationAsleepS),
                            sub: "Score \(Fmt.int(today.sleepScore)) · In bed \(Fmt.clockDuration(today.timeInBedS))",
                            values: days.map { ($0.localDate, Double($0.durationAsleepS ?? 0) / 3600) }
                        )
                        metricCard(
                            title: "RECOVERY", color: Self.recoveryColor,
                            big: Fmt.pct(today.recoveryScore),
                            sub: "HRV \(Fmt.int(today.recoveryHrvMs)) ms · RHR \(Fmt.int(today.restingHrBpm))",
                            values: days.map { ($0.localDate, $0.recoveryScore ?? 0) }
                        )
                        metricCard(
                            title: "ACTIVITY", color: Self.activityColor,
                            big: (today.workoutCount ?? 0) > 0 ? Fmt.duration(today.workoutsDurationS) : "Rest",
                            sub: (today.workoutCount ?? 0) > 0
                                ? "\(today.workoutCount!) session\(today.workoutCount! == 1 ? "" : "s") · \(Fmt.km(today.workoutsDistanceM))"
                                : "No workouts logged",
                            values: days.map { ($0.localDate, Double($0.workoutsDurationS ?? 0) / 60) }
                        )
                    }
                }
                .padding()
            }
            .navigationTitle(Date.now.formatted(.dateTime.weekday(.wide).month().day()))
            .refreshable { await load() }
            .task { await load() }
        }
    }

    private func metricCard(title: String, color: Color, big: String, sub: String, values: [(String, Double)]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title).font(.caption.weight(.semibold)).kerning(1.5).foregroundStyle(color)
                Spacer()
                Chart(values, id: \.0) { point in
                    LineMark(x: .value("Day", point.0), y: .value("v", point.1))
                        .foregroundStyle(color)
                        .interpolationMethod(.monotone)
                }
                .chartXAxis(.hidden)
                .chartYAxis(.hidden)
                .frame(width: 110, height: 28)
            }
            Text(big).font(.system(size: 34, weight: .medium, design: .monospaced))
            Text(sub).font(.footnote).foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 14).fill(Color(.secondarySystemGroupedBackground)))
    }

    private func load() async {
        do {
            let df = DateFormatter()
            df.dateFormat = "yyyy-MM-dd"
            let start = df.string(from: Calendar.current.date(byAdding: .day, value: -13, to: .now)!)
            days = try await appState.supabase
                .from("daily_summaries")
                .select()
                .gte("local_date", value: start)
                .order("local_date")
                .execute()
                .value
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }
}
