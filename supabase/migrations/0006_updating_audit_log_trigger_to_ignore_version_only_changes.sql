CREATE OR REPLACE FUNCTION public.handle_audit_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    old_data jsonb;
    new_data jsonb;
    operation TEXT;
    -- Define fields to ignore in comparison (including version and internal flags)
    ignore_keys text[] := ARRAY['updated_at', 'last_updated_by', 'created_at', 'created_by', 'version', 'deleted_by_set', 'deleted_by_setlist'];
BEGIN
    -- Convert OLD/NEW to JSONB, strip metadata and ignored keys
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        old_data := to_jsonb(OLD) - ignore_keys;
    END IF;

    IF TG_OP IN ('UPDATE', 'INSERT') THEN
        new_data := to_jsonb(NEW) - ignore_keys;
    END IF;

    -- Determine operation
    IF TG_OP = 'INSERT' THEN
        operation := 'INSERT';
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
            operation := 'DELETE';
        ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
            operation := 'UNDELETE';
        ELSE
            operation := 'UPDATE';
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        operation := 'DELETE';
    END IF;

    -- Skip no-op updates (where only ignored fields changed)
    IF TG_OP = 'UPDATE' AND old_data = new_data AND operation = 'UPDATE' THEN
        RETURN NULL;
    END IF;

    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        operation,
        old_record,
        new_record,
        changed_by,
        band_id,
        version
    )
    VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        operation,
        old_data,
        new_data,
        auth.uid(),
        NULL,
        COALESCE(NEW.version, OLD.version)
    );

    RETURN NULL;
END;
$function$;