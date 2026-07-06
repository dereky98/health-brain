// Placeholder — regenerated from the local Supabase schema via `pnpm --filter @health-agg/types gen`
// after migrations land in M1.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

export type Tables<T extends string> = never;
export type TablesInsert<T extends string> = never;
export type Enums<T extends string> = never;
