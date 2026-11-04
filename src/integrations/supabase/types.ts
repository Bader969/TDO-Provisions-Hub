export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      raw_messages: {
        Row: {
          ai_response: Json | null
          body: string | null
          chat_id: string | null
          from_name: string | null
          from_number: string | null
          id: string
          media_url: string | null
          message_type: string | null
          parse_error: string | null
          pdf_filename: string | null
          processed: boolean
          received_at: string
          twilio_sid: string | null
        }
        Insert: {
          ai_response?: Json | null
          body?: string | null
          chat_id?: string | null
          from_name?: string | null
          from_number?: string | null
          id?: string
          media_url?: string | null
          message_type?: string | null
          parse_error?: string | null
          pdf_filename?: string | null
          processed?: boolean
          received_at?: string
          twilio_sid?: string | null
        }
        Update: {
          ai_response?: Json | null
          body?: string | null
          chat_id?: string | null
          from_name?: string | null
          from_number?: string | null
          id?: string
          media_url?: string | null
          message_type?: string | null
          parse_error?: string | null
          pdf_filename?: string | null
          processed?: boolean
          received_at?: string
          twilio_sid?: string | null
        }
        Relationships: []
      }
      records: {
        Row: {
          created_at: string
          created_by: string | null
          customer_name: string | null
          data: Json
          id: string
          notes: string | null
          provider: Database["public"]["Enums"]["provider_type"]
          provision: number | null
          raw_message_id: string | null
          record_date: string | null
          status: Database["public"]["Enums"]["record_status"]
          tariff: string | null
          tippgeber: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          data?: Json
          id?: string
          notes?: string | null
          provider: Database["public"]["Enums"]["provider_type"]
          provision?: number | null
          raw_message_id?: string | null
          record_date?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          tariff?: string | null
          tippgeber?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          data?: Json
          id?: string
          notes?: string | null
          provider?: Database["public"]["Enums"]["provider_type"]
          provision?: number | null
          raw_message_id?: string | null
          record_date?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          tariff?: string | null
          tippgeber?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "records_raw_message_id_fkey"
            columns: ["raw_message_id"]
            isOneToOne: false
            referencedRelation: "raw_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vb_settlement_settings: {
        Row: {
          id: string
          vb_name: string
          vor_monat_amount: number | null
          vor_monat_label: string | null
          vorschuss_amount: number | null
          vorschuss_label: string | null
          ohne_mwst_1: number | null
          mit_mwst_1: number | null
          ohne_mwst_2: number | null
          mit_mwst_2: number | null
          extra_col_2: number | null
          updated_at: string
        }
        Insert: {
          id?: string
          vb_name: string
          vor_monat_amount?: number | null
          vor_monat_label?: string | null
          vorschuss_amount?: number | null
          vorschuss_label?: string | null
          ohne_mwst_1?: number | null
          mit_mwst_1?: number | null
          ohne_mwst_2?: number | null
          mit_mwst_2?: number | null
          extra_col_2?: number | null
          updated_at?: string
        }
        Update: {
          id?: string
          vb_name?: string
          vor_monat_amount?: number | null
          vor_monat_label?: string | null
          vorschuss_amount?: number | null
          vorschuss_label?: string | null
          ohne_mwst_1?: number | null
          mit_mwst_1?: number | null
          ohne_mwst_2?: number | null
          mit_mwst_2?: number | null
          extra_col_2?: number | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "member"
      provider_type:
        | "Strom"
        | "VF"
        | "1u1"
        | "O2"
        | "Ayyildiz"
        | "Check"
        | "Yourfone"
        | "DAK"
        | "BKK"
        | "Bigdirekt"
        | "Viactiv"
        | "UNKNOWN"
      record_status: "open" | "booked" | "cancelled" | "review"
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

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "member"],
      provider_type: [
        "Strom",
        "VF",
        "1u1",
        "O2",
        "Ayyildiz",
        "Check",
        "Yourfone",
        "DAK",
        "BKK",
        "Bigdirekt",
        "Viactiv",
        "UNKNOWN",
      ],
      record_status: ["open", "booked", "cancelled", "review"],
    },
  },
} as const
