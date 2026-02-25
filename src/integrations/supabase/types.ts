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
      asaas_config: {
        Row: {
          api_key_production: string | null
          api_key_sandbox: string | null
          created_at: string
          enabled_events: string[] | null
          environment: string
          id: string
          notification_email: string | null
          updated_at: string
          user_id: string
          webhook_auth_token: string | null
          webhook_email: string | null
          webhook_id: string | null
          webhook_send_type: string | null
          webhook_status: string
          webhook_url: string | null
        }
        Insert: {
          api_key_production?: string | null
          api_key_sandbox?: string | null
          created_at?: string
          enabled_events?: string[] | null
          environment?: string
          id?: string
          notification_email?: string | null
          updated_at?: string
          user_id: string
          webhook_auth_token?: string | null
          webhook_email?: string | null
          webhook_id?: string | null
          webhook_send_type?: string | null
          webhook_status?: string
          webhook_url?: string | null
        }
        Update: {
          api_key_production?: string | null
          api_key_sandbox?: string | null
          created_at?: string
          enabled_events?: string[] | null
          environment?: string
          id?: string
          notification_email?: string | null
          updated_at?: string
          user_id?: string
          webhook_auth_token?: string | null
          webhook_email?: string | null
          webhook_id?: string | null
          webhook_send_type?: string | null
          webhook_status?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      asaas_payments: {
        Row: {
          asaas_id: string
          bank_slip_url: string | null
          billing_type: string | null
          chargeback: Json | null
          confirmed_date: string | null
          created_at: string
          credit_card: Json | null
          credit_date: string | null
          customer_id: string | null
          description: string | null
          discount: Json | null
          due_date: string | null
          external_reference: string | null
          fine: Json | null
          id: string
          installment_id: string | null
          interest: Json | null
          invoice_url: string | null
          net_value: number | null
          payment_date: string | null
          payment_link: string | null
          pix_transaction: Json | null
          raw_payload: Json | null
          refunds: Json | null
          split: Json | null
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string
          value: number | null
        }
        Insert: {
          asaas_id: string
          bank_slip_url?: string | null
          billing_type?: string | null
          chargeback?: Json | null
          confirmed_date?: string | null
          created_at?: string
          credit_card?: Json | null
          credit_date?: string | null
          customer_id?: string | null
          description?: string | null
          discount?: Json | null
          due_date?: string | null
          external_reference?: string | null
          fine?: Json | null
          id?: string
          installment_id?: string | null
          interest?: Json | null
          invoice_url?: string | null
          net_value?: number | null
          payment_date?: string | null
          payment_link?: string | null
          pix_transaction?: Json | null
          raw_payload?: Json | null
          refunds?: Json | null
          split?: Json | null
          status: string
          subscription_id?: string | null
          updated_at?: string
          user_id: string
          value?: number | null
        }
        Update: {
          asaas_id?: string
          bank_slip_url?: string | null
          billing_type?: string | null
          chargeback?: Json | null
          confirmed_date?: string | null
          created_at?: string
          credit_card?: Json | null
          credit_date?: string | null
          customer_id?: string | null
          description?: string | null
          discount?: Json | null
          due_date?: string | null
          external_reference?: string | null
          fine?: Json | null
          id?: string
          installment_id?: string | null
          interest?: Json | null
          invoice_url?: string | null
          net_value?: number | null
          payment_date?: string | null
          payment_link?: string | null
          pix_transaction?: Json | null
          raw_payload?: Json | null
          refunds?: Json | null
          split?: Json | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
          value?: number | null
        }
        Relationships: []
      }
      asaas_webhook_events: {
        Row: {
          attempts: number
          created_at: string
          entity_id: string | null
          entity_type: string | null
          error: string | null
          event_category: string
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          event_category: string
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          event_category?: string
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
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
      personal_accounts: {
        Row: {
          bank_name: string | null
          color: string | null
          created_at: string
          current_balance: number
          icon: string | null
          id: string
          initial_balance: number
          is_active: boolean
          name: string
          owner: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_name?: string | null
          color?: string | null
          created_at?: string
          current_balance?: number
          icon?: string | null
          id?: string
          initial_balance?: number
          is_active?: boolean
          name: string
          owner?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_name?: string | null
          color?: string | null
          created_at?: string
          current_balance?: number
          icon?: string | null
          id?: string
          initial_balance?: number
          is_active?: boolean
          name?: string
          owner?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_ai_conversations: {
        Row: {
          created_at: string
          financial_context: string | null
          id: string
          messages: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          financial_context?: string | null
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          financial_context?: string | null
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_alerts: {
        Row: {
          action_url: string | null
          alert_type: string
          created_at: string
          id: string
          impact_value: number | null
          is_dismissed: boolean
          is_read: boolean
          message: string
          reference_month: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          alert_type: string
          created_at?: string
          id?: string
          impact_value?: number | null
          is_dismissed?: boolean
          is_read?: boolean
          message: string
          reference_month?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          alert_type?: string
          created_at?: string
          id?: string
          impact_value?: number | null
          is_dismissed?: boolean
          is_read?: boolean
          message?: string
          reference_month?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_budgets: {
        Row: {
          alert_threshold: number
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          monthly_limit: number
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_threshold?: number
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_limit: number
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_threshold?: number
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_limit?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "personal_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_categories: {
        Row: {
          color: string | null
          created_at: string
          default_kakeibo_group: string | null
          icon: string | null
          id: string
          name: string
          type: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          default_kakeibo_group?: string | null
          icon?: string | null
          id?: string
          name: string
          type: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          default_kakeibo_group?: string | null
          icon?: string | null
          id?: string
          name?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      personal_category_rules: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_system: boolean
          kakeibo_group: string | null
          keyword: string
          subcategory_id: string | null
          user_id: string | null
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_system?: boolean
          kakeibo_group?: string | null
          keyword: string
          subcategory_id?: string | null
          user_id?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_system?: boolean
          kakeibo_group?: string | null
          keyword?: string
          subcategory_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personal_category_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "personal_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_category_rules_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "personal_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_control_charts: {
        Row: {
          category_ids: string[]
          created_at: string
          id: string
          is_visible: boolean
          monthly_limit: number
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          category_ids: string[]
          created_at?: string
          id?: string
          is_visible?: boolean
          monthly_limit?: number
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          category_ids?: string[]
          created_at?: string
          id?: string
          is_visible?: boolean
          monthly_limit?: number
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      personal_credit_cards: {
        Row: {
          brand: string | null
          closing_day: number
          color: string | null
          created_at: string
          credit_limit: number
          due_day: number
          icon: string | null
          id: string
          is_active: boolean
          name: string
          owner: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          closing_day: number
          color?: string | null
          created_at?: string
          credit_limit?: number
          due_day: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          owner?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string | null
          closing_day?: number
          color?: string | null
          created_at?: string
          credit_limit?: number
          due_day?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          owner?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_goals: {
        Row: {
          color: string | null
          created_at: string
          current_amount: number
          deadline: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          is_emergency_fund: boolean
          name: string
          owner: string
          priority: string
          target_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          current_amount?: number
          deadline: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_emergency_fund?: boolean
          name: string
          owner?: string
          priority?: string
          target_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          current_amount?: number
          deadline?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_emergency_fund?: boolean
          name?: string
          owner?: string
          priority?: string
          target_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_import_sessions: {
        Row: {
          bank_detected: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          file_content: string | null
          file_name: string
          id: string
          imported_rows: number | null
          parsed_data: Json | null
          status: string
          total_rows: number | null
          user_id: string
        }
        Insert: {
          bank_detected?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_content?: string | null
          file_name: string
          id?: string
          imported_rows?: number | null
          parsed_data?: Json | null
          status?: string
          total_rows?: number | null
          user_id: string
        }
        Update: {
          bank_detected?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_content?: string | null
          file_name?: string
          id?: string
          imported_rows?: number | null
          parsed_data?: Json | null
          status?: string
          total_rows?: number | null
          user_id?: string
        }
        Relationships: []
      }
      personal_reconciliation: {
        Row: {
          created_at: string
          id: string
          imported_at: string | null
          notes: string | null
          reconciled_at: string | null
          reference_month: string
          source_id: string
          source_type: string
          status: string
          total_expense: number | null
          total_income: number | null
          transaction_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          imported_at?: string | null
          notes?: string | null
          reconciled_at?: string | null
          reference_month: string
          source_id: string
          source_type: string
          status?: string
          total_expense?: number | null
          total_income?: number | null
          transaction_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          imported_at?: string | null
          notes?: string | null
          reconciled_at?: string | null
          reference_month?: string
          source_id?: string
          source_type?: string
          status?: string
          total_expense?: number | null
          total_income?: number | null
          transaction_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_subcategories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "personal_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_transactions: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string
          credit_card_id: string | null
          date: string
          description: string | null
          id: string
          impact: string | null
          import_session_id: string | null
          is_essential: boolean | null
          is_planned: boolean | null
          is_recurring: boolean
          kakeibo_group: string | null
          kakeibo_note: string | null
          nature: string | null
          original_import_data: Json | null
          person: string | null
          status: string
          subcategory_id: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          created_at?: string
          credit_card_id?: string | null
          date: string
          description?: string | null
          id?: string
          impact?: string | null
          import_session_id?: string | null
          is_essential?: boolean | null
          is_planned?: boolean | null
          is_recurring?: boolean
          kakeibo_group?: string | null
          kakeibo_note?: string | null
          nature?: string | null
          original_import_data?: Json | null
          person?: string | null
          status?: string
          subcategory_id?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          created_at?: string
          credit_card_id?: string | null
          date?: string
          description?: string | null
          id?: string
          impact?: string | null
          import_session_id?: string | null
          is_essential?: boolean | null
          is_planned?: boolean | null
          is_recurring?: boolean
          kakeibo_group?: string | null
          kakeibo_note?: string | null
          nature?: string | null
          original_import_data?: Json | null
          person?: string | null
          status?: string
          subcategory_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "personal_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "personal_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_transactions_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "personal_credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_transactions_import_session_fkey"
            columns: ["import_session_id"]
            isOneToOne: false
            referencedRelation: "personal_import_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_transactions_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "personal_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_transfers: {
        Row: {
          amount: number
          created_at: string
          date: string
          description: string | null
          from_account_id: string
          id: string
          status: string
          to_account_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          date: string
          description?: string | null
          from_account_id: string
          id?: string
          status?: string
          to_account_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          description?: string | null
          from_account_id?: string
          id?: string
          status?: string
          to_account_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "personal_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "personal_accounts"
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
      user_preferences: {
        Row: {
          created_at: string
          id: string
          preferred_mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          preferred_mode?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          preferred_mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
