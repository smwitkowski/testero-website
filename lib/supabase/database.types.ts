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
      certification_sections: {
        Row: {
          certification_id: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          certification_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          certification_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
        ]
      }
      certifications: {
        Row: {
          created_at: string | null
          id: string
          name: string
          provider: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          provider?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          provider?: string | null
        }
        Relationships: []
      }
      options: {
        Row: {
          created_at: string | null
          explanation: string | null
          id: string
          is_correct: boolean | null
          option_text: string
          question_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          explanation?: string | null
          id: string
          is_correct?: boolean | null
          option_text: string
          question_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          explanation?: string | null
          id?: string
          is_correct?: boolean | null
          option_text?: string
          question_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_responses: {
        Row: {
          created_at: string | null
          id: string
          is_correct: boolean | null
          practice_test_id: string | null
          question_id: string
          section_id: string | null
          user_answer: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          practice_test_id?: string | null
          question_id: string
          section_id?: string | null
          user_answer?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          practice_test_id?: string | null
          question_id?: string
          section_id?: string | null
          user_answer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_responses_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "certification_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          certification_id: string | null
          created_at: string | null
          generated_at: string | null
          id: string
          is_active: boolean | null
          question_text: string
          question_type: string
          section_id: string | null
          updated_at: string | null
        }
        Insert: {
          certification_id?: string | null
          created_at?: string | null
          generated_at?: string | null
          id: string
          is_active?: boolean | null
          question_text: string
          question_type: string
          section_id?: string | null
          updated_at?: string | null
        }
        Update: {
          certification_id?: string | null
          created_at?: string | null
          generated_at?: string | null
          id?: string
          is_active?: boolean | null
          question_text?: string
          question_type?: string
          section_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "certification_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      questions_archive: {
        Row: {
          answers: Json
          correct_answer_index: number
          created_at: string | null
          id: string
          question: string
          section: string
          updated_at: string | null
        }
        Insert: {
          answers: Json
          correct_answer_index: number
          created_at?: string | null
          id?: string
          question: string
          section: string
          updated_at?: string | null
        }
        Update: {
          answers?: Json
          correct_answer_index?: number
          created_at?: string | null
          id?: string
          question?: string
          section?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      test_progress: {
        Row: {
          certification_id: string
          current_question_index: number
          id: string
          last_updated: string | null
          practice_test_id: string
          questions: Json
          user_answers: Json
          user_id: string
        }
        Insert: {
          certification_id: string
          current_question_index: number
          id?: string
          last_updated?: string | null
          practice_test_id: string
          questions: Json
          user_answers: Json
          user_id: string
        }
        Update: {
          certification_id?: string
          current_question_index?: number
          id?: string
          last_updated?: string | null
          practice_test_id?: string
          questions?: Json
          user_answers?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_progress_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_statistics"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tests: {
        Row: {
          certification_id: string | null
          completed_at: string | null
          created_at: string | null
          duration: number | null
          id: string
          is_active: boolean | null
          percentage: number | null
          score: number | null
          started_at: string | null
          time_taken: number | null
          total_questions: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          certification_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          duration?: number | null
          id: string
          is_active?: boolean | null
          percentage?: number | null
          score?: number | null
          started_at?: string | null
          time_taken?: number | null
          total_questions?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          certification_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          duration?: number | null
          id?: string
          is_active?: boolean | null
          percentage?: number | null
          score?: number | null
          started_at?: string | null
          time_taken?: number | null
          total_questions?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tests_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_statistics"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_answers: {
        Row: {
          answered_at: string | null
          created_at: string | null
          id: string
          is_correct: boolean | null
          question_id: string | null
          selected_option_id: string | null
          test_id: string | null
          user_id: string | null
        }
        Insert: {
          answered_at?: string | null
          created_at?: string | null
          id: string
          is_correct?: boolean | null
          question_id?: string | null
          selected_option_id?: string | null
          test_id?: string | null
          user_id?: string | null
        }
        Update: {
          answered_at?: string | null
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          question_id?: string | null
          selected_option_id?: string | null
          test_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_answers_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_answers_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_statistics"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_certifications: {
        Row: {
          certification_id: string | null
          created_at: string
          current_status: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          certification_id?: string | null
          created_at?: string
          current_status?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          certification_id?: string | null
          created_at?: string
          current_status?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_certifications_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_certifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_statistics"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_question_practice: {
        Row: {
          certification_id: string | null
          created_at: string | null
          id: string
          is_correct: boolean | null
          practiced_at: string | null
          question_id: string | null
          selected_option_id: string | null
          user_id: string | null
        }
        Insert: {
          certification_id?: string | null
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          practiced_at?: string | null
          question_id?: string | null
          selected_option_id?: string | null
          user_id?: string | null
        }
        Update: {
          certification_id?: string | null
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          practiced_at?: string | null
          question_id?: string | null
          selected_option_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_question_practice_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_question_practice_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_question_practice_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_question_practice_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_statistics"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_question_progress: {
        Row: {
          question_id: string
          seen_at: string | null
          user_id: string
        }
        Insert: {
          question_id: string
          seen_at?: string | null
          user_id: string
        }
        Update: {
          question_id?: string
          seen_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_question_progress_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_archive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_question_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_statistics"
            referencedColumns: ["user_id"]
          },
        ]
      }
      waitlist: {
        Row: {
          created_at: string | null
          email: string
          exam_type: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          exam_type?: string | null
          id?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          exam_type?: string | null
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      user_statistics: {
        Row: {
          average_score: number | null
          certification_id: string | null
          score_over_time: Json | null
          total_questions_taken: number | null
          total_tests_taken: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_certifications_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
