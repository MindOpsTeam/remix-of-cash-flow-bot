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
      agent_actions: {
        Row: {
          action_type: string
          agent: string
          amount: number | null
          company_id: string
          contact_name: string | null
          contact_whatsapp: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          dedupe_key: string | null
          description: string | null
          due_date: string | null
          executed_at: string | null
          id: string
          payload: Json | null
          result: Json | null
          status: string
          suggested_message: string | null
          title: string
        }
        Insert: {
          action_type: string
          agent: string
          amount?: number | null
          company_id: string
          contact_name?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          dedupe_key?: string | null
          description?: string | null
          due_date?: string | null
          executed_at?: string | null
          id?: string
          payload?: Json | null
          result?: Json | null
          status?: string
          suggested_message?: string | null
          title: string
        }
        Update: {
          action_type?: string
          agent?: string
          amount?: number | null
          company_id?: string
          contact_name?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          dedupe_key?: string | null
          description?: string | null
          due_date?: string | null
          executed_at?: string | null
          id?: string
          payload?: Json | null
          result?: Json | null
          status?: string
          suggested_message?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_actions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_actions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "agent_actions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      agent_instances: {
        Row: {
          ativo: boolean
          canais: Json
          company_id: string
          config: Json
          created_at: string
          id: string
          last_result: Json | null
          last_run_at: string | null
          nome: string
          template_key: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          canais?: Json
          company_id: string
          config?: Json
          created_at?: string
          id?: string
          last_result?: Json | null
          last_run_at?: string | null
          nome: string
          template_key: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          canais?: Json
          company_id?: string
          config?: Json
          created_at?: string
          id?: string
          last_result?: Json | null
          last_run_at?: string | null
          nome?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_instances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "agent_instances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      agent_rules: {
        Row: {
          agent: string
          ativo: boolean
          company_id: string
          config: Json
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          agent: string
          ativo?: boolean
          company_id: string
          config?: Json
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          agent?: string
          ativo?: boolean
          company_id?: string
          config?: Json
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "agent_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      ai_classification_feedback: {
        Row: {
          aceito: boolean
          company_id: string
          created_at: string
          descricao: string | null
          final_account_id: string | null
          id: string
          origem: string
          sugerido_account_id: string | null
          transaction_id: string | null
        }
        Insert: {
          aceito: boolean
          company_id: string
          created_at?: string
          descricao?: string | null
          final_account_id?: string | null
          id?: string
          origem?: string
          sugerido_account_id?: string | null
          transaction_id?: string | null
        }
        Update: {
          aceito?: boolean
          company_id?: string
          created_at?: string
          descricao?: string | null
          final_account_id?: string | null
          id?: string
          origem?: string
          sugerido_account_id?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_classification_feedback_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_classification_feedback_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "ai_classification_feedback_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "ai_classification_feedback_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          company_id: string | null
          completion_tokens: number | null
          created_at: string
          custo_centavos: number | null
          funcao: string
          id: string
          modelo: string | null
          prompt_tokens: number | null
          sucesso: boolean
        }
        Insert: {
          company_id?: string | null
          completion_tokens?: number | null
          created_at?: string
          custo_centavos?: number | null
          funcao: string
          id?: string
          modelo?: string | null
          prompt_tokens?: number | null
          sucesso?: boolean
        }
        Update: {
          company_id?: string | null
          completion_tokens?: number | null
          created_at?: string
          custo_centavos?: number | null
          funcao?: string
          id?: string
          modelo?: string | null
          prompt_tokens?: number | null
          sucesso?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "ai_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      api_keys: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          prefix: string
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          prefix: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          prefix?: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "api_keys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_type: string | null
          balance: number | null
          bank_name: string | null
          company_id: string
          connection_id: string | null
          created_at: string
          external_id: string | null
          id: string
          last_synced_at: string | null
          name: string
        }
        Insert: {
          account_type?: string | null
          balance?: number | null
          bank_name?: string | null
          company_id: string
          connection_id?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          name: string
        }
        Update: {
          account_type?: string | null
          balance?: number | null
          bank_name?: string | null
          company_id?: string
          connection_id?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
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
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bank_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_connections: {
        Row: {
          company_id: string
          consent_expires_at: string | null
          created_at: string
          external_id: string
          history_calls_month: number
          history_calls_reset_at: string
          id: string
          institution_image: string | null
          institution_name: string | null
          last_synced_at: string | null
          provider: string
          status: string
          status_detail: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          consent_expires_at?: string | null
          created_at?: string
          external_id: string
          history_calls_month?: number
          history_calls_reset_at?: string
          id?: string
          institution_image?: string | null
          institution_name?: string | null
          last_synced_at?: string | null
          provider?: string
          status?: string
          status_detail?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          consent_expires_at?: string | null
          created_at?: string
          external_id?: string
          history_calls_month?: number
          history_calls_reset_at?: string
          id?: string
          institution_image?: string | null
          institution_name?: string | null
          last_synced_at?: string | null
          provider?: string
          status?: string
          status_detail?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bank_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      bank_transactions_raw: {
        Row: {
          account_external_id: string | null
          amount: number
          category: string | null
          company_id: string
          connection_id: string | null
          created_at: string
          date: string
          description: string | null
          direction: string
          external_id: string
          id: string
          payment_method: string | null
          provider: string
          raw: Json | null
          status: string
          transaction_id: string | null
        }
        Insert: {
          account_external_id?: string | null
          amount: number
          category?: string | null
          company_id: string
          connection_id?: string | null
          created_at?: string
          date: string
          description?: string | null
          direction: string
          external_id: string
          id?: string
          payment_method?: string | null
          provider: string
          raw?: Json | null
          status?: string
          transaction_id?: string | null
        }
        Update: {
          account_external_id?: string | null
          amount?: number
          category?: string | null
          company_id?: string
          connection_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          direction?: string
          external_id?: string
          id?: string
          payment_method?: string | null
          provider?: string
          raw?: Json | null
          status?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_raw_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_raw_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bank_transactions_raw_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bank_transactions_raw_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_raw_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      bills_payable: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          company_id: string
          contact_id: string | null
          created_at: string
          descricao: string | null
          external_id: string | null
          fornecedor: string
          id: string
          is_recurring: boolean
          purchase_order_id: string | null
          recurrence_group_id: string | null
          recurrence_index: number | null
          recurrence_total: number | null
          requested_by: string | null
          source: string
          status: string
          updated_at: string
          valor: number
          vencimento: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          contact_id?: string | null
          created_at?: string
          descricao?: string | null
          external_id?: string | null
          fornecedor: string
          id?: string
          is_recurring?: boolean
          purchase_order_id?: string | null
          recurrence_group_id?: string | null
          recurrence_index?: number | null
          recurrence_total?: number | null
          requested_by?: string | null
          source?: string
          status?: string
          updated_at?: string
          valor?: number
          vencimento: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          contact_id?: string | null
          created_at?: string
          descricao?: string | null
          external_id?: string | null
          fornecedor?: string
          id?: string
          is_recurring?: boolean
          purchase_order_id?: string | null
          recurrence_group_id?: string | null
          recurrence_index?: number | null
          recurrence_total?: number | null
          requested_by?: string | null
          source?: string
          status?: string
          updated_at?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_payable_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_payable_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bills_payable_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bills_payable_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_payable_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_cliente_360"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "bills_payable_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_recompra_clientes"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "bills_payable_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          company_id: string
          created_at: string
          custos: number
          despesas: number
          id: string
          month: string
          notes: string | null
          receita: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          custos?: number
          despesas?: number
          id?: string
          month: string
          notes?: string | null
          receita?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          custos?: number
          despesas?: number
          id?: string
          month?: string
          notes?: string | null
          receita?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "budgets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      cclasstrib_codigos: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          cst_permitidos: string[]
          descricao: string
          fonte: string
          versao: string | null
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          cst_permitidos?: string[]
          descricao: string
          fonte?: string
          versao?: string | null
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          cst_permitidos?: string[]
          descricao?: string
          fonte?: string
          versao?: string | null
        }
        Relationships: []
      }
      chart_of_accounts: {
        Row: {
          code: string | null
          company_id: string
          created_at: string
          deducao: boolean
          editable: boolean
          group_code: string | null
          group_name: string | null
          id: string
          name: string
          parent_id: string | null
          type: string
        }
        Insert: {
          code?: string | null
          company_id: string
          created_at?: string
          deducao?: boolean
          editable?: boolean
          group_code?: string | null
          group_name?: string | null
          id?: string
          name: string
          parent_id?: string | null
          type?: string
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string
          deducao?: boolean
          editable?: boolean
          group_code?: string | null
          group_name?: string | null
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
            foreignKeyName: "chart_of_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "chart_of_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
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
      classification_rules: {
        Row: {
          account_id: string | null
          acertos: number
          company_id: string
          cost_center_id: string | null
          created_at: string
          id: string
          origem: string
          padrao: string
        }
        Insert: {
          account_id?: string | null
          acertos?: number
          company_id: string
          cost_center_id?: string | null
          created_at?: string
          id?: string
          origem?: string
          padrao: string
        }
        Update: {
          account_id?: string | null
          acertos?: number
          company_id?: string
          cost_center_id?: string | null
          created_at?: string
          id?: string
          origem?: string
          padrao?: string
        }
        Relationships: [
          {
            foreignKeyName: "classification_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "classification_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "classification_rules_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          cclasstrib_padrao: string | null
          cnpj: string | null
          created_at: string
          id: string
          name: string
          org_id: string
          plan_key: string
          regime_apuracao: string
          regime_tributario: string | null
          updated_at: string
        }
        Insert: {
          cclasstrib_padrao?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          name: string
          org_id?: string
          plan_key?: string
          regime_apuracao?: string
          regime_tributario?: string | null
          updated_at?: string
        }
        Update: {
          cclasstrib_padrao?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          plan_key?: string
          regime_apuracao?: string
          regime_tributario?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["key"]
          },
        ]
      }
      company_asaas_anticipations: {
        Row: {
          anticipated_value: number | null
          anticipation_date: string | null
          asaas_id: string
          company_id: string
          created_at: string
          credit_date: string | null
          debit_date: string | null
          denial_reason: string | null
          due_date: string | null
          fee: number | null
          id: string
          installment_count: number | null
          net_value: number | null
          payment_id: string | null
          raw_payload: Json | null
          status: string
          total_value: number | null
          updated_at: string
        }
        Insert: {
          anticipated_value?: number | null
          anticipation_date?: string | null
          asaas_id: string
          company_id: string
          created_at?: string
          credit_date?: string | null
          debit_date?: string | null
          denial_reason?: string | null
          due_date?: string | null
          fee?: number | null
          id?: string
          installment_count?: number | null
          net_value?: number | null
          payment_id?: string | null
          raw_payload?: Json | null
          status: string
          total_value?: number | null
          updated_at?: string
        }
        Update: {
          anticipated_value?: number | null
          anticipation_date?: string | null
          asaas_id?: string
          company_id?: string
          created_at?: string
          credit_date?: string | null
          debit_date?: string | null
          denial_reason?: string | null
          due_date?: string | null
          fee?: number | null
          id?: string
          installment_count?: number | null
          net_value?: number | null
          payment_id?: string | null
          raw_payload?: Json | null
          status?: string
          total_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_asaas_anticipations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_asaas_anticipations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_asaas_anticipations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      company_asaas_bills: {
        Row: {
          asaas_id: string
          can_be_cancelled: boolean | null
          company_id: string
          company_name: string | null
          created_at: string
          description: string | null
          due_date: string | null
          failure_reason: string | null
          fee: number | null
          id: string
          identification_field: string | null
          payment_date: string | null
          raw_payload: Json | null
          schedule_date: string | null
          status: string
          type: string | null
          updated_at: string
          value: number | null
        }
        Insert: {
          asaas_id: string
          can_be_cancelled?: boolean | null
          company_id: string
          company_name?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          failure_reason?: string | null
          fee?: number | null
          id?: string
          identification_field?: string | null
          payment_date?: string | null
          raw_payload?: Json | null
          schedule_date?: string | null
          status: string
          type?: string | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          asaas_id?: string
          can_be_cancelled?: boolean | null
          company_id?: string
          company_name?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          failure_reason?: string | null
          fee?: number | null
          id?: string
          identification_field?: string | null
          payment_date?: string | null
          raw_payload?: Json | null
          schedule_date?: string | null
          status?: string
          type?: string | null
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_asaas_bills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_asaas_bills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_asaas_bills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      company_asaas_config: {
        Row: {
          api_key_production: string | null
          api_key_sandbox: string | null
          company_id: string
          created_at: string
          enabled_events: string[] | null
          environment: string
          id: string
          notification_email: string | null
          updated_at: string
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
          company_id: string
          created_at?: string
          enabled_events?: string[] | null
          environment?: string
          id?: string
          notification_email?: string | null
          updated_at?: string
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
          company_id?: string
          created_at?: string
          enabled_events?: string[] | null
          environment?: string
          id?: string
          notification_email?: string | null
          updated_at?: string
          webhook_auth_token?: string | null
          webhook_email?: string | null
          webhook_id?: string | null
          webhook_send_type?: string | null
          webhook_status?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_asaas_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_asaas_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_asaas_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      company_asaas_invoices: {
        Row: {
          asaas_id: string
          company_id: string
          created_at: string
          customer_id: string | null
          effective_date: string | null
          error_message: string | null
          external_reference: string | null
          id: string
          municipality_inscription: string | null
          net_value: number | null
          number: string | null
          observations: string | null
          payment_id: string | null
          pdf_url: string | null
          raw_payload: Json | null
          rps_number: string | null
          rps_series: string | null
          service_description: string | null
          status: string
          taxes: Json | null
          updated_at: string
          value: number | null
          xml_url: string | null
        }
        Insert: {
          asaas_id: string
          company_id: string
          created_at?: string
          customer_id?: string | null
          effective_date?: string | null
          error_message?: string | null
          external_reference?: string | null
          id?: string
          municipality_inscription?: string | null
          net_value?: number | null
          number?: string | null
          observations?: string | null
          payment_id?: string | null
          pdf_url?: string | null
          raw_payload?: Json | null
          rps_number?: string | null
          rps_series?: string | null
          service_description?: string | null
          status: string
          taxes?: Json | null
          updated_at?: string
          value?: number | null
          xml_url?: string | null
        }
        Update: {
          asaas_id?: string
          company_id?: string
          created_at?: string
          customer_id?: string | null
          effective_date?: string | null
          error_message?: string | null
          external_reference?: string | null
          id?: string
          municipality_inscription?: string | null
          net_value?: number | null
          number?: string | null
          observations?: string | null
          payment_id?: string | null
          pdf_url?: string | null
          raw_payload?: Json | null
          rps_number?: string | null
          rps_series?: string | null
          service_description?: string | null
          status?: string
          taxes?: Json | null
          updated_at?: string
          value?: number | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_asaas_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_asaas_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_asaas_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      company_asaas_payments: {
        Row: {
          asaas_id: string
          bank_slip_url: string | null
          billing_type: string | null
          chargeback: Json | null
          company_id: string
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
          value: number | null
        }
        Insert: {
          asaas_id: string
          bank_slip_url?: string | null
          billing_type?: string | null
          chargeback?: Json | null
          company_id: string
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
          value?: number | null
        }
        Update: {
          asaas_id?: string
          bank_slip_url?: string | null
          billing_type?: string | null
          chargeback?: Json | null
          company_id?: string
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
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_asaas_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_asaas_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_asaas_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      company_asaas_subscriptions: {
        Row: {
          asaas_id: string
          billing_type: string | null
          company_id: string
          created_at: string
          customer_id: string | null
          cycle: string | null
          description: string | null
          discount: Json | null
          end_date: string | null
          external_reference: string | null
          fine: Json | null
          id: string
          interest: Json | null
          max_payments: number | null
          next_due_date: string | null
          payment_count: number | null
          raw_payload: Json | null
          split: Json | null
          status: string
          updated_at: string
          value: number | null
        }
        Insert: {
          asaas_id: string
          billing_type?: string | null
          company_id: string
          created_at?: string
          customer_id?: string | null
          cycle?: string | null
          description?: string | null
          discount?: Json | null
          end_date?: string | null
          external_reference?: string | null
          fine?: Json | null
          id?: string
          interest?: Json | null
          max_payments?: number | null
          next_due_date?: string | null
          payment_count?: number | null
          raw_payload?: Json | null
          split?: Json | null
          status: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          asaas_id?: string
          billing_type?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string | null
          cycle?: string | null
          description?: string | null
          discount?: Json | null
          end_date?: string | null
          external_reference?: string | null
          fine?: Json | null
          id?: string
          interest?: Json | null
          max_payments?: number | null
          next_due_date?: string | null
          payment_count?: number | null
          raw_payload?: Json | null
          split?: Json | null
          status?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_asaas_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_asaas_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_asaas_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      company_asaas_transfers: {
        Row: {
          asaas_id: string
          authorized: boolean | null
          bank_account: Json | null
          company_id: string
          created_at: string
          description: string | null
          external_reference: string | null
          fee: number | null
          id: string
          net_value: number | null
          operation_type: string | null
          raw_payload: Json | null
          scheduled_date: string | null
          status: string
          transaction_receipt_url: string | null
          transfer_fee: number | null
          type: string | null
          updated_at: string
          value: number | null
        }
        Insert: {
          asaas_id: string
          authorized?: boolean | null
          bank_account?: Json | null
          company_id: string
          created_at?: string
          description?: string | null
          external_reference?: string | null
          fee?: number | null
          id?: string
          net_value?: number | null
          operation_type?: string | null
          raw_payload?: Json | null
          scheduled_date?: string | null
          status: string
          transaction_receipt_url?: string | null
          transfer_fee?: number | null
          type?: string | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          asaas_id?: string
          authorized?: boolean | null
          bank_account?: Json | null
          company_id?: string
          created_at?: string
          description?: string | null
          external_reference?: string | null
          fee?: number | null
          id?: string
          net_value?: number | null
          operation_type?: string | null
          raw_payload?: Json | null
          scheduled_date?: string | null
          status?: string
          transaction_receipt_url?: string | null
          transfer_fee?: number | null
          type?: string | null
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_asaas_transfers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_asaas_transfers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_asaas_transfers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      company_asaas_webhook_events: {
        Row: {
          attempts: number
          company_id: string
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
        }
        Insert: {
          attempts?: number
          company_id: string
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
        }
        Update: {
          attempts?: number
          company_id?: string
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
        }
        Relationships: [
          {
            foreignKeyName: "company_asaas_webhook_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_asaas_webhook_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_asaas_webhook_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      company_invites: {
        Row: {
          company_id: string
          created_at: string
          criado_por: string
          expira_em: string
          id: string
          role: string
          token: string
          usado_em: string | null
          usado_por: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          criado_por: string
          expira_em?: string
          id?: string
          role?: string
          token?: string
          usado_em?: string | null
          usado_por?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          criado_por?: string
          expira_em?: string
          id?: string
          role?: string
          token?: string
          usado_em?: string | null
          usado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      company_journal_entries: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          credit_account: string
          date: string
          debit_account: string
          description: string | null
          id: string
          transaction_id: string | null
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          credit_account: string
          date: string
          debit_account: string
          description?: string | null
          id?: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          credit_account?: string
          date?: string
          debit_account?: string
          description?: string | null
          id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_journal_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_journal_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_journal_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_journal_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          approval_limit: number | null
          company_id: string
          created_at: string
          id: string
          onboarding_completed: boolean
          role: string
          user_id: string
        }
        Insert: {
          approval_limit?: number | null
          company_id: string
          created_at?: string
          id?: string
          onboarding_completed?: boolean
          role?: string
          user_id: string
        }
        Update: {
          approval_limit?: number | null
          company_id?: string
          created_at?: string
          id?: string
          onboarding_completed?: boolean
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
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      contaazul_config: {
        Row: {
          ativo: boolean
          client_id_preview: string | null
          company_id: string
          created_at: string
          id: string
          last_import_at: string | null
          last_import_result: Json | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          client_id_preview?: string | null
          company_id: string
          created_at?: string
          id?: string
          last_import_at?: string | null
          last_import_result?: Json | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          client_id_preview?: string | null
          company_id?: string
          created_at?: string
          id?: string
          last_import_at?: string | null
          last_import_result?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contaazul_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contaazul_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contaazul_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      contacts: {
        Row: {
          active: boolean
          city: string | null
          company_id: string
          complement: string | null
          created_at: string
          credit_limit: number | null
          default_payment_terms: number | null
          document: string | null
          email: string | null
          external_id: string | null
          id: string
          name: string
          neighborhood: string | null
          notes: string | null
          number: string | null
          person_type: string
          phone: string | null
          state: string | null
          state_registration: string | null
          street: string | null
          trade_name: string | null
          type: string
          updated_at: string
          website: string | null
          whatsapp: string | null
          zip_code: string | null
        }
        Insert: {
          active?: boolean
          city?: string | null
          company_id: string
          complement?: string | null
          created_at?: string
          credit_limit?: number | null
          default_payment_terms?: number | null
          document?: string | null
          email?: string | null
          external_id?: string | null
          id?: string
          name: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          person_type?: string
          phone?: string | null
          state?: string | null
          state_registration?: string | null
          street?: string | null
          trade_name?: string | null
          type?: string
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          zip_code?: string | null
        }
        Update: {
          active?: boolean
          city?: string | null
          company_id?: string
          complement?: string | null
          created_at?: string
          credit_limit?: number | null
          default_payment_terms?: number | null
          document?: string | null
          email?: string | null
          external_id?: string | null
          id?: string
          name?: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          person_type?: string
          phone?: string | null
          state?: string | null
          state_registration?: string | null
          street?: string | null
          trade_name?: string | null
          type?: string
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      contract_adjustments: {
        Row: {
          aplicado_por: string | null
          company_id: string
          contract_id: string
          created_at: string
          id: string
          indice: string | null
          percentual: number
          valor_anterior: number
          valor_novo: number
          vigencia: string
        }
        Insert: {
          aplicado_por?: string | null
          company_id: string
          contract_id: string
          created_at?: string
          id?: string
          indice?: string | null
          percentual: number
          valor_anterior: number
          valor_novo: number
          vigencia: string
        }
        Update: {
          aplicado_por?: string | null
          company_id?: string
          contract_id?: string
          created_at?: string
          id?: string
          indice?: string | null
          percentual?: number
          valor_anterior?: number
          valor_novo?: number
          vigencia?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_adjustments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_adjustments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contract_adjustments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contract_adjustments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_adjustments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_contratos_a_reajustar"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          account_id: string | null
          amount: number
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          billing_day: number
          company_id: string
          contact_id: string | null
          cost_center_id: string | null
          created_at: string
          cycle: string
          description: string
          end_date: string | null
          id: string
          indice_reajuste: string | null
          next_due_date: string | null
          payment_method: string
          percentual_reajuste: number | null
          proximo_reajuste: string | null
          start_date: string
          status: string
          ultimo_reajuste_em: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_day?: number
          company_id: string
          contact_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          cycle?: string
          description: string
          end_date?: string | null
          id?: string
          indice_reajuste?: string | null
          next_due_date?: string | null
          payment_method?: string
          percentual_reajuste?: number | null
          proximo_reajuste?: string | null
          start_date?: string
          status?: string
          ultimo_reajuste_em?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_day?: number
          company_id?: string
          contact_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          cycle?: string
          description?: string
          end_date?: string | null
          id?: string
          indice_reajuste?: string | null
          next_due_date?: string | null
          payment_method?: string
          percentual_reajuste?: number | null
          proximo_reajuste?: string | null
          start_date?: string
          status?: string
          ultimo_reajuste_em?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contracts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_cliente_360"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "contracts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_recompra_clientes"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "contracts_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
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
          {
            foreignKeyName: "cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      dashboard_widgets: {
        Row: {
          company_id: string
          config: Json
          created_at: string
          id: string
          posicao: number
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          config: Json
          created_at?: string
          id?: string
          posicao?: number
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          config?: Json
          created_at?: string
          id?: string
          posicao?: number
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_widgets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_widgets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "dashboard_widgets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      fiscal_files: {
        Row: {
          company_id: string
          created_at: string
          file_size: string | null
          file_url: string | null
          id: string
          nome: string
          source: string
          tipo: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          file_size?: string | null
          file_url?: string | null
          id?: string
          nome: string
          source?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          file_size?: string | null
          file_url?: string | null
          id?: string
          nome?: string
          source?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_files_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_files_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fiscal_files_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      focus_config: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          enabled_cte: boolean
          enabled_mdfe: boolean
          enabled_nfce: boolean
          enabled_nfe: boolean
          enabled_nfse: boolean
          environment: string
          id: string
          last_emission_at: string | null
          last_test_at: string | null
          last_test_status: string | null
          serie_padrao: string | null
          token_homologacao_preview: string | null
          token_producao_preview: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          enabled_cte?: boolean
          enabled_mdfe?: boolean
          enabled_nfce?: boolean
          enabled_nfe?: boolean
          enabled_nfse?: boolean
          environment?: string
          id?: string
          last_emission_at?: string | null
          last_test_at?: string | null
          last_test_status?: string | null
          serie_padrao?: string | null
          token_homologacao_preview?: string | null
          token_producao_preview?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          enabled_cte?: boolean
          enabled_mdfe?: boolean
          enabled_nfce?: boolean
          enabled_nfe?: boolean
          enabled_nfse?: boolean
          environment?: string
          id?: string
          last_emission_at?: string | null
          last_test_at?: string | null
          last_test_status?: string | null
          serie_padrao?: string | null
          token_homologacao_preview?: string | null
          token_producao_preview?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "focus_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "focus_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      indices_economicos: {
        Row: {
          atualizado_em: string
          fonte: string
          indice: string
          mes: string
          variacao_pct: number
        }
        Insert: {
          atualizado_em?: string
          fonte?: string
          indice: string
          mes: string
          variacao_pct: number
        }
        Update: {
          atualizado_em?: string
          fonte?: string
          indice?: string
          mes?: string
          variacao_pct?: number
        }
        Relationships: []
      }
      inter_config: {
        Row: {
          account_number: string | null
          active: boolean
          bank_account_id: string | null
          cert_pem: string
          client_id: string
          client_secret: string
          company_id: string
          created_at: string
          environment: string
          id: string
          key_pem: string
          last_balance: number | null
          last_balance_at: string | null
          last_sync_at: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          active?: boolean
          bank_account_id?: string | null
          cert_pem?: string
          client_id?: string
          client_secret?: string
          company_id: string
          created_at?: string
          environment?: string
          id?: string
          key_pem?: string
          last_balance?: number | null
          last_balance_at?: string | null
          last_sync_at?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          active?: boolean
          bank_account_id?: string | null
          cert_pem?: string
          client_id?: string
          client_secret?: string
          company_id?: string
          created_at?: string
          environment?: string
          id?: string
          key_pem?: string
          last_balance?: number | null
          last_balance_at?: string | null
          last_sync_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inter_config_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "inter_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      invoices: {
        Row: {
          access_key: string | null
          cbs_valor: number | null
          cclasstrib: string | null
          company_id: string
          contact_id: string | null
          created_at: string
          ibs_valor: number | null
          id: string
          issue_date: string
          notes: string | null
          number: string | null
          pdf_url: string | null
          sales_order_id: string | null
          series: string | null
          status: string
          total: number
          type: string
          updated_at: string
          xml_content: string | null
          xml_url: string | null
        }
        Insert: {
          access_key?: string | null
          cbs_valor?: number | null
          cclasstrib?: string | null
          company_id: string
          contact_id?: string | null
          created_at?: string
          ibs_valor?: number | null
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string | null
          pdf_url?: string | null
          sales_order_id?: string | null
          series?: string | null
          status?: string
          total?: number
          type?: string
          updated_at?: string
          xml_content?: string | null
          xml_url?: string | null
        }
        Update: {
          access_key?: string | null
          cbs_valor?: number | null
          cclasstrib?: string | null
          company_id?: string
          contact_id?: string | null
          created_at?: string
          ibs_valor?: number | null
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string | null
          pdf_url?: string | null
          sales_order_id?: string | null
          series?: string | null
          status?: string
          total?: number
          type?: string
          updated_at?: string
          xml_content?: string | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_cliente_360"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_recompra_clientes"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "invoices_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_metas: {
        Row: {
          alvo: number
          company_id: string
          created_at: string
          direcao: string
          id: string
          metric_key: string
          updated_at: string
        }
        Insert: {
          alvo: number
          company_id: string
          created_at?: string
          direcao?: string
          id?: string
          metric_key: string
          updated_at?: string
        }
        Update: {
          alvo?: number
          company_id?: string
          created_at?: string
          direcao?: string
          id?: string
          metric_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_metas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_metas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "kpi_metas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      monthly_close: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          company_id: string
          created_at: string
          id: string
          month: string
          snapshot: Json | null
          status: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          company_id: string
          created_at?: string
          id?: string
          month: string
          snapshot?: Json | null
          status?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string
          created_at?: string
          id?: string
          month?: string
          snapshot?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_close_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_close_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "monthly_close_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      municipalities: {
        Row: {
          code_ibge: string
          name: string
          region: string | null
          uf: string
          updated_at: string
        }
        Insert: {
          code_ibge: string
          name: string
          region?: string | null
          uf: string
          updated_at?: string
        }
        Update: {
          code_ibge?: string
          name?: string
          region?: string | null
          uf?: string
          updated_at?: string
        }
        Relationships: []
      }
      nfse_config: {
        Row: {
          active: boolean
          ambiente: string
          cert_cnpj: string | null
          cert_expires_at: string | null
          cert_password: string
          cert_pfx_base64: string
          cert_razao_social: string | null
          codigo_municipio: string | null
          company_id: string
          created_at: string
          id: string
          inscricao_municipal: string | null
          last_emission_at: string | null
          last_test_at: string | null
          last_test_status: string | null
          proximo_numero_dps: number
          serie_dps: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          ambiente?: string
          cert_cnpj?: string | null
          cert_expires_at?: string | null
          cert_password?: string
          cert_pfx_base64?: string
          cert_razao_social?: string | null
          codigo_municipio?: string | null
          company_id: string
          created_at?: string
          id?: string
          inscricao_municipal?: string | null
          last_emission_at?: string | null
          last_test_at?: string | null
          last_test_status?: string | null
          proximo_numero_dps?: number
          serie_dps?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          ambiente?: string
          cert_cnpj?: string | null
          cert_expires_at?: string | null
          cert_password?: string
          cert_pfx_base64?: string
          cert_razao_social?: string | null
          codigo_municipio?: string | null
          company_id?: string
          created_at?: string
          id?: string
          inscricao_municipal?: string | null
          last_emission_at?: string | null
          last_test_at?: string | null
          last_test_status?: string | null
          proximo_numero_dps?: number
          serie_dps?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfse_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfse_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "nfse_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      notifications: {
        Row: {
          agent_instance_id: string | null
          categoria: string
          company_id: string
          corpo: string | null
          created_at: string
          dedupe_key: string | null
          id: string
          lida: boolean
          link: string | null
          titulo: string
          user_id: string | null
        }
        Insert: {
          agent_instance_id?: string | null
          categoria?: string
          company_id: string
          corpo?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          lida?: boolean
          link?: string | null
          titulo: string
          user_id?: string | null
        }
        Update: {
          agent_instance_id?: string | null
          categoria?: string
          company_id?: string
          corpo?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          lida?: boolean
          link?: string | null
          titulo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      openfinance_config: {
        Row: {
          active: boolean
          client_id_preview: string | null
          company_id: string
          created_at: string
          id: string
          last_sync_at: string | null
          last_test_at: string | null
          last_test_status: string | null
          provider: string
          sandbox: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          client_id_preview?: string | null
          company_id: string
          created_at?: string
          id?: string
          last_sync_at?: string | null
          last_test_at?: string | null
          last_test_status?: string | null
          provider?: string
          sandbox?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          client_id_preview?: string | null
          company_id?: string
          created_at?: string
          id?: string
          last_sync_at?: string | null
          last_test_at?: string | null
          last_test_status?: string | null
          provider?: string
          sandbox?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "openfinance_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "openfinance_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "openfinance_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      owner_transactions: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          date: string
          description: string | null
          id: string
          pj_bank_account_id: string | null
          pj_transaction_id: string | null
          status: string
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          date: string
          description?: string | null
          id?: string
          pj_bank_account_id?: string | null
          pj_transaction_id?: string | null
          status?: string
          transaction_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          pj_bank_account_id?: string | null
          pj_transaction_id?: string | null
          status?: string
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "owner_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "owner_transactions_pj_bank_account_id_fkey"
            columns: ["pj_bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_transactions_pj_transaction_id_fkey"
            columns: ["pj_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          contaazul: boolean
          created_at: string
          key: string
          max_agentes: number
          max_widgets: number
          nome: string
          pdv: boolean
          preco_centavos: number
          whatsapp: boolean
        }
        Insert: {
          contaazul?: boolean
          created_at?: string
          key: string
          max_agentes?: number
          max_widgets?: number
          nome: string
          pdv?: boolean
          preco_centavos?: number
          whatsapp?: boolean
        }
        Update: {
          contaazul?: boolean
          created_at?: string
          key?: string
          max_agentes?: number
          max_widgets?: number
          nome?: string
          pdv?: boolean
          preco_centavos?: number
          whatsapp?: boolean
        }
        Relationships: []
      }
      platform_lock: {
        Row: {
          created_at: string
          id: boolean
          locked_system_identifier: string
          motivo: string | null
        }
        Insert: {
          created_at?: string
          id?: boolean
          locked_system_identifier: string
          motivo?: string | null
        }
        Update: {
          created_at?: string
          id?: boolean
          locked_system_identifier?: string
          motivo?: string | null
        }
        Relationships: []
      }
      platform_owner: {
        Row: {
          definido_em: string
          id: boolean
          user_id: string
        }
        Insert: {
          definido_em?: string
          id?: boolean
          user_id: string
        }
        Update: {
          definido_em?: string
          id?: boolean
          user_id?: string
        }
        Relationships: []
      }
      plugnotas_config: {
        Row: {
          active: boolean
          api_key: string
          company_id: string
          created_at: string
          enabled_cte: boolean
          enabled_mdfe: boolean
          enabled_nfce: boolean
          enabled_nfe: boolean
          enabled_nfse: boolean
          environment: string
          id: string
          last_emission_at: string | null
          last_test_at: string | null
          last_test_status: string | null
          plugnotas_empresa_cnpj: string | null
          plugnotas_empresa_id: string | null
          serie_padrao: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          api_key?: string
          company_id: string
          created_at?: string
          enabled_cte?: boolean
          enabled_mdfe?: boolean
          enabled_nfce?: boolean
          enabled_nfe?: boolean
          enabled_nfse?: boolean
          environment?: string
          id?: string
          last_emission_at?: string | null
          last_test_at?: string | null
          last_test_status?: string | null
          plugnotas_empresa_cnpj?: string | null
          plugnotas_empresa_id?: string | null
          serie_padrao?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          api_key?: string
          company_id?: string
          created_at?: string
          enabled_cte?: boolean
          enabled_mdfe?: boolean
          enabled_nfce?: boolean
          enabled_nfe?: boolean
          enabled_nfse?: boolean
          environment?: string
          id?: string
          last_emission_at?: string | null
          last_test_at?: string | null
          last_test_status?: string | null
          plugnotas_empresa_cnpj?: string | null
          plugnotas_empresa_id?: string | null
          serie_padrao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plugnotas_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plugnotas_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "plugnotas_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      plugnotas_documents: {
        Row: {
          cancelled_at: string | null
          cbs_aliquota: number | null
          cbs_valor: number | null
          cclasstrib: string | null
          chave_acesso: string | null
          company_id: string
          created_at: string
          doc_type: string
          emitted_at: string | null
          ibs_aliquota: number | null
          ibs_valor: number | null
          id: string
          invoice_id: string | null
          last_check_at: string | null
          numero: string | null
          payload_request: Json | null
          payload_response: Json | null
          pdf_url: string | null
          plugnotas_id: string | null
          plugnotas_protocolo: string | null
          serie: string | null
          status: string
          status_message: string | null
          updated_at: string
          xml_url: string | null
        }
        Insert: {
          cancelled_at?: string | null
          cbs_aliquota?: number | null
          cbs_valor?: number | null
          cclasstrib?: string | null
          chave_acesso?: string | null
          company_id: string
          created_at?: string
          doc_type: string
          emitted_at?: string | null
          ibs_aliquota?: number | null
          ibs_valor?: number | null
          id?: string
          invoice_id?: string | null
          last_check_at?: string | null
          numero?: string | null
          payload_request?: Json | null
          payload_response?: Json | null
          pdf_url?: string | null
          plugnotas_id?: string | null
          plugnotas_protocolo?: string | null
          serie?: string | null
          status?: string
          status_message?: string | null
          updated_at?: string
          xml_url?: string | null
        }
        Update: {
          cancelled_at?: string | null
          cbs_aliquota?: number | null
          cbs_valor?: number | null
          cclasstrib?: string | null
          chave_acesso?: string | null
          company_id?: string
          created_at?: string
          doc_type?: string
          emitted_at?: string | null
          ibs_aliquota?: number | null
          ibs_valor?: number | null
          id?: string
          invoice_id?: string | null
          last_check_at?: string | null
          numero?: string | null
          payload_request?: Json | null
          payload_response?: Json | null
          pdf_url?: string | null
          plugnotas_id?: string | null
          plugnotas_protocolo?: string | null
          serie?: string | null
          status?: string
          status_message?: string | null
          updated_at?: string
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plugnotas_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plugnotas_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "plugnotas_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "plugnotas_documents_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          account_id: string | null
          active: boolean
          average_cost: number | null
          barcode: string | null
          category: string | null
          cclasstrib: string | null
          cfop: string | null
          company_id: string
          cost_price: number | null
          created_at: string
          current_stock: number | null
          description: string | null
          external_id: string | null
          fiscal_confirmado_em: string | null
          fiscal_confirmado_por: string | null
          fiscal_origem: string | null
          id: string
          min_stock: number | null
          name: string
          ncm: string | null
          sell_price: number
          sku: string | null
          tax_origin: string | null
          track_stock: boolean
          type: string
          unit: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          average_cost?: number | null
          barcode?: string | null
          category?: string | null
          cclasstrib?: string | null
          cfop?: string | null
          company_id: string
          cost_price?: number | null
          created_at?: string
          current_stock?: number | null
          description?: string | null
          external_id?: string | null
          fiscal_confirmado_em?: string | null
          fiscal_confirmado_por?: string | null
          fiscal_origem?: string | null
          id?: string
          min_stock?: number | null
          name: string
          ncm?: string | null
          sell_price?: number
          sku?: string | null
          tax_origin?: string | null
          track_stock?: boolean
          type?: string
          unit?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          active?: boolean
          average_cost?: number | null
          barcode?: string | null
          category?: string | null
          cclasstrib?: string | null
          cfop?: string | null
          company_id?: string
          cost_price?: number | null
          created_at?: string
          current_stock?: number | null
          description?: string | null
          external_id?: string | null
          fiscal_confirmado_em?: string | null
          fiscal_confirmado_por?: string | null
          fiscal_origem?: string | null
          id?: string
          min_stock?: number | null
          name?: string
          ncm?: string | null
          sell_price?: number
          sku?: string | null
          tax_origin?: string | null
          track_stock?: boolean
          type?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          description: string
          id: string
          order_id: string
          product_id: string | null
          quantity: number
          sort_order: number | null
          total: number
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          order_id: string
          product_id?: string | null
          quantity?: number
          sort_order?: number | null
          total?: number
          unit_price?: number
        }
        Update: {
          description?: string
          id?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          sort_order?: number | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_produtos_pendencia_fiscal"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          company_id: string
          contact_id: string | null
          created_at: string
          discount_value: number | null
          expected_date: string | null
          id: string
          internal_notes: string | null
          issue_date: string
          notes: string | null
          order_number: number
          payment_terms: number | null
          shipping: number | null
          status: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          contact_id?: string | null
          created_at?: string
          discount_value?: number | null
          expected_date?: string | null
          id?: string
          internal_notes?: string | null
          issue_date?: string
          notes?: string | null
          order_number?: number
          payment_terms?: number | null
          shipping?: number | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          contact_id?: string | null
          created_at?: string
          discount_value?: number | null
          expected_date?: string | null
          id?: string
          internal_notes?: string | null
          issue_date?: string
          notes?: string | null
          order_number?: number
          payment_terms?: number | null
          shipping?: number | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "purchase_orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_cliente_360"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "purchase_orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_recompra_clientes"
            referencedColumns: ["contact_id"]
          },
        ]
      }
      receivables: {
        Row: {
          account_id: string | null
          amount: number
          asaas_payment_id: string | null
          boleto_url: string | null
          company_id: string
          contact_id: string | null
          contract_id: string | null
          cost_center_id: string | null
          created_at: string
          description: string
          due_date: string
          external_id: string | null
          id: string
          invoice_id: string | null
          parcela: number | null
          parcelas_total: number | null
          payment_date: string | null
          pix_url: string | null
          sales_order_id: string | null
          source: string
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          asaas_payment_id?: string | null
          boleto_url?: string | null
          company_id: string
          contact_id?: string | null
          contract_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description: string
          due_date: string
          external_id?: string | null
          id?: string
          invoice_id?: string | null
          parcela?: number | null
          parcelas_total?: number | null
          payment_date?: string | null
          pix_url?: string | null
          sales_order_id?: string | null
          source?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          asaas_payment_id?: string | null
          boleto_url?: string | null
          company_id?: string
          contact_id?: string | null
          contract_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description?: string
          due_date?: string
          external_id?: string | null
          id?: string
          invoice_id?: string | null
          parcela?: number | null
          parcelas_total?: number | null
          payment_date?: string | null
          pix_url?: string | null
          sales_order_id?: string | null
          source?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "receivables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "receivables_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_cliente_360"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "receivables_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_recompra_clientes"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "receivables_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_contratos_a_reajustar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_log: {
        Row: {
          company_id: string
          created_at: string
          decision: string
          id: string
          kept_transaction_id: string
          removed_snapshot: Json
          removed_transaction_id: string
          resolved_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          decision?: string
          id?: string
          kept_transaction_id: string
          removed_snapshot?: Json
          removed_transaction_id: string
          resolved_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          decision?: string
          id?: string
          kept_transaction_id?: string
          removed_snapshot?: Json
          removed_transaction_id?: string
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "reconciliation_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          description: string
          discount_percent: number | null
          id: string
          order_id: string
          product_id: string | null
          quantity: number
          sort_order: number | null
          total: number
          unit_price: number
        }
        Insert: {
          description: string
          discount_percent?: number | null
          id?: string
          order_id: string
          product_id?: string | null
          quantity?: number
          sort_order?: number | null
          total?: number
          unit_price?: number
        }
        Update: {
          description?: string
          discount_percent?: number | null
          id?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          sort_order?: number | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_produtos_pendencia_fiscal"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          aceite_em: string | null
          aceite_ip: string | null
          aceite_nome: string | null
          commission_percent: number | null
          commission_value: number | null
          company_id: string
          contact_id: string | null
          created_at: string
          discount_percent: number | null
          discount_value: number | null
          due_date: string | null
          estoque_baixado_em: string | null
          id: string
          internal_notes: string | null
          issue_date: string
          notes: string | null
          order_number: number
          payment_method: string | null
          payment_terms: number | null
          proposta_token: string | null
          proposta_validade: string | null
          salesperson: string | null
          salesperson_id: string | null
          shipping: number | null
          status: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          aceite_em?: string | null
          aceite_ip?: string | null
          aceite_nome?: string | null
          commission_percent?: number | null
          commission_value?: number | null
          company_id: string
          contact_id?: string | null
          created_at?: string
          discount_percent?: number | null
          discount_value?: number | null
          due_date?: string | null
          estoque_baixado_em?: string | null
          id?: string
          internal_notes?: string | null
          issue_date?: string
          notes?: string | null
          order_number?: number
          payment_method?: string | null
          payment_terms?: number | null
          proposta_token?: string | null
          proposta_validade?: string | null
          salesperson?: string | null
          salesperson_id?: string | null
          shipping?: number | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          aceite_em?: string | null
          aceite_ip?: string | null
          aceite_nome?: string | null
          commission_percent?: number | null
          commission_value?: number | null
          company_id?: string
          contact_id?: string | null
          created_at?: string
          discount_percent?: number | null
          discount_value?: number | null
          due_date?: string | null
          estoque_baixado_em?: string | null
          id?: string
          internal_notes?: string | null
          issue_date?: string
          notes?: string | null
          order_number?: number
          payment_method?: string | null
          payment_terms?: number | null
          proposta_token?: string | null
          proposta_validade?: string | null
          salesperson?: string | null
          salesperson_id?: string | null
          shipping?: number | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "sales_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "sales_orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_cliente_360"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "sales_orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_recompra_clientes"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "sales_orders_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_targets: {
        Row: {
          company_id: string
          created_at: string
          id: string
          mes: string
          meta: number
          salesperson_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          mes: string
          meta: number
          salesperson_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          mes?: string
          meta?: number
          salesperson_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_targets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_targets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "sales_targets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "sales_targets_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
        ]
      }
      salespeople: {
        Row: {
          active: boolean
          comissao_padrao: number
          company_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          comissao_padrao?: number
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          comissao_padrao?: number
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salespeople_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salespeople_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "salespeople_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          company_id: string
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          type: string
          unit_cost: number | null
          user_id: string
          warehouse_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          type: string
          unit_cost?: number | null
          user_id: string
          warehouse_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          type?: string
          unit_cost?: number | null
          user_id?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_produtos_pendencia_fiscal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_guides: {
        Row: {
          company_id: string
          competencia: string
          created_at: string
          id: string
          invoice_id: string | null
          source: string
          status: string
          tipo: string
          updated_at: string
          valor: number
          vencimento: string
        }
        Insert: {
          company_id: string
          competencia: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          source?: string
          status?: string
          tipo: string
          updated_at?: string
          valor?: number
          vencimento: string
        }
        Update: {
          company_id?: string
          competencia?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          source?: string
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_guides_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_guides_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "tax_guides_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "tax_guides_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rates: {
        Row: {
          confidence: string
          ente_code: string
          id: string
          item_code: string | null
          notes: string | null
          rate: number
          source: string
          tax: string
          updated_at: string
          version: string | null
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          confidence?: string
          ente_code: string
          id?: string
          item_code?: string | null
          notes?: string | null
          rate: number
          source: string
          tax: string
          updated_at?: string
          version?: string | null
          vigencia_fim?: string | null
          vigencia_inicio: string
        }
        Update: {
          confidence?: string
          ente_code?: string
          id?: string
          item_code?: string | null
          notes?: string | null
          rate?: number
          source?: string
          tax?: string
          updated_at?: string
          version?: string | null
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: []
      }
      transaction_allocations: {
        Row: {
          company_id: string
          cost_center_id: string
          created_at: string
          id: string
          percentual: number
          transaction_id: string
          valor: number
        }
        Insert: {
          company_id: string
          cost_center_id: string
          created_at?: string
          id?: string
          percentual: number
          transaction_id: string
          valor: number
        }
        Update: {
          company_id?: string
          cost_center_id?: string
          created_at?: string
          id?: string
          percentual?: number
          transaction_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transaction_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "transaction_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "transaction_allocations_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_allocations_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
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
          competencia_date: string | null
          contact_id: string | null
          cost_center_id: string | null
          counterparty_company_id: string | null
          created_at: string
          date: string
          description: string
          external_id: string | null
          id: string
          is_intercompany: boolean
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
          competencia_date?: string | null
          contact_id?: string | null
          cost_center_id?: string | null
          counterparty_company_id?: string | null
          created_at?: string
          date: string
          description: string
          external_id?: string | null
          id?: string
          is_intercompany?: boolean
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
          competencia_date?: string | null
          contact_id?: string | null
          cost_center_id?: string | null
          counterparty_company_id?: string | null
          created_at?: string
          date?: string
          description?: string
          external_id?: string | null
          id?: string
          is_intercompany?: boolean
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
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "transactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_cliente_360"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "transactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_recompra_clientes"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "transactions_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_counterparty_company_id_fkey"
            columns: ["counterparty_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_counterparty_company_id_fkey"
            columns: ["counterparty_company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "transactions_counterparty_company_id_fkey"
            columns: ["counterparty_company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          id: string
          preferred_mode: string
          prefs: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          preferred_mode?: string
          prefs?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          preferred_mode?: string
          prefs?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          active: boolean
          address: string | null
          company_id: string
          created_at: string
          id: string
          is_default: boolean
          name: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
        }
        Update: {
          active?: boolean
          address?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "warehouses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
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
            foreignKeyName: "webhook_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "webhook_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
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
            foreignKeyName: "webhooks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "webhooks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
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
          evolution_api_key: string | null
          evolution_api_url: string | null
          group_jid: string | null
          group_name: string | null
          id: string
          instance_name: string
          notify_number: string | null
          phone_number: string | null
          updated_at: string
          webhook_secret: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          group_jid?: string | null
          group_name?: string | null
          id?: string
          instance_name: string
          notify_number?: string | null
          phone_number?: string | null
          updated_at?: string
          webhook_secret?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          group_jid?: string | null
          group_name?: string | null
          id?: string
          instance_name?: string
          notify_number?: string | null
          phone_number?: string | null
          updated_at?: string
          webhook_secret?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "whatsapp_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
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
          message_id: string | null
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
          message_id?: string | null
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
          message_id?: string | null
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
            foreignKeyName: "whatsapp_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "whatsapp_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
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
      v_ativacao_empresa: {
        Row: {
          andaime_por_lancamento: number | null
          company_id: string | null
          contas_configuradas: number | null
          created_at: string | null
          estagio: string | null
          lancamentos: number | null
          lancamentos_sem_conta: number | null
          lancamentos_sem_formulario: number | null
          name: string | null
          primeiro_fechamento_em: string | null
          primeiro_lancamento_em: string | null
          primeiro_recebivel_em: string | null
        }
        Insert: {
          andaime_por_lancamento?: never
          company_id?: string | null
          contas_configuradas?: never
          created_at?: string | null
          estagio?: never
          lancamentos?: never
          lancamentos_sem_conta?: never
          lancamentos_sem_formulario?: never
          name?: string | null
          primeiro_fechamento_em?: never
          primeiro_lancamento_em?: never
          primeiro_recebivel_em?: never
        }
        Update: {
          andaime_por_lancamento?: never
          company_id?: string | null
          contas_configuradas?: never
          created_at?: string | null
          estagio?: never
          lancamentos?: never
          lancamentos_sem_conta?: never
          lancamentos_sem_formulario?: never
          name?: string | null
          primeiro_fechamento_em?: never
          primeiro_lancamento_em?: never
          primeiro_recebivel_em?: never
        }
        Relationships: []
      }
      v_centro_custo_mes: {
        Row: {
          centro_nome: string | null
          company_id: string | null
          cost_center_id: string | null
          lancamentos: number | null
          mes: string | null
          total: number | null
          type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      v_cliente_360: {
        Row: {
          atraso_medio_dias: number | null
          company_id: string | null
          contact_id: string | null
          credit_limit: number | null
          default_payment_terms: number | null
          document: string | null
          em_aberto: number | null
          faturado: number | null
          name: string | null
          pedidos: number | null
          recebido: number | null
          ticket_medio: number | null
          titulos: number | null
          type: string | null
          ultimo_pedido_em: string | null
          ultimo_vencimento: string | null
          uso_do_limite_pct: number | null
          vencido: number | null
          whatsapp: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      v_company_margin: {
        Row: {
          company_id: string | null
          custos: number | null
          despesas: number | null
          month: string | null
          receita: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      v_company_margin_full: {
        Row: {
          company_id: string | null
          custos: number | null
          despesas: number | null
          month: string | null
          receita: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      v_contratos_a_reajustar: {
        Row: {
          aplica_sozinho: boolean | null
          company_id: string | null
          contact_id: string | null
          contato_nome: string | null
          description: string | null
          dias_para_aniversario: number | null
          id: string | null
          indice_reajuste: string | null
          percentual_reajuste: number | null
          percentual_sugerido: number | null
          proximo_reajuste: string | null
          ultimo_reajuste_em: string | null
          valor_atual: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contracts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_cliente_360"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "contracts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_recompra_clientes"
            referencedColumns: ["contact_id"]
          },
        ]
      }
      v_dre_linhas: {
        Row: {
          account_code: string | null
          account_id: string | null
          account_name: string | null
          company_id: string | null
          grupo: string | null
          is_intercompany: boolean | null
          lancamentos: number | null
          mes: string | null
          mes_competencia: string | null
          total: number | null
          type: string | null
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
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      v_group_account_totals: {
        Row: {
          company_id: string | null
          group_code: string | null
          group_name: string | null
          month: string | null
          total: number | null
          type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      v_group_ap_ar: {
        Row: {
          ap_a_vencer: number | null
          ap_vencido: number | null
          ar_a_vencer: number | null
          ar_vencido: number | null
          company_id: string | null
        }
        Insert: {
          ap_a_vencer?: never
          ap_vencido?: never
          ar_a_vencer?: never
          ar_vencido?: never
          company_id?: string | null
        }
        Update: {
          ap_a_vencer?: never
          ap_vencido?: never
          ar_a_vencer?: never
          ar_vencido?: never
          company_id?: string | null
        }
        Relationships: []
      }
      v_meta_vendedor: {
        Row: {
          atingimento_pct: number | null
          comissao: number | null
          company_id: string | null
          mes: string | null
          meta: number | null
          pedidos: number | null
          salesperson_id: string | null
          vendedor: string | null
          vendido: number | null
        }
        Relationships: []
      }
      v_mrr_movimentos: {
        Row: {
          company_id: string | null
          contratos_novos: number | null
          contratos_perdidos: number | null
          mes: string | null
          mrr_ativo: number | null
          mrr_novo: number | null
          mrr_perdido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      v_produtos_pendencia_fiscal: {
        Row: {
          account_id: string | null
          bloqueia_emissao: boolean | null
          cclasstrib: string | null
          company_id: string | null
          falta_cclasstrib: boolean | null
          falta_conta: boolean | null
          falta_ncm: boolean | null
          fiscal_confirmado_em: string | null
          fiscal_origem: string | null
          id: string | null
          name: string | null
          ncm: string | null
          sku: string | null
          type: string | null
        }
        Insert: {
          account_id?: string | null
          bloqueia_emissao?: never
          cclasstrib?: string | null
          company_id?: string | null
          falta_cclasstrib?: never
          falta_conta?: never
          falta_ncm?: never
          fiscal_confirmado_em?: string | null
          fiscal_origem?: string | null
          id?: string | null
          name?: string | null
          ncm?: string | null
          sku?: string | null
          type?: string | null
        }
        Update: {
          account_id?: string | null
          bloqueia_emissao?: never
          cclasstrib?: string | null
          company_id?: string | null
          falta_cclasstrib?: never
          falta_conta?: never
          falta_ncm?: never
          fiscal_confirmado_em?: string | null
          fiscal_origem?: string | null
          id?: string | null
          name?: string | null
          ncm?: string | null
          sku?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
      v_recompra_clientes: {
        Row: {
          company_id: string | null
          contact_id: string | null
          dias_desde_ultima: number | null
          intervalo_medio_dias: number | null
          n_compras: number | null
          name: string | null
          primeira_compra: string | null
          proxima_esperada: string | null
          status: string | null
          tem_contrato: boolean | null
          ticket_medio: number | null
          total_gasto: number | null
          ultima_compra: string | null
          whatsapp: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_ativacao_empresa"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_group_ap_ar"
            referencedColumns: ["company_id"]
          },
        ]
      }
    }
    Functions: {
      aceitar_convite: { Args: { p_token: string }; Returns: Json }
      aceitar_proposta: {
        Args: { p_ip?: string; p_nome: string; p_token: string }
        Returns: Json
      }
      acumulado_indice: {
        Args: { p_ate: string; p_de: string; p_indice: string }
        Returns: number
      }
      auditar_integridade_contabil: {
        Args: { p_company_id: string }
        Returns: {
          descricao: string
          exemplo: string
          quantidade: number
          regra: string
          severidade: string
        }[]
      }
      autores_da_empresa: {
        Args: { p_company_id: string }
        Returns: {
          email: string
          nome: string
          papel: string
          user_id: string
        }[]
      }
      brl: { Args: { p_valor: number }; Returns: string }
      carregar_cclasstrib: {
        Args: { p_linhas: Json; p_versao: string }
        Returns: Json
      }
      chamar_funcao_agendada: { Args: { p_slug: string }; Returns: number }
      checar_credito: {
        Args: { p_contact_id: string; p_valor: number }
        Returns: Json
      }
      create_company_for_user: {
        Args: { company_cnpj?: string; company_name: string }
        Returns: Json
      }
      encerrar_recorrencia: {
        Args: { p_recurrence_group_id: string }
        Returns: Json
      }
      faturar_pedido: {
        Args: {
          p_intervalo_dias?: number
          p_parcelas?: number
          p_primeiro_vencimento?: string
          p_sales_order_id: string
        }
        Returns: Json
      }
      fechar_comissao: {
        Args: { p_company_id: string; p_mes: string; p_vencimento?: string }
        Returns: Json
      }
      fechar_mes: {
        Args: { p_company_id: string; p_mes: string }
        Returns: Json
      }
      gen_org_id: { Args: never; Returns: string }
      gerar_conta_recorrente: {
        Args: {
          p_bill_id: string
          p_ocorrencias: number
          p_periodicidade?: string
        }
        Returns: Json
      }
      gerar_link_proposta: {
        Args: { p_dias_validade?: number; p_sales_order_id: string }
        Returns: Json
      }
      get_contaazul_credentials: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_focus_token: {
        Args: { p_company_id: string; p_environment: string }
        Returns: string
      }
      get_pluggy_credentials: { Args: { p_company_id: string }; Returns: Json }
      is_company_member: { Args: { _company_id: string }; Returns: boolean }
      is_demo_account: { Args: never; Returns: boolean }
      mes_esta_fechado: {
        Args: { p_company_id: string; p_data: string }
        Returns: boolean
      }
      plano_da_empresa: {
        Args: { p_company_id: string }
        Returns: {
          contaazul: boolean
          created_at: string
          key: string
          max_agentes: number
          max_widgets: number
          nome: string
          pdv: boolean
          preco_centavos: number
          whatsapp: boolean
        }
        SetofOptions: {
          from: "*"
          to: "plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      plataforma_bloqueada: { Args: never; Returns: boolean }
      pode_escrever_na_empresa: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      ratear_lancamento: {
        Args: { p_rateio: Json; p_transaction_id: string }
        Returns: Json
      }
      reabrir_mes: {
        Args: { p_company_id: string; p_mes: string; p_motivo: string }
        Returns: undefined
      }
      reajustar_contrato: {
        Args: {
          p_contract_id: string
          p_percentual: number
          p_vigencia?: string
        }
        Returns: Json
      }
      registrar_movimento_estoque: {
        Args: {
          p_company_id: string
          p_custo_unitario?: number
          p_observacao?: string
          p_product_id: string
          p_quantidade: number
          p_reference_id?: string
          p_reference_type?: string
          p_tipo: string
          p_warehouse_id?: string
        }
        Returns: Json
      }
      reserve_next_dps_number: { Args: { config_id: string }; Returns: number }
      rotate_contaazul_refresh_token: {
        Args: { p_company_id: string; p_refresh_token: string }
        Returns: undefined
      }
      set_contaazul_credentials: {
        Args: {
          p_client_id: string
          p_client_secret: string
          p_company_id: string
          p_refresh_token: string
        }
        Returns: undefined
      }
      set_focus_token: {
        Args: { p_company_id: string; p_environment: string; p_token: string }
        Returns: undefined
      }
      set_pluggy_credentials: {
        Args: {
          p_client_id: string
          p_client_secret: string
          p_company_id: string
        }
        Returns: undefined
      }
      sou_dono_da_plataforma: { Args: never; Returns: boolean }
      try_uuid: { Args: { t: string }; Returns: string }
      venda_balcao: {
        Args: {
          p_company_id: string
          p_contact_id?: string
          p_desconto?: number
          p_forma_pagamento?: string
          p_itens: Json
        }
        Returns: Json
      }
      ver_proposta: { Args: { p_token: string }; Returns: Json }
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
