-- =====================================================
-- PRODUCTION-READY SCHEMA CLEANUP - FINAL
-- =====================================================

-- STEP 1: Delete orphaned user_roles with NULL clinic_id
DELETE FROM public.user_roles WHERE clinic_id IS NULL;

-- STEP 2: Make clinic_id NOT NULL on user_roles
ALTER TABLE public.user_roles ALTER COLUMN clinic_id SET NOT NULL;

-- STEP 3: Add foreign key constraint if missing
ALTER TABLE public.user_roles 
  DROP CONSTRAINT IF EXISTS user_roles_clinic_id_fkey;
ALTER TABLE public.user_roles 
  ADD CONSTRAINT user_roles_clinic_id_fkey 
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

-- STEP 4: Create helper function for owner check
CREATE OR REPLACE FUNCTION public.is_clinic_owner(_user_id uuid, _clinic_id uuid)
RETURNS boolean
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
      AND role = 'owner'
  )
$$;

-- STEP 5: Clean up and recreate RLS policies for user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can manage clinic roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow role insertion during signup" ON public.user_roles;

CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "user_roles_insert_self" ON public.user_roles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_roles_update" ON public.user_roles FOR UPDATE
  USING (is_clinic_owner(auth.uid(), clinic_id));

CREATE POLICY "user_roles_delete" ON public.user_roles FOR DELETE
  USING (is_clinic_owner(auth.uid(), clinic_id));