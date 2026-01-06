-- Add Soft Delete columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- Enhance banned_users table
ALTER TABLE public.banned_users 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id), -- Link to auth user directly
ADD COLUMN IF NOT EXISTS unbanned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS unbanned_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS unbanned_reason TEXT;

-- Create app_statuses table if it doesn't exist (based on prompt)
CREATE TABLE IF NOT EXISTS public.app_statuses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform TEXT NOT NULL CHECK (platform IN ('any', 'android', 'ios')),
    environment TEXT NOT NULL CHECK (environment IN ('production', 'staging', 'development')),
    is_maintenance BOOLEAN DEFAULT false NOT NULL,
    maintenance_message TEXT,
    maintenance_started_at TIMESTAMP WITH TIME ZONE,
    maintenance_expected_end_at TIMESTAMP WITH TIME ZONE,
    requires_update BOOLEAN DEFAULT false NOT NULL,
    min_version_code INTEGER,
    min_version_name TEXT,
    update_url_android TEXT,
    update_url_ios TEXT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT app_statuses_singleton UNIQUE (platform, environment)
);

-- Enable RLS on app_statuses
ALTER TABLE public.app_statuses ENABLE ROW LEVEL SECURITY;

-- Policies for app_statuses (as requested)
DROP POLICY IF EXISTS "Public read access" ON public.app_statuses;
CREATE POLICY "Public read access" ON public.app_statuses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin write access" ON public.app_statuses;
CREATE POLICY "Admin write access" ON public.app_statuses FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Trigger for audit logs on app_statuses
DROP TRIGGER IF EXISTS audit_app_statuses_changes ON public.app_statuses;
CREATE TRIGGER audit_app_statuses_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.app_statuses
    FOR EACH ROW EXECUTE FUNCTION public.handle_audit_log();