-- =====================================================
-- DENTAL CLINIC MANAGEMENT SYSTEM - SCHEMA REFACTORING
-- STEP 1: CLEAN UP ORPHANED DATA
-- =====================================================

-- Delete orphaned records that have no clinic association
DELETE FROM public.service_includes WHERE clinic_id IS NULL;
DELETE FROM public.service_products WHERE clinic_id IS NULL;
DELETE FROM public.services WHERE clinic_id IS NULL;
DELETE FROM public.cities WHERE clinic_id IS NULL;

-- =====================================================
-- STEP 2: ADD NOT NULL CONSTRAINTS FOR CLINIC_ID
-- (Critical for multi-tenancy enforcement)
-- =====================================================

-- Make clinic_id NOT NULL where it should be
ALTER TABLE public.services ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.cities ALTER COLUMN clinic_id SET NOT NULL;

-- =====================================================
-- STEP 3: ADD UNIQUE CONSTRAINTS PER CLINIC
-- =====================================================

-- Ensure unique names per clinic
DROP INDEX IF EXISTS idx_services_name_clinic_unique;
CREATE UNIQUE INDEX idx_services_name_clinic_unique 
  ON public.services(clinic_id, name);

DROP INDEX IF EXISTS idx_cities_name_clinic_unique;
CREATE UNIQUE INDEX idx_cities_name_clinic_unique 
  ON public.cities(clinic_id, name);