-- Create app roles enum
CREATE TYPE public.app_role AS ENUM ('owner', 'doctor', 'assistant');

-- Create appointment status enum
CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'confirmed', 'attended', 'cancelled');

-- Create clinic_settings table (single row for global settings)
CREATE TABLE public.clinic_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_name TEXT NOT NULL DEFAULT 'عيادة',
  clinic_logo TEXT,
  owner_name TEXT NOT NULL DEFAULT '',
  whatsapp_number TEXT,
  currency TEXT NOT NULL DEFAULT 'EGP',
  direction TEXT NOT NULL DEFAULT 'rtl',
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table for RBAC
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'assistant',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create cities table
CREATE TABLE public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create patients table
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  gender TEXT,
  age INTEGER,
  city_id UUID REFERENCES public.cities(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create doctors table
CREATE TABLE public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'doctor',
  active BOOLEAN NOT NULL DEFAULT true,
  commission_type TEXT DEFAULT 'percentage',
  commission_value DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create services table
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  time_hours DECIMAL(5,2) NOT NULL DEFAULT 1,
  profit_percent DECIMAL(5,2) NOT NULL DEFAULT 30,
  default_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  cases_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create service_products junction table
CREATE TABLE public.service_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_id, product_id)
);

-- Create service_includes for service composition
CREATE TABLE public.service_includes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
  included_service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_service_id, included_service_id),
  CHECK (parent_service_id != included_service_id)
);

-- Create appointments table
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES public.doctors(id),
  service_id UUID REFERENCES public.services(id),
  date DATE NOT NULL,
  time TIME NOT NULL,
  status appointment_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES public.doctors(id),
  service_id UUID REFERENCES public.services(id),
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create accounts/expenses table
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense',
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  category TEXT,
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default clinic settings
INSERT INTO public.clinic_settings (clinic_name, owner_name, currency, direction)
VALUES ('عيادة دينتا كير', 'د. أحمد', 'EGP', 'rtl');

-- Insert default cities
INSERT INTO public.cities (name) VALUES 
  ('القاهرة'),
  ('الإسكندرية'),
  ('الجيزة'),
  ('الرياض'),
  ('جدة');

-- Insert default services
INSERT INTO public.services (name, default_price, time_hours, profit_percent) VALUES 
  ('تنظيف', 200, 0.5, 30),
  ('حشو', 300, 1, 30),
  ('خلع', 250, 0.5, 30),
  ('علاج جذور', 800, 1.5, 30),
  ('تاج', 1500, 2, 30),
  ('تبييض', 500, 1, 30),
  ('فحص', 100, 0.25, 30),
  ('أشعة', 150, 0.25, 30),
  ('زراعة', 5000, 2, 30),
  ('تقويم', 8000, 1, 30);

-- Enable RLS on all tables
ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_includes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
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

-- Create function to check if user is owner
CREATE OR REPLACE FUNCTION public.is_owner(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'owner')
$$;

-- Create function to check if user has any role
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID)
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
  )
$$;

-- RLS Policies for clinic_settings (everyone can read, only owner can update)
CREATE POLICY "Anyone can view clinic settings" ON public.clinic_settings
  FOR SELECT USING (true);

CREATE POLICY "Only owner can update clinic settings" ON public.clinic_settings
  FOR UPDATE USING (public.is_owner(auth.uid()));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.is_owner(auth.uid()));

CREATE POLICY "Only owner can manage roles" ON public.user_roles
  FOR ALL USING (public.is_owner(auth.uid()));

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for cities (public read, owner can modify)
CREATE POLICY "Anyone can view cities" ON public.cities
  FOR SELECT USING (true);

CREATE POLICY "Only owner can manage cities" ON public.cities
  FOR ALL USING (public.is_owner(auth.uid()));

-- RLS Policies for patients (staff can access)
CREATE POLICY "Staff can view patients" ON public.patients
  FOR SELECT USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff can manage patients" ON public.patients
  FOR ALL USING (public.has_any_role(auth.uid()));

-- RLS Policies for doctors
CREATE POLICY "Anyone can view doctors" ON public.doctors
  FOR SELECT USING (true);

CREATE POLICY "Only owner can manage doctors" ON public.doctors
  FOR ALL USING (public.is_owner(auth.uid()));

-- RLS Policies for services
CREATE POLICY "Anyone can view services" ON public.services
  FOR SELECT USING (true);

CREATE POLICY "Only owner can manage services" ON public.services
  FOR ALL USING (public.is_owner(auth.uid()));

-- RLS Policies for products
CREATE POLICY "Anyone can view products" ON public.products
  FOR SELECT USING (true);

CREATE POLICY "Only owner can manage products" ON public.products
  FOR ALL USING (public.is_owner(auth.uid()));

-- RLS Policies for service_products
CREATE POLICY "Anyone can view service_products" ON public.service_products
  FOR SELECT USING (true);

CREATE POLICY "Only owner can manage service_products" ON public.service_products
  FOR ALL USING (public.is_owner(auth.uid()));

-- RLS Policies for service_includes
CREATE POLICY "Anyone can view service_includes" ON public.service_includes
  FOR SELECT USING (true);

CREATE POLICY "Only owner can manage service_includes" ON public.service_includes
  FOR ALL USING (public.is_owner(auth.uid()));

-- RLS Policies for appointments
CREATE POLICY "Staff can view appointments" ON public.appointments
  FOR SELECT USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff can manage appointments" ON public.appointments
  FOR ALL USING (public.has_any_role(auth.uid()));

-- RLS Policies for invoices
CREATE POLICY "Staff can view invoices" ON public.invoices
  FOR SELECT USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff can manage invoices" ON public.invoices
  FOR ALL USING (public.has_any_role(auth.uid()));

-- RLS Policies for accounts
CREATE POLICY "Owner and doctors can view accounts" ON public.accounts
  FOR SELECT USING (public.is_owner(auth.uid()) OR public.has_role(auth.uid(), 'doctor'));

CREATE POLICY "Only owner can manage accounts" ON public.accounts
  FOR ALL USING (public.is_owner(auth.uid()));

-- Create function to calculate service materials cost
CREATE OR REPLACE FUNCTION public.calculate_service_materials_cost(p_service_id UUID)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_cost DECIMAL(10,2) := 0;
  included_cost DECIMAL(10,2) := 0;
BEGIN
  -- Calculate direct products cost
  SELECT COALESCE(SUM((p.price / NULLIF(p.cases_count, 0)) * sp.quantity), 0)
  INTO total_cost
  FROM public.service_products sp
  JOIN public.products p ON p.id = sp.product_id
  WHERE sp.service_id = p_service_id;
  
  -- Calculate included services materials cost (recursive, but only materials)
  SELECT COALESCE(SUM(public.calculate_service_materials_cost(si.included_service_id)), 0)
  INTO included_cost
  FROM public.service_includes si
  WHERE si.parent_service_id = p_service_id;
  
  RETURN total_cost + included_cost;
END;
$$;

-- Create function to calculate final service price
CREATE OR REPLACE FUNCTION public.calculate_service_price(
  p_service_id UUID,
  p_hourly_cost DECIMAL(10,2) DEFAULT 100
)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  service_record RECORD;
  materials_cost DECIMAL(10,2);
  time_cost DECIMAL(10,2);
  total_cost DECIMAL(10,2);
  final_price DECIMAL(10,2);
BEGIN
  -- Get service details
  SELECT * INTO service_record FROM public.services WHERE id = p_service_id;
  
  IF service_record IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate materials cost
  materials_cost := public.calculate_service_materials_cost(p_service_id);
  
  -- Calculate time cost (only for the main service, not included ones)
  time_cost := service_record.time_hours * p_hourly_cost;
  
  -- Total cost
  total_cost := materials_cost + time_cost;
  
  -- Apply profit margin
  final_price := total_cost * (1 + (service_record.profit_percent / 100));
  
  RETURN ROUND(final_price, 2);
END;
$$;

-- Create trigger function to create invoice on appointment attendance
CREATE OR REPLACE FUNCTION public.handle_appointment_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create invoice when status changes to 'attended'
  IF NEW.status = 'attended' AND (OLD.status IS NULL OR OLD.status != 'attended') THEN
    INSERT INTO public.invoices (
      appointment_id,
      patient_id,
      doctor_id,
      service_id,
      amount,
      status
    )
    SELECT
      NEW.id,
      NEW.patient_id,
      NEW.doctor_id,
      NEW.service_id,
      COALESCE(s.default_price, 0),
      'pending'
    FROM public.services s
    WHERE s.id = NEW.service_id;
    
    -- If no service, still create invoice with 0 amount
    IF NOT FOUND THEN
      INSERT INTO public.invoices (
        appointment_id,
        patient_id,
        doctor_id,
        service_id,
        amount,
        status
      ) VALUES (
        NEW.id,
        NEW.patient_id,
        NEW.doctor_id,
        NEW.service_id,
        0,
        'pending'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for appointment attendance
CREATE TRIGGER on_appointment_attendance
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_appointment_attendance();

-- Create trigger function for profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add updated_at triggers
CREATE TRIGGER update_clinic_settings_updated_at
  BEFORE UPDATE ON public.clinic_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_doctors_updated_at
  BEFORE UPDATE ON public.doctors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_patients_city ON public.patients(city_id);
CREATE INDEX idx_appointments_date ON public.appointments(date);
CREATE INDEX idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX idx_appointments_doctor ON public.appointments(doctor_id);
CREATE INDEX idx_appointments_status ON public.appointments(status);
CREATE INDEX idx_invoices_patient ON public.invoices(patient_id);
CREATE INDEX idx_invoices_appointment ON public.invoices(appointment_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_accounts_date ON public.accounts(date);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- Create view for daily report
CREATE OR REPLACE VIEW public.daily_report AS
SELECT 
  a.date,
  COUNT(DISTINCT a.id) as total_appointments,
  COUNT(DISTINCT CASE WHEN a.status = 'attended' THEN a.id END) as attended_appointments,
  COUNT(DISTINCT CASE WHEN a.status = 'cancelled' THEN a.id END) as cancelled_appointments,
  COUNT(DISTINCT a.patient_id) as unique_patients,
  COALESCE(SUM(i.amount), 0) as total_revenue,
  COALESCE(SUM(i.paid_amount), 0) as total_collected
FROM public.appointments a
LEFT JOIN public.invoices i ON i.appointment_id = a.id
GROUP BY a.date
ORDER BY a.date DESC;

-- Create view for doctor performance
CREATE OR REPLACE VIEW public.doctor_performance AS
SELECT 
  d.id as doctor_id,
  d.name as doctor_name,
  COUNT(DISTINCT a.id) as total_appointments,
  COUNT(DISTINCT CASE WHEN a.status = 'attended' THEN a.id END) as attended_appointments,
  COALESCE(SUM(i.amount), 0) as total_revenue,
  COALESCE(SUM(i.paid_amount), 0) as total_collected,
  COALESCE(SUM(
    CASE 
      WHEN d.commission_type = 'percentage' THEN i.paid_amount * (d.commission_value / 100)
      WHEN d.commission_type = 'fixed' THEN d.commission_value
      ELSE 0
    END
  ), 0) as total_commission
FROM public.doctors d
LEFT JOIN public.appointments a ON a.doctor_id = d.id
LEFT JOIN public.invoices i ON i.appointment_id = a.id
GROUP BY d.id, d.name
ORDER BY total_revenue DESC;