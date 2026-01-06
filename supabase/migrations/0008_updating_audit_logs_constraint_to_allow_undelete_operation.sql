-- 1. Drop the old constraint
ALTER TABLE public.audit_logs 
DROP CONSTRAINT IF EXISTS audit_logs_operation_check;

-- 2. Add the new constraint including 'UNDELETE'
ALTER TABLE public.audit_logs 
ADD CONSTRAINT audit_logs_operation_check 
CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE', 'UNDELETE', 'REORDER', 'BULK_UPDATE', 'BULK_DELETE'));