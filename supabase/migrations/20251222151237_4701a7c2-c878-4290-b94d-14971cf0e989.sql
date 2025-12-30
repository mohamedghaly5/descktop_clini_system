-- Fix views to use security_invoker=on
DROP VIEW IF EXISTS public.daily_report;
CREATE VIEW public.daily_report 
WITH (security_invoker=on)
AS
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

DROP VIEW IF EXISTS public.doctor_performance;
CREATE VIEW public.doctor_performance 
WITH (security_invoker=on)
AS
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