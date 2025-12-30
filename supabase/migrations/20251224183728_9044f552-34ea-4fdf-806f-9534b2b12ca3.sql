-- =====================================================
-- DENTAL CLINIC MANAGEMENT SYSTEM - SCHEMA REFACTORING
-- PART 2: FOREIGN KEYS, NEW TABLES, INDEXES
-- =====================================================

-- =====================================================
-- STEP 1: CREATE MISSING ENUM TYPES
-- =====================================================

DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('pending', 'partial', 'paid', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.gender_type AS ENUM ('male', 'female');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.commission_type AS ENUM ('percentage', 'fixed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM ('income', 'expense');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.treatment_status AS ENUM ('active', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- STEP 2: ADD FOREIGN KEY CONSTRAINTS
-- =====================================================

-- Clinics
ALTER TABLE public.clinics DROP CONSTRAINT IF EXISTS clinics_owner_id_fkey;
ALTER TABLE public.clinics ADD CONSTRAINT clinics_owner_id_fkey 
  FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey 
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- User roles
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_clinic_id_fkey;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_clinic_id_fkey 
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

-- Cities
ALTER TABLE public.cities DROP CONSTRAINT IF EXISTS cities_clinic_id_fkey;
ALTER TABLE public.cities ADD CONSTRAINT cities_clinic_id_fkey 
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

-- Doctors
ALTER TABLE public.doctors DROP CONSTRAINT IF EXISTS doctors_clinic_id_fkey;
ALTER TABLE public.doctors ADD CONSTRAINT doctors_clinic_id_fkey 
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.doctors DROP CONSTRAINT IF EXISTS doctors_user_id_fkey;
ALTER TABLE public.doctors ADD CONSTRAINT doctors_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Patients
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_clinic_id_fkey;
ALTER TABLE public.patients ADD CONSTRAINT patients_clinic_id_fkey 
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_city_id_fkey;
ALTER TABLE public.patients ADD CONSTRAINT patients_city_id_fkey 
  FOREIGN KEY (city_id) REFERENCES public.cities(id) ON DELETE SET NULL;

-- Services
ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_clinic_id_fkey;
ALTER TABLE public.services ADD CONSTRAINT services_clinic_id_fkey 
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

-- Products
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_clinic_id_fkey;
ALTER TABLE public.products ADD CONSTRAINT products_clinic_id_fkey 
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

-- Service Products
ALTER TABLE public.service_products DROP CONSTRAINT IF EXISTS service_products_service_id_fkey;
ALTER TABLE public.service_products ADD CONSTRAINT service_products_service_id_fkey 
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;

ALTER TABLE public.service_products DROP CONSTRAINT IF EXISTS service_products_product_id_fkey;
ALTER TABLE public.service_products ADD CONSTRAINT service_products_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.service_products DROP CONSTRAINT IF EXISTS service_products_clinic_id_fkey;
ALTER TABLE public.service_products ADD CONSTRAINT service_products_clinic_id_fkey 
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

-- Service Includes
ALTER TABLE public.service_includes DROP CONSTRAINT IF EXISTS service_includes_parent_service_id_fkey;
ALTER TABLE public.service_includes ADD CONSTRAINT service_includes_parent_service_id_fkey 
  FOREIGN KEY (parent_service_id) REFERENCES public.services(id) ON DELETE CASCADE;

ALTER TABLE public.service_includes DROP CONSTRAINT IF EXISTS service_includes_included_service_id_fkey;
ALTER TABLE public.service_includes ADD CONSTRAINT service_includes_included_service_id_fkey 
  FOREIGN KEY (included_service_id) REFERENCES public.services(id) ON DELETE CASCADE;

ALTER TABLE public.service_includes DROP CONSTRAINT IF EXISTS service_includes_clinic_id_fkey;
ALTER TABLE public.service_includes ADD CONSTRAINT service_includes_clinic_id_fkey 
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

-- Appointments
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_clinic_id_fkey;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_clinic_id_fkey 
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_patient_id_fkey;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_patient_id_fkey 
  FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_doctor_id_fkey;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_doctor_id_fkey 
  FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE SET NULL;

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_service_id_fkey;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_service_id_fkey 
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;

-- Invoices
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_clinic_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_clinic_id_fkey 
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_patient_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_patient_id_fkey 
  FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_doctor_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_doctor_id_fkey 
  FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE SET NULL;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_service_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_service_id_fkey 
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_appointment_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_appointment_id_fkey 
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;

-- Accounts
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_clinic_id_fkey;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_clinic_id_fkey 
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

-- =====================================================
-- STEP 3: CREATE TREATMENT CASES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.treatment_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  total_paid NUMERIC NOT NULL DEFAULT 0,
  status treatment_status NOT NULL DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.treatment_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view clinic treatment_cases" 
  ON public.treatment_cases FOR SELECT 
  USING (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Users can manage clinic treatment_cases" 
  ON public.treatment_cases FOR ALL 
  USING (user_belongs_to_clinic(auth.uid(), clinic_id));

-- =====================================================
-- STEP 4: CREATE PATIENT ATTACHMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.patient_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  file_url TEXT NOT NULL,
  description TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view clinic attachments" 
  ON public.patient_attachments FOR SELECT 
  USING (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Users can manage clinic attachments" 
  ON public.patient_attachments FOR ALL 
  USING (user_belongs_to_clinic(auth.uid(), clinic_id));

-- =====================================================
-- STEP 5: ADD TREATMENT CASE LINK TO INVOICES
-- =====================================================

ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS treatment_case_id UUID REFERENCES public.treatment_cases(id) ON DELETE SET NULL;

-- =====================================================
-- STEP 6: PERFORMANCE INDEXES
-- =====================================================

-- Multi-tenancy indexes (CRITICAL)
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON public.patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_id ON public.appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_invoices_clinic_id ON public.invoices(clinic_id);
CREATE INDEX IF NOT EXISTS idx_doctors_clinic_id ON public.doctors(clinic_id);
CREATE INDEX IF NOT EXISTS idx_services_clinic_id ON public.services(clinic_id);
CREATE INDEX IF NOT EXISTS idx_products_clinic_id ON public.products(clinic_id);
CREATE INDEX IF NOT EXISTS idx_accounts_clinic_id ON public.accounts(clinic_id);
CREATE INDEX IF NOT EXISTS idx_cities_clinic_id ON public.cities(clinic_id);
CREATE INDEX IF NOT EXISTS idx_treatment_cases_clinic_id ON public.treatment_cases(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patient_attachments_clinic_id ON public.patient_attachments(clinic_id);

-- Date indexes
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_date ON public.appointments(clinic_id, date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_accounts_date ON public.accounts(date);

-- Lookup indexes
CREATE INDEX IF NOT EXISTS idx_patients_phone ON public.patients(phone);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_clinic_id ON public.user_roles(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_patient_id ON public.invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_cases_patient_id ON public.treatment_cases(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_doctors_active ON public.doctors(active);

-- Unique constraints per clinic
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_phone_clinic ON public.patients(clinic_id, phone);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_name_clinic ON public.products(clinic_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_name_clinic ON public.doctors(clinic_id, name);

-- =====================================================
-- STEP 7: UPDATED_AT TRIGGER FOR NEW TABLES
-- =====================================================

DROP TRIGGER IF EXISTS update_treatment_cases_updated_at ON public.treatment_cases;
CREATE TRIGGER update_treatment_cases_updated_at
  BEFORE UPDATE ON public.treatment_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();