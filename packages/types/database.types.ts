export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_connections: {
        Row: {
          consecutive_failures: number
          created_at: string
          id: string
          last_sync_error: string | null
          last_synced_at: string | null
          next_sync_at: string
          provider: Database["public"]["Enums"]["provider_slug"]
          provider_user_id: string | null
          scopes: string[] | null
          status: Database["public"]["Enums"]["connection_status"]
          sync_cursor: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          consecutive_failures?: number
          created_at?: string
          id?: string
          last_sync_error?: string | null
          last_synced_at?: string | null
          next_sync_at?: string
          provider: Database["public"]["Enums"]["provider_slug"]
          provider_user_id?: string | null
          scopes?: string[] | null
          status?: Database["public"]["Enums"]["connection_status"]
          sync_cursor?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          consecutive_failures?: number
          created_at?: string
          id?: string
          last_sync_error?: string | null
          last_synced_at?: string | null
          next_sync_at?: string
          provider?: Database["public"]["Enums"]["provider_slug"]
          provider_user_id?: string | null
          scopes?: string[] | null
          status?: Database["public"]["Enums"]["connection_status"]
          sync_cursor?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recovery_metrics: {
        Row: {
          created_at: string
          day_kcal: number | null
          day_strain: number | null
          external_id: string
          hrv_rmssd_ms: number | null
          id: string
          local_date: string
          provider: Database["public"]["Enums"]["provider_slug"]
          raw: Json
          recovery_score: number | null
          resting_hr_bpm: number | null
          skin_temp_c: number | null
          spo2_pct: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_kcal?: number | null
          day_strain?: number | null
          external_id: string
          hrv_rmssd_ms?: number | null
          id?: string
          local_date: string
          provider: Database["public"]["Enums"]["provider_slug"]
          raw: Json
          recovery_score?: number | null
          resting_hr_bpm?: number | null
          skin_temp_c?: number | null
          spo2_pct?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_kcal?: number | null
          day_strain?: number | null
          external_id?: string
          hrv_rmssd_ms?: number | null
          id?: string
          local_date?: string
          provider?: Database["public"]["Enums"]["provider_slug"]
          raw?: Json
          recovery_score?: number | null
          resting_hr_bpm?: number | null
          skin_temp_c?: number | null
          spo2_pct?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sleep_sessions: {
        Row: {
          created_at: string
          duration_asleep_s: number | null
          efficiency_pct: number | null
          end_at: string
          external_id: string
          hr_avg_bpm: number | null
          hr_lowest_bpm: number | null
          hrv_rmssd_ms: number | null
          id: string
          is_nap: boolean
          latency_s: number | null
          local_date: string
          provider: Database["public"]["Enums"]["provider_slug"]
          raw: Json
          respiratory_rate: number | null
          score: number | null
          stage_awake_s: number | null
          stage_deep_s: number | null
          stage_light_s: number | null
          stage_rem_s: number | null
          start_at: string
          temp_c: number | null
          time_in_bed_s: number | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_asleep_s?: number | null
          efficiency_pct?: number | null
          end_at: string
          external_id: string
          hr_avg_bpm?: number | null
          hr_lowest_bpm?: number | null
          hrv_rmssd_ms?: number | null
          id?: string
          is_nap?: boolean
          latency_s?: number | null
          local_date: string
          provider: Database["public"]["Enums"]["provider_slug"]
          raw: Json
          respiratory_rate?: number | null
          score?: number | null
          stage_awake_s?: number | null
          stage_deep_s?: number | null
          stage_light_s?: number | null
          stage_rem_s?: number | null
          start_at: string
          temp_c?: number | null
          time_in_bed_s?: number | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_asleep_s?: number | null
          efficiency_pct?: number | null
          end_at?: string
          external_id?: string
          hr_avg_bpm?: number | null
          hr_lowest_bpm?: number | null
          hrv_rmssd_ms?: number | null
          id?: string
          is_nap?: boolean
          latency_s?: number | null
          local_date?: string
          provider?: Database["public"]["Enums"]["provider_slug"]
          raw?: Json
          respiratory_rate?: number | null
          score?: number | null
          stage_awake_s?: number | null
          stage_deep_s?: number | null
          stage_light_s?: number | null
          stage_rem_s?: number | null
          start_at?: string
          temp_c?: number | null
          time_in_bed_s?: number | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workouts: {
        Row: {
          avg_hr_bpm: number | null
          avg_power_w: number | null
          calories_kcal: number | null
          created_at: string
          distance_m: number | null
          duration_s: number | null
          elevation_gain_m: number | null
          end_at: string | null
          external_id: string
          id: string
          local_date: string
          max_hr_bpm: number | null
          moving_s: number | null
          provider: Database["public"]["Enums"]["provider_slug"]
          provider_sport: string | null
          raw: Json
          sport: string
          start_at: string
          strain: number | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_hr_bpm?: number | null
          avg_power_w?: number | null
          calories_kcal?: number | null
          created_at?: string
          distance_m?: number | null
          duration_s?: number | null
          elevation_gain_m?: number | null
          end_at?: string | null
          external_id: string
          id?: string
          local_date: string
          max_hr_bpm?: number | null
          moving_s?: number | null
          provider: Database["public"]["Enums"]["provider_slug"]
          provider_sport?: string | null
          raw: Json
          sport: string
          start_at: string
          strain?: number | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_hr_bpm?: number | null
          avg_power_w?: number | null
          calories_kcal?: number | null
          created_at?: string
          distance_m?: number | null
          duration_s?: number | null
          elevation_gain_m?: number | null
          end_at?: string | null
          external_id?: string
          id?: string
          local_date?: string
          max_hr_bpm?: number | null
          moving_s?: number | null
          provider?: Database["public"]["Enums"]["provider_slug"]
          provider_sport?: string | null
          raw?: Json
          sport?: string
          start_at?: string
          strain?: number | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      connection_status: "active" | "error" | "reauth_required" | "disconnected"
      provider_slug: "whoop" | "strava" | "eight_sleep"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      connection_status: ["active", "error", "reauth_required", "disconnected"],
      provider_slug: ["whoop", "strava", "eight_sleep"],
    },
  },
} as const

