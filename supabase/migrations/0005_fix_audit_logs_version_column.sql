-- Fix: Add 'version' column to audit_logs
-- The audit triggers (handle_audit_log, etc.) attempt to insert into this column.
ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS version bigint;