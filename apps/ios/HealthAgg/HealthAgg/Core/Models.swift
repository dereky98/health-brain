import Foundation

// Hand-written Codable models mirroring the canonical tables (snake_case keys).

struct DailySummary: Codable, Identifiable {
    var id: String { localDate }
    let localDate: String
    let sleepProvider: String?
    let sleepScore: Double?
    let durationAsleepS: Int?
    let timeInBedS: Int?
    let sleepStartAt: Date?
    let sleepEndAt: Date?
    let recoveryScore: Double?
    let recoveryHrvMs: Double?
    let restingHrBpm: Double?
    let dayStrain: Double?
    let workoutCount: Int?
    let workoutsDurationS: Int?
    let workoutsDistanceM: Double?

    enum CodingKeys: String, CodingKey {
        case localDate = "local_date"
        case sleepProvider = "sleep_provider"
        case sleepScore = "sleep_score"
        case durationAsleepS = "duration_asleep_s"
        case timeInBedS = "time_in_bed_s"
        case sleepStartAt = "sleep_start_at"
        case sleepEndAt = "sleep_end_at"
        case recoveryScore = "recovery_score"
        case recoveryHrvMs = "recovery_hrv_ms"
        case restingHrBpm = "resting_hr_bpm"
        case dayStrain = "day_strain"
        case workoutCount = "workout_count"
        case workoutsDurationS = "workouts_duration_s"
        case workoutsDistanceM = "workouts_distance_m"
    }
}

struct SleepSession: Codable, Identifiable {
    let id: UUID
    let provider: String
    let localDate: String
    let startAt: Date
    let endAt: Date
    let durationAsleepS: Int?
    let timeInBedS: Int?
    let stageDeepS: Int?
    let stageRemS: Int?
    let hrvRmssdMs: Double?
    let score: Double?
    let isNap: Bool

    enum CodingKeys: String, CodingKey {
        case id, provider, score
        case localDate = "local_date"
        case startAt = "start_at"
        case endAt = "end_at"
        case durationAsleepS = "duration_asleep_s"
        case timeInBedS = "time_in_bed_s"
        case stageDeepS = "stage_deep_s"
        case stageRemS = "stage_rem_s"
        case hrvRmssdMs = "hrv_rmssd_ms"
        case isNap = "is_nap"
    }
}

struct Workout: Codable, Identifiable {
    let id: UUID
    let provider: String
    let localDate: String
    let startAt: Date
    let sport: String
    let durationS: Int?
    let distanceM: Double?
    let avgHrBpm: Double?
    let caloriesKcal: Double?
    let strain: Double?

    enum CodingKeys: String, CodingKey {
        case id, provider, sport, strain
        case localDate = "local_date"
        case startAt = "start_at"
        case durationS = "duration_s"
        case distanceM = "distance_m"
        case avgHrBpm = "avg_hr_bpm"
        case caloriesKcal = "calories_kcal"
    }
}

struct RecoveryMetric: Codable, Identifiable {
    let id: UUID
    let provider: String
    let localDate: String
    let recoveryScore: Double?
    let hrvRmssdMs: Double?
    let restingHrBpm: Double?
    let dayStrain: Double?

    enum CodingKeys: String, CodingKey {
        case id, provider
        case localDate = "local_date"
        case recoveryScore = "recovery_score"
        case hrvRmssdMs = "hrv_rmssd_ms"
        case restingHrBpm = "resting_hr_bpm"
        case dayStrain = "day_strain"
    }
}

struct ProviderConnection: Codable, Identifiable {
    let id: UUID
    let provider: String
    let status: String
    let lastSyncedAt: Date?
    let lastSyncError: String?

    enum CodingKeys: String, CodingKey {
        case id, provider, status
        case lastSyncedAt = "last_synced_at"
        case lastSyncError = "last_sync_error"
    }
}

enum Provider: String, CaseIterable {
    case whoop, strava
    case eightSleep = "eight_sleep"

    var displayName: String {
        switch self {
        case .whoop: "WHOOP"
        case .strava: "Strava"
        case .eightSleep: "Eight Sleep"
        }
    }

    var usesOAuth: Bool { self != .eightSleep }
}
