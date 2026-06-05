export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          arrival_balance: number
          created_at: string
          display_order: number
          id: string
          is_paycheck_destination: boolean
          is_vault: boolean
          name: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          arrival_balance?: number
          created_at?: string
          display_order?: number
          id?: string
          is_paycheck_destination?: boolean
          is_vault?: boolean
          name: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          arrival_balance?: number
          created_at?: string
          display_order?: number
          id?: string
          is_paycheck_destination?: boolean
          is_vault?: boolean
          name?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          created_at: string
          description: string
          expense_date: string
          id: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category?: string | null
          created_at?: string
          description: string
          expense_date: string
          id?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      paychecks: {
        Row: {
          actual_net_wages: number | null
          created_at: string
          employer: string
          extra_deposit: number
          hours_worked: number | null
          id: string
          notes: string | null
          ot_hours: number
          pay_date: string
          pay_num: number
          per_diem: number
          received: boolean
          rent_paid: number
          updated_at: string
          user_id: string
          vault_override: number | null
        }
        Insert: {
          actual_net_wages?: number | null
          created_at?: string
          employer: string
          extra_deposit?: number
          hours_worked?: number | null
          id?: string
          notes?: string | null
          ot_hours?: number
          pay_date: string
          pay_num: number
          per_diem?: number
          received?: boolean
          rent_paid?: number
          updated_at?: string
          user_id: string
          vault_override?: number | null
        }
        Update: {
          actual_net_wages?: number | null
          created_at?: string
          employer?: string
          extra_deposit?: number
          hours_worked?: number | null
          id?: string
          notes?: string | null
          ot_hours?: number
          pay_date?: string
          pay_num?: number
          per_diem?: number
          received?: boolean
          rent_paid?: number
          updated_at?: string
          user_id?: string
          vault_override?: number | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          id: string
          ntt_hourly_rate: number
          ntt_net_pct: number
          rent_monthly: number
          rent_months: number
          robinhood_weekly: number
          updated_at: string
          usc_gross_baseline: number
          usc_net_pct: number
          usc_no_rent_vault: number
          usc_rent_vault: number
          user_id: string
          vault_cap: number
        }
        Insert: {
          created_at?: string
          id?: string
          ntt_hourly_rate?: number
          ntt_net_pct?: number
          rent_monthly?: number
          rent_months?: number
          robinhood_weekly?: number
          updated_at?: string
          usc_gross_baseline?: number
          usc_net_pct?: number
          usc_no_rent_vault?: number
          usc_rent_vault?: number
          user_id: string
          vault_cap?: number
        }
        Update: {
          created_at?: string
          id?: string
          ntt_hourly_rate?: number
          ntt_net_pct?: number
          rent_monthly?: number
          rent_months?: number
          robinhood_weekly?: number
          updated_at?: string
          usc_gross_baseline?: number
          usc_net_pct?: number
          usc_no_rent_vault?: number
          usc_rent_vault?: number
          user_id?: string
          vault_cap?: number
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
