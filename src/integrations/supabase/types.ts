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
      accounts: {
        Row: {
          amount: number
          category: string | null
          clinic_id: string | null
          created_at: string
          date: string
          description: string | null
          id: string
          name: string
          type: string
        }
        Insert: {
          amount?: number
          category?: string | null
          clinic_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          name: string
          type?: string
        }
        Update: {
          amount?: number
          category?: string | null
          clinic_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_accounts_clinic"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          clinic_id: string | null
          created_at: string
          date: string
          doctor_id: string | null
          id: string
          notes: string | null
          patient_id: string
          service_id: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          time: string
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          date: string
          doctor_id?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          service_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          time: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          date?: string
          doctor_id?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          service_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_performance"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_appointments_clinic"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cities_clinic"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          clinic_logo: string | null
          clinic_name: string
          created_at: string
          currency: string
          direction: string
          email: string | null
          id: string
          owner_id: string | null
          owner_name: string
          phone: string | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          clinic_logo?: string | null
          clinic_name?: string
          created_at?: string
          currency?: string
          direction?: string
          email?: string | null
          id?: string
          owner_id?: string | null
          owner_name?: string
          phone?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          clinic_logo?: string | null
          clinic_name?: string
          created_at?: string
          currency?: string
          direction?: string
          email?: string | null
          id?: string
          owner_id?: string | null
          owner_name?: string
          phone?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      doctors: {
        Row: {
          active: boolean
          clinic_id: string | null
          commission_type: string | null
          commission_value: number | null
          created_at: string
          id: string
          name: string
          role: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          clinic_id?: string | null
          commission_type?: string | null
          commission_value?: number | null
          created_at?: string
          id?: string
          name: string
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          clinic_id?: string | null
          commission_type?: string | null
          commission_value?: number | null
          created_at?: string
          id?: string
          name?: string
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctors_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_doctors_clinic"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          appointment_id: string | null
          clinic_id: string | null
          created_at: string
          doctor_id: string | null
          id: string
          notes: string | null
          paid_amount: number
          patient_id: string
          service_id: string | null
          status: string
          treatment_case_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          appointment_id?: string | null
          clinic_id?: string | null
          created_at?: string
          doctor_id?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number
          patient_id: string
          service_id?: string | null
          status?: string
          treatment_case_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          clinic_id?: string | null
          created_at?: string
          doctor_id?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number
          patient_id?: string
          service_id?: string | null
          status?: string
          treatment_case_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoices_clinic"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_performance"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "invoices_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_treatment_case_id_fkey"
            columns: ["treatment_case_id"]
            isOneToOne: false
            referencedRelation: "treatment_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_attachments: {
        Row: {
          clinic_id: string
          created_at: string
          description: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          patient_id: string
          uploaded_by: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          description?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          patient_id: string
          uploaded_by?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          patient_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_attachments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_attachments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          age: number | null
          city_id: string | null
          clinic_id: string | null
          created_at: string
          full_name: string
          gender: string | null
          id: string
          notes: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          age?: number | null
          city_id?: string | null
          clinic_id?: string | null
          created_at?: string
          full_name: string
          gender?: string | null
          id?: string
          notes?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          age?: number | null
          city_id?: string | null
          clinic_id?: string | null
          created_at?: string
          full_name?: string
          gender?: string | null
          id?: string
          notes?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_patients_clinic"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          cases_count: number
          clinic_id: string | null
          created_at: string
          id: string
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          cases_count?: number
          clinic_id?: string | null
          created_at?: string
          id?: string
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          cases_count?: number
          clinic_id?: string | null
          created_at?: string
          id?: string
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_products_clinic"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      service_includes: {
        Row: {
          clinic_id: string | null
          created_at: string
          id: string
          included_service_id: string
          parent_service_id: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          id?: string
          included_service_id: string
          parent_service_id: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          id?: string
          included_service_id?: string
          parent_service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_service_includes_clinic"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_includes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_includes_included_service_id_fkey"
            columns: ["included_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_includes_parent_service_id_fkey"
            columns: ["parent_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_products: {
        Row: {
          clinic_id: string | null
          created_at: string
          id: string
          product_id: string
          quantity: number
          service_id: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          service_id: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_service_products_clinic"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_products_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_products_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          clinic_id: string
          created_at: string
          default_price: number
          id: string
          name: string
          profit_percent: number
          time_hours: number
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          default_price?: number
          id?: string
          name: string
          profit_percent?: number
          time_hours?: number
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          default_price?: number
          id?: string
          name?: string
          profit_percent?: number
          time_hours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_services_clinic"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_cases: {
        Row: {
          clinic_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          doctor_id: string | null
          id: string
          name: string
          patient_id: string
          service_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["treatment_status"]
          total_cost: number
          total_paid: number
          updated_at: string
        }
        Insert: {
          clinic_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          doctor_id?: string | null
          id?: string
          name: string
          patient_id: string
          service_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["treatment_status"]
          total_cost?: number
          total_paid?: number
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          doctor_id?: string | null
          id?: string
          name?: string
          patient_id?: string
          service_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["treatment_status"]
          total_cost?: number
          total_paid?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_cases_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_cases_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_performance"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "treatment_cases_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_cases_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_cases_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_roles_clinic"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      daily_report: {
        Row: {
          attended_appointments: number | null
          cancelled_appointments: number | null
          date: string | null
          total_appointments: number | null
          total_collected: number | null
          total_revenue: number | null
          unique_patients: number | null
        }
        Relationships: []
      }
      doctor_performance: {
        Row: {
          attended_appointments: number | null
          doctor_id: string | null
          doctor_name: string | null
          total_appointments: number | null
          total_collected: number | null
          total_commission: number | null
          total_revenue: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_service_materials_cost: {
        Args: { p_service_id: string }
        Returns: number
      }
      calculate_service_price: {
        Args: { p_hourly_cost?: number; p_service_id: string }
        Returns: number
      }
      create_clinic_with_owner: {
        Args: { _clinic_name: string; _owner_name?: string; _user_id: string }
        Returns: string
      }
      get_user_clinic_id: { Args: { _user_id: string }; Returns: string }
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_clinic_owner: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      user_belongs_to_clinic: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      account_type: "income" | "expense"
      app_role: "owner" | "doctor" | "assistant"
      appointment_status: "scheduled" | "confirmed" | "attended" | "cancelled"
      commission_type: "percentage" | "fixed"
      gender_type: "male" | "female"
      invoice_status: "pending" | "partial" | "paid" | "cancelled"
      treatment_status: "active" | "completed" | "cancelled"
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
      account_type: ["income", "expense"],
      app_role: ["owner", "doctor", "assistant"],
      appointment_status: ["scheduled", "confirmed", "attended", "cancelled"],
      commission_type: ["percentage", "fixed"],
      gender_type: ["male", "female"],
      invoice_status: ["pending", "partial", "paid", "cancelled"],
      treatment_status: ["active", "completed", "cancelled"],
    },
  },
} as const
