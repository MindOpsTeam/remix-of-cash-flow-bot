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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bank_accounts: {
        Row: {
          bank_name: string | null
          company_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          bank_name?: string | null
          company_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          bank_name?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          code: string | null
          company_id: string
          created_at: string
          editable: boolean
          id: string
          name: string
          parent_id: string | null
          type: string
        }
        Insert: {
          code?: string | null
          company_id: string
          created_at?: string
          editable?: boolean
          id?: string
          name: string
          parent_id?: string | null
          type?: string
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string
          editable?: boolean
          id?: string
          name?: string
          parent_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          cnpj: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          active: boolean
          category: string
          company_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          category?: string
          company_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          category?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          attachment_url: string | null
          bank_account_id: string | null
          company_id: string
          cost_center_id: string | null
          created_at: string
          date: string
          description: string
          id: string
          payment_method: string | null
          project: string | null
          source: string
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          attachment_url?: string | null
          bank_account_id?: string | null
          company_id: string
          cost_center_id?: string | null
          created_at?: string
          date: string
          description: string
          id?: string
          payment_method?: string | null
          project?: string | null
          source?: string
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          attachment_url?: string | null
          bank_account_id?: string | null
          company_id?: string
          cost_center_id?: string | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          payment_method?: string | null
          project?: string | null
          source?: string
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          company_id: string
          created_at: string
          direction: string
          error_message: string | null
          id: string
          payload: Json
          response_status: number | null
          status: string
          transaction_id: string | null
          webhook_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          direction: string
          error_message?: string | null
          id?: string
          payload?: Json
          response_status?: number | null
          status?: string
          transaction_id?: string | null
          webhook_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          direction?: string
          error_message?: string | null
          id?: string
          payload?: Json
          response_status?: number | null
          status?: string
          transaction_id?: string | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          active: boolean
          auto_create_transaction: boolean
          company_id: string
          created_at: string
          default_account_id: string | null
          default_cost_center_id: string | null
          default_type: string | null
          direction: string
          id: string
          name: string
          secret_token: string
          updated_at: string
          url: string | null
        }
        Insert: {
          active?: boolean
          auto_create_transaction?: boolean
          company_id: string
          created_at?: string
          default_account_id?: string | null
          default_cost_center_id?: string | null
          default_type?: string | null
          direction?: string
          id?: string
          name: string
          secret_token?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          active?: boolean
          auto_create_transaction?: boolean
          company_id?: string
          created_at?: string
          default_account_id?: string | null
          default_cost_center_id?: string | null
          default_type?: string | null
          direction?: string
          id?: string
          name?: string
          secret_token?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhooks_default_account_id_fkey"
            columns: ["default_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhooks_default_cost_center_id_fkey"
            columns: ["default_cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_configs: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          id: string
          instance_name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          instance_name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          instance_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          classification: Json | null
          company_id: string
          config_id: string
          created_at: string
          direction: string
          id: string
          message_text: string | null
          message_type: string
          phone_number: string
          processed: boolean
        }
        Insert: {
          classification?: Json | null
          company_id: string
          config_id: string
          created_at?: string
          direction?: string
          id?: string
          message_text?: string | null
          message_type?: string
          phone_number: string
          processed?: boolean
        }
        Update: {
          classification?: Json | null
          company_id?: string
          config_id?: string
          created_at?: string
          direction?: string
          id?: string
          message_text?: string | null
          message_type?: string
          phone_number?: string
          processed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_configs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_company_for_user: { Args: { company_name: string }; Returns: Json }
      is_company_member: { Args: { _company_id: string }; Returns: boolean }
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
