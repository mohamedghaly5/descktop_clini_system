-- =====================================================
-- MULTI-TENANT SAAS MIGRATION
-- =====================================================

-- Step 1: Rename clinic_settings to clinics and add owner_id
ALTER TABLE public.clinic_settings RENAME TO clinics;

-- Add owner_id column to clinics (references auth.users)
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS owner_id UUID;

-- Step 2: Add clinic_id to all data tables
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS clinic_id UUID;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS clinic_id UUID;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS clinic_id UUID;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS clinic_id UUID;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS clinic_id UUID;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS clinic_id UUID;
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS clinic_id UUID;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS clinic_id UUID;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS clinic_id UUID;
ALTER TABLE public.service_products ADD COLUMN IF NOT EXISTS clinic_id UUID;
ALTER TABLE public.service_includes ADD COLUMN IF NOT EXISTS clinic_id UUID;

-- Step 3: Add foreign key constraints
ALTER TABLE public.patients 
  ADD CONSTRAINT fk_patients_clinic 
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.appointments 
  ADD CONSTRAINT fk_appointments_clinic 
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.services 
  ADD CONSTRAINT fk_services_clinic 
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.products 
  ADD CONSTRAINT fk_products_clinic 
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.invoices 
  ADD CONSTRAINT fk_invoices_clinic 
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.doctors 
  ADD CONSTRAINT fk_doctors_clinic 
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.cities 
  ADD CONSTRAINT fk_cities_clinic 
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.accounts 
  ADD CONSTRAINT fk_accounts_clinic 
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.user_roles 
  ADD CONSTRAINT fk_user_roles_clinic 
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.service_products 
  ADD CONSTRAINT fk_service_products_clinic 
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.service_includes 
  ADD CONSTRAINT fk_service_includes_clinic 
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

-- Step 4: Create helper function to get user's clinic_id
CREATE OR REPLACE FUNCTION public.get_user_clinic_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT clinic_id
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Step 5: Create function to check if user belongs to clinic
CREATE OR REPLACE FUNCTION public.user_belongs_to_clinic(_user_id UUID, _clinic_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND clinic_id = _clinic_id
  )
$$;

-- Step 6: Create function to handle new clinic signup (transaction)
CREATE OR REPLACE FUNCTION public.create_clinic_with_owner(
  _user_id UUID,
  _clinic_name TEXT,
  _owner_name TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_clinic_id UUID;
BEGIN
  -- Create the clinic
  INSERT INTO public.clinics (clinic_name, owner_id, owner_name)
  VALUES (_clinic_name, _user_id, _owner_name)
  RETURNING id INTO new_clinic_id;
  
  -- Assign owner role to the user
  INSERT INTO public.user_roles (user_id, role, clinic_id)
  VALUES (_user_id, 'owner', new_clinic_id);
  
  RETURN new_clinic_id;
END;
$$;

-- Step 7: Drop existing RLS policies
DROP POLICY IF EXISTS "Only owner can manage accounts" ON public.accounts;
DROP POLICY IF EXISTS "Owner and doctors can view accounts" ON public.accounts;
DROP POLICY IF EXISTS "Staff can manage appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Anyone can view cities" ON public.cities;
DROP POLICY IF EXISTS "Only owner can manage cities" ON public.cities;
DROP POLICY IF EXISTS "Anyone can view clinic settings" ON public.clinics;
DROP POLICY IF EXISTS "Only owner can update clinic settings" ON public.clinics;
DROP POLICY IF EXISTS "Anyone can view doctors" ON public.doctors;
DROP POLICY IF EXISTS "Only owner can manage doctors" ON public.doctors;
DROP POLICY IF EXISTS "Staff can manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Staff can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Staff can manage patients" ON public.patients;
DROP POLICY IF EXISTS "Staff can view patients" ON public.patients;
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
DROP POLICY IF EXISTS "Only owner can manage products" ON public.products;
DROP POLICY IF EXISTS "Anyone can view services" ON public.services;
DROP POLICY IF EXISTS "Only owner can manage services" ON public.services;
DROP POLICY IF EXISTS "Anyone can view service_products" ON public.service_products;
DROP POLICY IF EXISTS "Only owner can manage service_products" ON public.service_products;
DROP POLICY IF EXISTS "Anyone can view service_includes" ON public.service_includes;
DROP POLICY IF EXISTS "Only owner can manage service_includes" ON public.service_includes;
DROP POLICY IF EXISTS "Only owner can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Step 8: Create new multi-tenant RLS policies

-- CLINICS policies
CREATE POLICY "Users can view their clinic" ON public.clinics
  FOR SELECT USING (user_belongs_to_clinic(auth.uid(), id));

CREATE POLICY "Users can insert clinic on signup" ON public.clinics
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their clinic" ON public.clinics
  FOR UPDATE USING (owner_id = auth.uid());

-- PATIENTS policies
CREATE POLICY "Users can view clinic patients" ON public.patients
  FOR SELECT USING (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Users can manage clinic patients" ON public.patients
  FOR ALL USING (user_belongs_to_clinic(auth.uid(), clinic_id));

-- APPOINTMENTS policies
CREATE POLICY "Users can view clinic appointments" ON public.appointments
  FOR SELECT USING (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Users can manage clinic appointments" ON public.appointments
  FOR ALL USING (user_belongs_to_clinic(auth.uid(), clinic_id));

-- SERVICES policies
CREATE POLICY "Users can view clinic services" ON public.services
  FOR SELECT USING (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Owners can manage clinic services" ON public.services
  FOR ALL USING (
    user_belongs_to_clinic(auth.uid(), clinic_id) 
    AND has_role(auth.uid(), 'owner')
  );

-- PRODUCTS policies
CREATE POLICY "Users can view clinic products" ON public.products
  FOR SELECT USING (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Owners can manage clinic products" ON public.products
  FOR ALL USING (
    user_belongs_to_clinic(auth.uid(), clinic_id) 
    AND has_role(auth.uid(), 'owner')
  );

-- INVOICES policies
CREATE POLICY "Users can view clinic invoices" ON public.invoices
  FOR SELECT USING (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Users can manage clinic invoices" ON public.invoices
  FOR ALL USING (user_belongs_to_clinic(auth.uid(), clinic_id));

-- DOCTORS policies
CREATE POLICY "Users can view clinic doctors" ON public.doctors
  FOR SELECT USING (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Owners can manage clinic doctors" ON public.doctors
  FOR ALL USING (
    user_belongs_to_clinic(auth.uid(), clinic_id) 
    AND has_role(auth.uid(), 'owner')
  );

-- CITIES policies
CREATE POLICY "Users can view clinic cities" ON public.cities
  FOR SELECT USING (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Owners can manage clinic cities" ON public.cities
  FOR ALL USING (
    user_belongs_to_clinic(auth.uid(), clinic_id) 
    AND has_role(auth.uid(), 'owner')
  );

-- ACCOUNTS policies
CREATE POLICY "Owners can manage clinic accounts" ON public.accounts
  FOR ALL USING (
    user_belongs_to_clinic(auth.uid(), clinic_id) 
    AND has_role(auth.uid(), 'owner')
  );

CREATE POLICY "Users can view clinic accounts" ON public.accounts
  FOR SELECT USING (user_belongs_to_clinic(auth.uid(), clinic_id));

-- USER_ROLES policies
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid() OR user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Owners can manage clinic roles" ON public.user_roles
  FOR ALL USING (
    user_belongs_to_clinic(auth.uid(), clinic_id) 
    AND has_role(auth.uid(), 'owner')
  );

CREATE POLICY "Allow role insertion during signup" ON public.user_roles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- SERVICE_PRODUCTS policies
CREATE POLICY "Users can view clinic service_products" ON public.service_products
  FOR SELECT USING (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Owners can manage clinic service_products" ON public.service_products
  FOR ALL USING (
    user_belongs_to_clinic(auth.uid(), clinic_id) 
    AND has_role(auth.uid(), 'owner')
  );

-- SERVICE_INCLUDES policies
CREATE POLICY "Users can view clinic service_includes" ON public.service_includes
  FOR SELECT USING (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Owners can manage clinic service_includes" ON public.service_includes
  FOR ALL USING (
    user_belongs_to_clinic(auth.uid(), clinic_id) 
    AND has_role(auth.uid(), 'owner')
  );

-- Step 9: Update the has_role function to include clinic check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Step 10: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON public.patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_id ON public.appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_services_clinic_id ON public.services(clinic_id);
CREATE INDEX IF NOT EXISTS idx_products_clinic_id ON public.products(clinic_id);
CREATE INDEX IF NOT EXISTS idx_invoices_clinic_id ON public.invoices(clinic_id);
CREATE INDEX IF NOT EXISTS idx_doctors_clinic_id ON public.doctors(clinic_id);
CREATE INDEX IF NOT EXISTS idx_cities_clinic_id ON public.cities(clinic_id);
CREATE INDEX IF NOT EXISTS idx_accounts_clinic_id ON public.accounts(clinic_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_clinic_id ON public.user_roles(clinic_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_clinic ON public.user_roles(user_id, clinic_id);