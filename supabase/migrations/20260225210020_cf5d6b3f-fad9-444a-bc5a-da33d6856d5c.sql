
-- Fix Security Definer Views - set to SECURITY INVOKER
ALTER VIEW public.v_personal_kpis SET (security_invoker = on);
ALTER VIEW public.v_personal_month_compare SET (security_invoker = on);
