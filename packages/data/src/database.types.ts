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
      accounting_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_entry_id: string | null
          created_at: string
          id: string
          organization_id: string
          period_end: string
          period_start: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_entry_id?: string | null
          created_at?: string
          id?: string
          organization_id: string
          period_end: string
          period_start: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_entry_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          period_end?: string
          period_start?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_periods_closing_entry_id_fkey"
            columns: ["closing_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_periods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_employee_memory: {
        Row: {
          content: string
          created_at: string
          employee_id: string
          expires_at: string | null
          id: string
          importance: number
          kind: string
          organization_id: string
          subject_id: string | null
          subject_type: string | null
        }
        Insert: {
          content: string
          created_at?: string
          employee_id: string
          expires_at?: string | null
          id?: string
          importance?: number
          kind?: string
          organization_id: string
          subject_id?: string | null
          subject_type?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          employee_id?: string
          expires_at?: string | null
          id?: string
          importance?: number
          kind?: string
          organization_id?: string
          subject_id?: string | null
          subject_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_employee_memory_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "ai_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_employee_memory_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_employee_metrics: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          metric_date: string
          metric_key: string
          metric_value: number
          organization_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          metric_date: string
          metric_key: string
          metric_value?: number
          organization_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          metric_date?: string
          metric_key?: string
          metric_value?: number
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_employee_metrics_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "ai_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_employee_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_employee_runs: {
        Row: {
          channel: string | null
          cost_cents: number
          employee_id: string
          ended_at: string | null
          id: string
          organization_id: string
          outcome: Json
          started_at: string
          status: string
          subject_id: string | null
          subject_type: string | null
          tokens_used: number
        }
        Insert: {
          channel?: string | null
          cost_cents?: number
          employee_id: string
          ended_at?: string | null
          id?: string
          organization_id: string
          outcome?: Json
          started_at?: string
          status?: string
          subject_id?: string | null
          subject_type?: string | null
          tokens_used?: number
        }
        Update: {
          channel?: string | null
          cost_cents?: number
          employee_id?: string
          ended_at?: string | null
          id?: string
          organization_id?: string
          outcome?: Json
          started_at?: string
          status?: string
          subject_id?: string | null
          subject_type?: string | null
          tokens_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_employee_runs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "ai_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_employee_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_employee_tools: {
        Row: {
          config: Json
          created_at: string
          dna_module: Database["public"]["Enums"]["dna_module"]
          employee_id: string
          enabled: boolean
          id: string
          organization_id: string
          tool_key: string
        }
        Insert: {
          config?: Json
          created_at?: string
          dna_module: Database["public"]["Enums"]["dna_module"]
          employee_id: string
          enabled?: boolean
          id?: string
          organization_id: string
          tool_key: string
        }
        Update: {
          config?: Json
          created_at?: string
          dna_module?: Database["public"]["Enums"]["dna_module"]
          employee_id?: string
          enabled?: boolean
          id?: string
          organization_id?: string
          tool_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_employee_tools_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "ai_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_employee_tools_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_employees: {
        Row: {
          config: Json
          created_at: string
          department: string
          dna_module: Database["public"]["Enums"]["dna_module"]
          goals: Json
          id: string
          industry_pack: string | null
          knowledge_sources: Json
          model: string
          name: string
          organization_id: string
          permissions: Json
          personality: string
          role: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          department: string
          dna_module: Database["public"]["Enums"]["dna_module"]
          goals?: Json
          id?: string
          industry_pack?: string | null
          knowledge_sources?: Json
          model?: string
          name: string
          organization_id: string
          permissions?: Json
          personality?: string
          role: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          department?: string
          dna_module?: Database["public"]["Enums"]["dna_module"]
          goals?: Json
          id?: string
          industry_pack?: string | null
          knowledge_sources?: Json
          model?: string
          name?: string
          organization_id?: string
          permissions?: Json
          personality?: string
          role?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_types: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          name: string
          organization_id: string
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name: string
          organization_id: string
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          organization_id?: string
          sort?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: number
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          organization_id: string
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: number
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          organization_id: string
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: number
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action: string
          config: Json
          created_at: string
          enabled: boolean
          id: string
          last_run_at: string | null
          name: string
          organization_id: string
          run_count: number
          trigger: string
          updated_at: string
        }
        Insert: {
          action: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name: string
          organization_id: string
          run_count?: number
          trigger: string
          updated_at?: string
        }
        Update: {
          action?: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name?: string
          organization_id?: string
          run_count?: number
          trigger?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          available_balance: number | null
          coa_account_id: string | null
          connection_id: string
          created_at: string
          current_balance: number | null
          id: string
          is_active: boolean
          iso_currency_code: string
          mask: string | null
          name: string
          official_name: string | null
          organization_id: string
          plaid_account_id: string
          subtype: string | null
          type: string
          updated_at: string
        }
        Insert: {
          available_balance?: number | null
          coa_account_id?: string | null
          connection_id: string
          created_at?: string
          current_balance?: number | null
          id?: string
          is_active?: boolean
          iso_currency_code?: string
          mask?: string | null
          name: string
          official_name?: string | null
          organization_id: string
          plaid_account_id: string
          subtype?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          available_balance?: number | null
          coa_account_id?: string | null
          connection_id?: string
          created_at?: string
          current_balance?: number | null
          id?: string
          is_active?: boolean
          iso_currency_code?: string
          mask?: string | null
          name?: string
          official_name?: string | null
          organization_id?: string
          plaid_account_id?: string
          subtype?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_coa_account_id_fkey"
            columns: ["coa_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_connections: {
        Row: {
          created_at: string
          cursor: string | null
          error_code: string | null
          id: string
          institution_id: string | null
          institution_name: string | null
          last_synced_at: string | null
          organization_id: string
          plaid_access_token_enc: string
          plaid_item_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cursor?: string | null
          error_code?: string | null
          id?: string
          institution_id?: string | null
          institution_name?: string | null
          last_synced_at?: string | null
          organization_id: string
          plaid_access_token_enc: string
          plaid_item_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cursor?: string | null
          error_code?: string | null
          id?: string
          institution_id?: string | null
          institution_name?: string | null
          last_synced_at?: string | null
          organization_id?: string
          plaid_access_token_enc?: string
          plaid_item_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          account_id: string
          ai_category_confidence: number | null
          ai_suggested_memo: string | null
          amount: number
          authorized_date: string | null
          category_legacy: string[] | null
          coa_account_id: string | null
          created_at: string
          date: string
          id: string
          iso_currency_code: string
          journal_entry_id: string | null
          memo: string | null
          merchant_name: string | null
          name: string
          organization_id: string
          pending: boolean
          personal_finance_category: string | null
          personal_finance_category_detail: string | null
          plaid_pending_transaction_id: string | null
          plaid_transaction_id: string
          reviewed: boolean
          updated_at: string
        }
        Insert: {
          account_id: string
          ai_category_confidence?: number | null
          ai_suggested_memo?: string | null
          amount: number
          authorized_date?: string | null
          category_legacy?: string[] | null
          coa_account_id?: string | null
          created_at?: string
          date: string
          id?: string
          iso_currency_code?: string
          journal_entry_id?: string | null
          memo?: string | null
          merchant_name?: string | null
          name: string
          organization_id: string
          pending?: boolean
          personal_finance_category?: string | null
          personal_finance_category_detail?: string | null
          plaid_pending_transaction_id?: string | null
          plaid_transaction_id: string
          reviewed?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string
          ai_category_confidence?: number | null
          ai_suggested_memo?: string | null
          amount?: number
          authorized_date?: string | null
          category_legacy?: string[] | null
          coa_account_id?: string | null
          created_at?: string
          date?: string
          id?: string
          iso_currency_code?: string
          journal_entry_id?: string | null
          memo?: string | null
          merchant_name?: string | null
          name?: string
          organization_id?: string
          pending?: boolean
          personal_finance_category?: string | null
          personal_finance_category_detail?: string | null
          plaid_pending_transaction_id?: string | null
          plaid_transaction_id?: string
          reviewed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_coa_account_id_fkey"
            columns: ["coa_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          amount: number
          bill_number: string | null
          created_at: string
          description: string | null
          due_date: string
          expense_account_id: string | null
          id: string
          issue_date: string
          journal_entry_id: string | null
          organization_id: string
          paid_at: string | null
          paid_bank_account_id: string | null
          status: string
          vendor: string
        }
        Insert: {
          amount: number
          bill_number?: string | null
          created_at?: string
          description?: string | null
          due_date: string
          expense_account_id?: string | null
          id?: string
          issue_date?: string
          journal_entry_id?: string | null
          organization_id: string
          paid_at?: string | null
          paid_bank_account_id?: string | null
          status?: string
          vendor: string
        }
        Update: {
          amount?: number
          bill_number?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          expense_account_id?: string | null
          id?: string
          issue_date?: string
          journal_entry_id?: string | null
          organization_id?: string
          paid_at?: string | null
          paid_bank_account_id?: string | null
          status?: string
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_paid_bank_account_id_fkey"
            columns: ["paid_bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          auto_replied: boolean
          called_at: string
          client_id: string | null
          created_at: string
          duration_seconds: number | null
          from_number: string
          id: string
          organization_id: string
          reply_body: string | null
          status: string
          to_number: string
          twilio_call_sid: string | null
        }
        Insert: {
          auto_replied?: boolean
          called_at?: string
          client_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          from_number: string
          id?: string
          organization_id: string
          reply_body?: string | null
          status: string
          to_number: string
          twilio_call_sid?: string | null
        }
        Update: {
          auto_replied?: boolean
          called_at?: string
          client_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          from_number?: string
          id?: string
          organization_id?: string
          reply_body?: string | null
          status?: string
          to_number?: string
          twilio_call_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          body: string
          created_at: string
          html_body: string | null
          id: string
          name: string
          organization_id: string
          recipient_count: number | null
          recipient_filter: string
          recipient_tag: string | null
          sent_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          html_body?: string | null
          id?: string
          name: string
          organization_id: string
          recipient_count?: number | null
          recipient_filter?: string
          recipient_tag?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          html_body?: string | null
          id?: string
          name?: string
          organization_id?: string
          recipient_count?: number | null
          recipient_filter?: string
          recipient_tag?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          normal_balance: string
          organization_id: string
          parent_account_id: string | null
          tax_line_code: string | null
          type: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          normal_balance: string
          organization_id: string
          parent_account_id?: string | null
          tax_line_code?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          normal_balance?: string
          organization_id?: string
          parent_account_id?: string | null
          tax_line_code?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          author_id: string | null
          body: string
          client_id: string
          created_at: string
          id: string
          kind: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          client_id: string
          created_at?: string
          id?: string
          kind?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          kind?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          auto_pilot: boolean
          company: string | null
          created_at: string
          email: string | null
          expected_value: number | null
          first_name: string
          id: string
          last_name: string | null
          lifetime_value: number
          notes: string | null
          organization_id: string
          phone: string | null
          pipeline_note: string | null
          pipeline_stage: string
          portal_token: string
          preferred_language: string | null
          source: string | null
          stage_changed_at: string
          status: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          auto_pilot?: boolean
          company?: string | null
          created_at?: string
          email?: string | null
          expected_value?: number | null
          first_name: string
          id?: string
          last_name?: string | null
          lifetime_value?: number
          notes?: string | null
          organization_id: string
          phone?: string | null
          pipeline_note?: string | null
          pipeline_stage?: string
          portal_token?: string
          preferred_language?: string | null
          source?: string | null
          stage_changed_at?: string
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          auto_pilot?: boolean
          company?: string | null
          created_at?: string
          email?: string | null
          expected_value?: number | null
          first_name?: string
          id?: string
          last_name?: string | null
          lifetime_value?: number
          notes?: string | null
          organization_id?: string
          phone?: string | null
          pipeline_note?: string | null
          pipeline_stage?: string
          portal_token?: string
          preferred_language?: string | null
          source?: string | null
          stage_changed_at?: string
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_briefings: {
        Row: {
          actions: Json
          briefing_date: string
          created_at: string
          headline: string
          id: string
          organization_id: string
        }
        Insert: {
          actions?: Json
          briefing_date: string
          created_at?: string
          headline: string
          id?: string
          organization_id: string
        }
        Update: {
          actions?: Json
          briefing_date?: string
          created_at?: string
          headline?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_briefings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_lines: {
        Row: {
          amount: number
          created_at: string
          description: string
          estimate_id: string
          id: string
          quantity: number
          sort_order: number
          unit_price: number
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          estimate_id: string
          id?: string
          quantity?: number
          sort_order?: number
          unit_price: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          estimate_id?: string
          id?: string
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_lines_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_templates: {
        Row: {
          created_at: string
          id: string
          lines: Json
          name: string
          notes: string | null
          organization_id: string
          tax_rate: number
        }
        Insert: {
          created_at?: string
          id?: string
          lines?: Json
          name: string
          notes?: string | null
          organization_id: string
          tax_rate?: number
        }
        Update: {
          created_at?: string
          id?: string
          lines?: Json
          name?: string
          notes?: string | null
          organization_id?: string
          tax_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          client_id: string | null
          converted_invoice_id: string | null
          converted_project_id: string | null
          created_at: string
          estimate_number: string
          expiry_date: string
          id: string
          issue_date: string
          notes: string | null
          organization_id: string
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          converted_invoice_id?: string | null
          converted_project_id?: string | null
          created_at?: string
          estimate_number: string
          expiry_date: string
          id?: string
          issue_date?: string
          notes?: string | null
          organization_id: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          converted_invoice_id?: string | null
          converted_project_id?: string | null
          created_at?: string
          estimate_number?: string
          expiry_date?: string
          id?: string
          issue_date?: string
          notes?: string | null
          organization_id?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_converted_invoice_id_fkey"
            columns: ["converted_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_converted_project_id_fkey"
            columns: ["converted_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean
          client_id: string | null
          color: string
          completed: boolean
          created_at: string
          description: string | null
          end_at: string | null
          google_event_id: string | null
          id: string
          location: string | null
          organization_id: string
          start_at: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          client_id?: string | null
          color?: string
          completed?: boolean
          created_at?: string
          description?: string | null
          end_at?: string | null
          google_event_id?: string | null
          id?: string
          location?: string | null
          organization_id: string
          start_at: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          client_id?: string | null
          color?: string
          completed?: boolean
          created_at?: string
          description?: string | null
          end_at?: string | null
          google_event_id?: string | null
          id?: string
          location?: string | null
          organization_id?: string
          start_at?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          amount: number
          coa_account_id: string | null
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          sort_order: number
          unit_price: number
        }
        Insert: {
          amount: number
          coa_account_id?: string | null
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          sort_order?: number
          unit_price: number
        }
        Update: {
          amount?: number
          coa_account_id?: string | null
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_coa_account_id_fkey"
            columns: ["coa_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string | null
          created_at: string
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          journal_entry_id: string | null
          last_reminder_sent_at: string | null
          notes: string | null
          organization_id: string
          paid_at: string | null
          reminder_count: number
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          due_date: string
          id?: string
          invoice_number: string
          issue_date?: string
          journal_entry_id?: string | null
          last_reminder_sent_at?: string | null
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          reminder_count?: number
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          journal_entry_id?: string | null
          last_reminder_sent_at?: string | null
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          reminder_count?: number
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          date: string
          id: string
          is_reversal: boolean
          memo: string | null
          organization_id: string
          posted_by: string | null
          project_id: string | null
          receipt_filename: string | null
          receipt_url: string | null
          reversed_by_entry_id: string | null
          reversed_entry_id: string | null
          source_id: string | null
          source_type: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_reversal?: boolean
          memo?: string | null
          organization_id: string
          posted_by?: string | null
          project_id?: string | null
          receipt_filename?: string | null
          receipt_url?: string | null
          reversed_by_entry_id?: string | null
          reversed_entry_id?: string | null
          source_id?: string | null
          source_type: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_reversal?: boolean
          memo?: string | null
          organization_id?: string
          posted_by?: string | null
          project_id?: string | null
          receipt_filename?: string | null
          receipt_url?: string | null
          reversed_by_entry_id?: string | null
          reversed_entry_id?: string | null
          source_id?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reversed_by_entry_id_fkey"
            columns: ["reversed_by_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reversed_entry_id_fkey"
            columns: ["reversed_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          debit: number
          description: string | null
          id: string
          journal_entry_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          active: boolean
          content: string
          created_at: string
          id: string
          organization_id: string
          sort: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          content: string
          created_at?: string
          id?: string
          organization_id: string
          sort?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          content?: string
          created_at?: string
          id?: string
          organization_id?: string
          sort?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          channel: string
          client_id: string | null
          created_at: string
          direction: string
          external_id: string | null
          from_address: string | null
          id: string
          intent: string | null
          organization_id: string
          priority: string | null
          read: boolean
          sent_at: string
          subject: string | null
          to_address: string | null
          translation_en: string | null
        }
        Insert: {
          body: string
          channel: string
          client_id?: string | null
          created_at?: string
          direction: string
          external_id?: string | null
          from_address?: string | null
          id?: string
          intent?: string | null
          organization_id: string
          priority?: string | null
          read?: boolean
          sent_at?: string
          subject?: string | null
          to_address?: string | null
          translation_en?: string | null
        }
        Update: {
          body?: string
          channel?: string
          client_id?: string | null
          created_at?: string
          direction?: string
          external_id?: string | null
          from_address?: string | null
          id?: string
          intent?: string | null
          organization_id?: string
          priority?: string | null
          read?: boolean
          sent_at?: string
          subject?: string | null
          to_address?: string | null
          translation_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          organization_id: string
          read: boolean
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          organization_id: string
          read?: boolean
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          organization_id?: string
          read?: boolean
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_oauth_tokens: {
        Row: {
          access_token: string
          account_email: string | null
          connected_at: string
          expires_at: string | null
          id: string
          organization_id: string
          provider: string
          refresh_token: string | null
          scope: string | null
          token_type: string
          updated_at: string
        }
        Insert: {
          access_token: string
          account_email?: string | null
          connected_at?: string
          expires_at?: string | null
          id?: string
          organization_id: string
          provider: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          account_email?: string | null
          connected_at?: string
          expires_at?: string | null
          id?: string
          organization_id?: string
          provider?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_oauth_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string
          organization_id: string
          role: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          organization_id: string
          role?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          organization_id?: string
          role?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          accounting_basis: string
          auto_reply: boolean
          auto_reply_msg: string
          business_hours: Json | null
          created_at: string
          currency: string
          default_hourly_rate: number | null
          default_labor_cost_rate: number | null
          entity_type: string
          fiscal_year_end_month: number
          id: string
          name: string
          owner_english_assist: boolean
          plan: string
          slug: string
          stripe_customer_id: string | null
          subscription_status: string
          tenant_id: string | null
          timezone: string
          trial_ends_at: string | null
          twilio_number: string | null
          updated_at: string
          voice_agent_business_name: string | null
          voice_agent_business_name_zh: string | null
          voice_agent_enabled: boolean
          voice_agent_greeting: string
          voice_agent_name: string | null
          voice_agent_prompt: string | null
          voice_reminder_enabled: boolean
          voice_reminder_lead_minutes: number
          weekly_digest_enabled: boolean
        }
        Insert: {
          accounting_basis?: string
          auto_reply?: boolean
          auto_reply_msg?: string
          business_hours?: Json | null
          created_at?: string
          currency?: string
          default_hourly_rate?: number | null
          default_labor_cost_rate?: number | null
          entity_type?: string
          fiscal_year_end_month?: number
          id?: string
          name: string
          owner_english_assist?: boolean
          plan?: string
          slug: string
          stripe_customer_id?: string | null
          subscription_status?: string
          tenant_id?: string | null
          timezone?: string
          trial_ends_at?: string | null
          twilio_number?: string | null
          updated_at?: string
          voice_agent_business_name?: string | null
          voice_agent_business_name_zh?: string | null
          voice_agent_enabled?: boolean
          voice_agent_greeting?: string
          voice_agent_name?: string | null
          voice_agent_prompt?: string | null
          voice_reminder_enabled?: boolean
          voice_reminder_lead_minutes?: number
          weekly_digest_enabled?: boolean
        }
        Update: {
          accounting_basis?: string
          auto_reply?: boolean
          auto_reply_msg?: string
          business_hours?: Json | null
          created_at?: string
          currency?: string
          default_hourly_rate?: number | null
          default_labor_cost_rate?: number | null
          entity_type?: string
          fiscal_year_end_month?: number
          id?: string
          name?: string
          owner_english_assist?: boolean
          plan?: string
          slug?: string
          stripe_customer_id?: string | null
          subscription_status?: string
          tenant_id?: string | null
          timezone?: string
          trial_ends_at?: string | null
          twilio_number?: string | null
          updated_at?: string
          voice_agent_business_name?: string | null
          voice_agent_business_name_zh?: string | null
          voice_agent_enabled?: boolean
          voice_agent_greeting?: string
          voice_agent_name?: string | null
          voice_agent_prompt?: string | null
          voice_reminder_enabled?: boolean
          voice_reminder_lead_minutes?: number
          weekly_digest_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "organizations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_call_queue: {
        Row: {
          attempts: number
          call_sid: string | null
          client_id: string
          created_at: string
          detail: string | null
          event_id: string | null
          id: string
          last_error: string | null
          organization_id: string
          purpose: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          call_sid?: string | null
          client_id: string
          created_at?: string
          detail?: string | null
          event_id?: string | null
          id?: string
          last_error?: string | null
          organization_id: string
          purpose: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          call_sid?: string | null
          client_id?: string
          created_at?: string
          detail?: string | null
          event_id?: string | null
          id?: string
          last_error?: string | null
          organization_id?: string
          purpose?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_call_queue_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_call_queue_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_call_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payee_categories: {
        Row: {
          coa_account_id: string
          created_at: string
          id: string
          organization_id: string
          payee_key: string
          updated_at: string
        }
        Insert: {
          coa_account_id: string
          created_at?: string
          id?: string
          organization_id: string
          payee_key: string
          updated_at?: string
        }
        Update: {
          coa_account_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          payee_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payee_categories_coa_account_id_fkey"
            columns: ["coa_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payee_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget_alert_level: number
          budget_amount: number | null
          budget_hours: number | null
          client_id: string | null
          color: string
          created_at: string
          description: string | null
          end_date: string | null
          hourly_rate: number | null
          id: string
          name: string
          organization_id: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget_alert_level?: number
          budget_amount?: number | null
          budget_hours?: number | null
          client_id?: string | null
          color?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          hourly_rate?: number | null
          id?: string
          name: string
          organization_id: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget_alert_level?: number
          budget_amount?: number | null
          budget_hours?: number | null
          client_id?: string | null
          color?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          hourly_rate?: number | null
          id?: string
          name?: string
          organization_id?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_bills: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          due_days: number
          expense_account_id: string | null
          frequency: string
          id: string
          last_generated_at: string | null
          next_run_date: string
          organization_id: string
          status: string
          vendor: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          due_days?: number
          expense_account_id?: string | null
          frequency?: string
          id?: string
          last_generated_at?: string | null
          next_run_date: string
          organization_id: string
          status?: string
          vendor: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          due_days?: number
          expense_account_id?: string | null
          frequency?: string
          id?: string
          last_generated_at?: string | null
          next_run_date?: string
          organization_id?: string
          status?: string
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_bills_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_bills_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_invoices: {
        Row: {
          client_id: string | null
          created_at: string
          frequency: string
          id: string
          last_generated_at: string | null
          line_items: Json
          next_invoice_date: string
          notes: string | null
          organization_id: string
          status: string
          tax_rate: number
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          frequency: string
          id?: string
          last_generated_at?: string | null
          line_items?: Json
          next_invoice_date: string
          notes?: string | null
          organization_id: string
          status?: string
          tax_rate?: number
          title?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          frequency?: string
          id?: string
          last_generated_at?: string | null
          line_items?: Json
          next_invoice_date?: string
          notes?: string | null
          organization_id?: string
          status?: string
          tax_rate?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_projects: {
        Row: {
          budget_amount: number | null
          budget_hours: number | null
          client_id: string | null
          color: string
          created_at: string
          description: string | null
          frequency: string
          hourly_rate: number | null
          id: string
          last_generated_at: string | null
          name: string
          next_run_date: string
          organization_id: string
          status: string
        }
        Insert: {
          budget_amount?: number | null
          budget_hours?: number | null
          client_id?: string | null
          color?: string
          created_at?: string
          description?: string | null
          frequency?: string
          hourly_rate?: number | null
          id?: string
          last_generated_at?: string | null
          name: string
          next_run_date: string
          organization_id: string
          status?: string
        }
        Update: {
          budget_amount?: number | null
          budget_hours?: number | null
          client_id?: string | null
          color?: string
          created_at?: string
          description?: string | null
          frequency?: string
          hourly_rate?: number | null
          id?: string
          last_generated_at?: string | null
          name?: string
          next_run_date?: string
          organization_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_tasks: {
        Row: {
          client_id: string | null
          created_at: string
          frequency: string
          id: string
          last_generated_at: string | null
          next_run_date: string
          notes: string | null
          organization_id: string
          priority: string
          status: string
          title: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          frequency?: string
          id?: string
          last_generated_at?: string | null
          next_run_date: string
          notes?: string | null
          organization_id: string
          priority?: string
          status?: string
          title: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          frequency?: string
          id?: string
          last_generated_at?: string | null
          next_run_date?: string
          notes?: string | null
          organization_id?: string
          priority?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          ai_prompt: string | null
          content: string
          created_at: string
          generated_by_ai: boolean
          id: string
          media_url: string | null
          organization_id: string
          platform: string
          published_at: string | null
          published_url: string | null
          scheduled_at: string | null
          status: string
          tone: string
          updated_at: string
        }
        Insert: {
          ai_prompt?: string | null
          content: string
          created_at?: string
          generated_by_ai?: boolean
          id?: string
          media_url?: string | null
          organization_id: string
          platform: string
          published_at?: string | null
          published_url?: string | null
          scheduled_at?: string | null
          status?: string
          tone?: string
          updated_at?: string
        }
        Update: {
          ai_prompt?: string | null
          content?: string
          created_at?: string
          generated_by_ai?: boolean
          id?: string
          media_url?: string | null
          organization_id?: string
          platform?: string
          published_at?: string | null
          published_url?: string | null
          scheduled_at?: string | null
          status?: string
          tone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          client_id: string | null
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          organization_id: string
          priority: string
          project_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          priority?: string
          project_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          priority?: string
          project_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          plan: string
          slug: string
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          name: string
          plan?: string
          slug: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          plan?: string
          slug?: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          billable: boolean
          client_id: string | null
          cost_rate: number | null
          created_at: string
          description: string
          duration_minutes: number | null
          ended_at: string | null
          hourly_rate: number | null
          id: string
          invoice_id: string | null
          invoiced: boolean
          organization_id: string
          project: string | null
          project_id: string | null
          started_at: string
          updated_at: string
        }
        Insert: {
          billable?: boolean
          client_id?: string | null
          cost_rate?: number | null
          created_at?: string
          description?: string
          duration_minutes?: number | null
          ended_at?: string | null
          hourly_rate?: number | null
          id?: string
          invoice_id?: string | null
          invoiced?: boolean
          organization_id: string
          project?: string | null
          project_id?: string | null
          started_at: string
          updated_at?: string
        }
        Update: {
          billable?: boolean
          client_id?: string | null
          cost_rate?: number | null
          created_at?: string
          description?: string
          duration_minutes?: number | null
          ended_at?: string | null
          hourly_rate?: number | null
          id?: string
          invoice_id?: string | null
          invoiced?: boolean
          organization_id?: string
          project?: string | null
          project_id?: string | null
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_1099: boolean
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_1099?: boolean
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_1099?: boolean
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_sessions: {
        Row: {
          billed_at: string | null
          booked_event_id: string | null
          call_sid: string
          client_id: string | null
          created_at: string
          direction: string
          duration_seconds: number | null
          from_number: string
          id: string
          messages: Json
          organization_id: string
          purpose: string | null
          recording_url: string | null
          status: string
          summary: string | null
          to_number: string
          updated_at: string
        }
        Insert: {
          billed_at?: string | null
          booked_event_id?: string | null
          call_sid: string
          client_id?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          from_number: string
          id?: string
          messages?: Json
          organization_id: string
          purpose?: string | null
          recording_url?: string | null
          status?: string
          summary?: string | null
          to_number: string
          updated_at?: string
        }
        Update: {
          billed_at?: string | null
          booked_event_id?: string | null
          call_sid?: string
          client_id?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          from_number?: string
          id?: string
          messages?: Json
          organization_id?: string
          purpose?: string | null
          recording_url?: string | null
          status?: string
          summary?: string | null
          to_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_sessions_booked_event_id_fkey"
            columns: ["booked_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          organization_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          name: string
          organization_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          organization_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_admin_org_ids: { Args: never; Returns: string[] }
      get_user_org_ids: { Args: never; Returns: string[] }
      get_user_scope: {
        Args: never
        Returns: {
          organization_id: string
          tenant_id: string
        }[]
      }
      get_user_tenant_ids: { Args: never; Returns: string[] }
      get_user_workspace_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      dna_module:
        | "revenue"
        | "marketing"
        | "service"
        | "operations"
        | "finance"
        | "people"
        | "communication"
        | "knowledge"
        | "intelligence"
        | "platform"
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
      dna_module: [
        "revenue",
        "marketing",
        "service",
        "operations",
        "finance",
        "people",
        "communication",
        "knowledge",
        "intelligence",
        "platform",
      ],
    },
  },
} as const
