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
      answers: {
        Row: {
          choice_label: string
          choice_text: string
          explanation_text: string | null
          id: string
          is_correct: boolean
          question_id: string
        }
        Insert: {
          choice_label: string
          choice_text: string
          explanation_text?: string | null
          id?: string
          is_correct?: boolean
          question_id: string
        }
        Update: {
          choice_label?: string
          choice_text?: string
          explanation_text?: string | null
          id?: string
          is_correct?: boolean
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      cert_waitlist: {
        Row: {
          cert_id: string
          created_at: string
          email: string
          id: string
          source_path: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          cert_id: string
          created_at?: string
          email: string
          id?: string
          source_path?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          cert_id?: string
          created_at?: string
          email?: string
          id?: string
          source_path?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      exam_domains: {
        Row: {
          code: string
          description: string | null
          exam: string
          id: string
          name: string
        }
        Insert: {
          code: string
          description?: string | null
          exam?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          description?: string | null
          exam?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      explanations: {
        Row: {
          doc_links: Json | null
          explanation_text: string
          id: string
          question_id: string
          reasoning_style: string | null
        }
        Insert: {
          doc_links?: Json | null
          explanation_text: string
          id?: string
          question_id: string
          reasoning_style?: string | null
        }
        Update: {
          doc_links?: Json | null
          explanation_text?: string
          id?: string
          question_id?: string
          reasoning_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "explanations_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      free_practice_quota: {
        Row: {
          month_start: string
          questions_used: number
          user_id: string
        }
        Insert: {
          month_start: string
          questions_used: number
          user_id: string
        }
        Update: {
          month_start?: string
          questions_used?: number
          user_id?: string
        }
        Relationships: []
      }
      payment_history: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          id: string
          receipt_url: string | null
          status: string
          stripe_payment_intent_id: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency: string
          id?: string
          receipt_url?: string | null
          status: string
          stripe_payment_intent_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          id?: string
          receipt_url?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pmle_pass_refunds: {
        Row: {
          refunded_at: string
          stripe_payment_intent_id: string
        }
        Insert: {
          refunded_at: string
          stripe_payment_intent_id: string
        }
        Update: {
          refunded_at?: string
          stripe_payment_intent_id?: string
        }
        Relationships: []
      }
      pmle_passes: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          paid_at: string
          purchase_completed_at: string | null
          refunded_at: string | null
          stripe_checkout_session_id: string
          stripe_customer_id: string
          stripe_payment_intent_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          paid_at: string
          purchase_completed_at?: string | null
          refunded_at?: string | null
          stripe_checkout_session_id: string
          stripe_customer_id: string
          stripe_payment_intent_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          paid_at?: string
          purchase_completed_at?: string | null
          refunded_at?: string | null
          stripe_checkout_session_id?: string
          stripe_customer_id?: string
          stripe_payment_intent_id?: string
          user_id?: string
        }
        Relationships: []
      }
      question_generation_runs: {
        Row: {
          completed_at: string | null
          created_by: string | null
          domain_code: string
          exam: string
          generated_count: number
          id: string
          model: string
          notes: string | null
          prompt_version: string | null
          started_at: string
          target_count: number
        }
        Insert: {
          completed_at?: string | null
          created_by?: string | null
          domain_code: string
          exam: string
          generated_count?: number
          id?: string
          model: string
          notes?: string | null
          prompt_version?: string | null
          started_at?: string
          target_count: number
        }
        Update: {
          completed_at?: string | null
          created_by?: string | null
          domain_code?: string
          exam?: string
          generated_count?: number
          id?: string
          model?: string
          notes?: string | null
          prompt_version?: string | null
          started_at?: string
          target_count?: number
        }
        Relationships: []
      }
      question_reports: {
        Row: {
          created_at: string
          email: string
          id: string
          item_id: string
          note: string
          owner_key: string
          question_id: string
          reason: string
          session_id: string
        }
        Insert: {
          created_at?: string
          email?: string
          id?: string
          item_id: string
          note?: string
          owner_key: string
          question_id: string
          reason: string
          session_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          item_id?: string
          note?: string
          owner_key?: string
          question_id?: string
          reason?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_reports_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "session_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_reports_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_tags: {
        Row: {
          confidence: number
          created_at: string
          dimension: string
          question_id: string
          source: string
          value_key: string
        }
        Insert: {
          confidence: number
          created_at?: string
          dimension: string
          question_id: string
          source: string
          value_key: string
        }
        Update: {
          confidence?: number
          created_at?: string
          dimension?: string
          question_id?: string
          source?: string
          value_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_tags_dimension_value_key_fkey"
            columns: ["dimension", "value_key"]
            isOneToOne: false
            referencedRelation: "question_taxonomy"
            referencedColumns: ["dimension", "value_key"]
          },
          {
            foreignKeyName: "question_tags_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_taxonomy: {
        Row: {
          active: boolean
          cert_scope: string[]
          definition: string
          dimension: string
          label: string
          value_key: string
        }
        Insert: {
          active?: boolean
          cert_scope?: string[]
          definition: string
          dimension: string
          label: string
          value_key: string
        }
        Update: {
          active?: boolean
          cert_scope?: string[]
          definition?: string
          dimension?: string
          label?: string
          value_key?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          created_at: string
          difficulty: string | null
          domain_id: string
          exam: string
          generation_run_id: string | null
          id: string
          question_type: string
          review_notes: string | null
          review_status: string
          source_ref: string | null
          status: string | null
          stem: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          difficulty?: string | null
          domain_id: string
          exam: string
          generation_run_id?: string | null
          id?: string
          question_type?: string
          review_notes?: string | null
          review_status?: string
          source_ref?: string | null
          status?: string | null
          stem: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          difficulty?: string | null
          domain_id?: string
          exam?: string
          generation_run_id?: string | null
          id?: string
          question_type?: string
          review_notes?: string | null
          review_status?: string
          source_ref?: string | null
          status?: string | null
          stem?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_domain_id_fkey"
            columns: ["domain_id", "exam"]
            isOneToOne: false
            referencedRelation: "exam_domains"
            referencedColumns: ["id", "exam"]
          },
          {
            foreignKeyName: "questions_generation_run_id_fkey"
            columns: ["generation_run_id"]
            isOneToOne: false
            referencedRelation: "question_generation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      results_email_requests: {
        Row: {
          consent: boolean
          consent_version: string
          created_at: string
          email: string
          id: string
          lease_token: string | null
          lease_until: string | null
          payload: string
          sent_at: string | null
          session_id: string
        }
        Insert: {
          consent: boolean
          consent_version?: string
          created_at?: string
          email: string
          id?: string
          lease_token?: string | null
          lease_until?: string | null
          payload: string
          sent_at?: string | null
          session_id: string
        }
        Update: {
          consent?: boolean
          consent_version?: string
          created_at?: string
          email?: string
          id?: string
          lease_token?: string | null
          lease_until?: string | null
          payload?: string
          sent_at?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "results_email_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_items: {
        Row: {
          answered_at: string | null
          correct_label: string
          domain_code: string
          domain_name: string
          id: string
          is_correct: boolean | null
          options: Json
          ordinal: number
          question_id: string
          selected_label: string | null
          session_id: string
          stem: string
        }
        Insert: {
          answered_at?: string | null
          correct_label: string
          domain_code: string
          domain_name: string
          id?: string
          is_correct?: boolean | null
          options: Json
          ordinal: number
          question_id: string
          selected_label?: string | null
          session_id: string
          stem: string
        }
        Update: {
          answered_at?: string | null
          correct_label?: string
          domain_code?: string
          domain_name?: string
          id?: string
          is_correct?: boolean | null
          options?: Json
          ordinal?: number
          question_id?: string
          selected_label?: string | null
          session_id?: string
          stem?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_items_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          anonymous_owner_hash: string | null
          completed_at: string | null
          created_at: string
          domain_codes: string[]
          exam: string
          expires_at: string
          id: string
          kind: string
          question_count: number
          user_id: string | null
        }
        Insert: {
          anonymous_owner_hash?: string | null
          completed_at?: string | null
          created_at?: string
          domain_codes: string[]
          exam?: string
          expires_at: string
          id?: string
          kind: string
          question_count: number
          user_id?: string | null
        }
        Update: {
          anonymous_owner_hash?: string | null
          completed_at?: string | null
          created_at?: string
          domain_codes?: string[]
          exam?: string
          expires_at?: string
          id?: string
          kind?: string
          question_count?: number
          user_id?: string | null
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string | null
          error: string | null
          id: string
          processed: boolean | null
          processed_at: string | null
          stripe_event_id: string
          type: string
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          id?: string
          processed?: boolean | null
          processed_at?: string | null
          stripe_event_id: string
          type: string
        }
        Update: {
          created_at?: string | null
          error?: string | null
          id?: string
          processed?: boolean | null
          processed_at?: string | null
          stripe_event_id?: string
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      answer_study_item: {
        Args: {
          p_anonymous_owner_hash?: string
          p_item_id: string
          p_selected_label: string
          p_session_id: string
          p_user_id?: string
        }
        Returns: Json
      }
      claim_anonymous_diagnostics: {
        Args: { p_anonymous_owner_hash: string; p_user_id: string }
        Returns: number
      }
      claim_results_email: {
        Args: {
          p_email: string
          p_lease: string
          p_payload: string
          p_session_id: string
        }
        Returns: Json
      }
      consume_free_practice_quota: {
        Args: { p_question_count: number; p_user_id: string }
        Returns: undefined
      }
      create_free_practice_session: {
        Args: { p_expires_at: string; p_items: Json; p_user_id: string }
        Returns: string
      }
      create_study_session: {
        Args: {
          p_anonymous_owner_hash: string
          p_expires_at: string
          p_items: Json
          p_kind: string
          p_user_id: string
        }
        Returns: string
      }
      fulfill_pmle_pass: {
        Args: {
          p_paid_at: string
          p_stripe_checkout_session_id: string
          p_stripe_customer_id: string
          p_stripe_payment_intent_id: string
          p_user_id: string
        }
        Returns: {
          created_at: string
          expires_at: string
          id: string
          paid_at: string
          purchase_completed_at: string | null
          refunded_at: string | null
          stripe_checkout_session_id: string
          stripe_customer_id: string
          stripe_payment_intent_id: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "pmle_passes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      record_pmle_pass_payment: {
        Args: {
          p_amount: number
          p_currency: string
          p_stripe_payment_intent_id: string
        }
        Returns: undefined
      }
      refund_pmle_pass: {
        Args: { p_refunded_at: string; p_stripe_payment_intent_id: string }
        Returns: undefined
      }
      replace_question_tags: {
        Args: { p_question_id: string; p_source: string; p_tags: Json }
        Returns: undefined
      }
      submit_question_report: {
        Args: {
          p_anonymous_owner_hash: string
          p_email: string
          p_item_id: string
          p_kind: string
          p_note: string
          p_reason: string
          p_session_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      v2_consume_free_practice_quota: {
        Args: { p_question_count: number; p_user_id: string }
        Returns: undefined
      }
      v2_create_study_session: {
        Args: {
          p_anonymous_owner_hash: string
          p_expires_at: string
          p_free_only: boolean
          p_items: Json
          p_kind: string
          p_user_id: string
        }
        Returns: string
      }
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

