-- ============================================================
-- SCRIPT DE SINCRONIZACIÓN FORZADA (Resolución de Conflictos)
-- ============================================================

DO $$
DECLARE
    r RECORD;
    v_inserted_count INTEGER := 0;
    v_rescued_count INTEGER := 0;
BEGIN
    -- Recorrer todos los usuarios que están en Auth pero faltan en Public
    FOR r IN 
        SELECT * FROM auth.users 
        WHERE id NOT IN (SELECT id FROM public.users)
    LOOP
        BEGIN
            -- Intentar inserción normal
            INSERT INTO public.users (
                id, email, full_name, role, phone, created_at, updated_at
            )
            VALUES (
                r.id, 
                r.email, 
                COALESCE(r.raw_user_meta_data->>'full_name', 'Usuario Recuperado'),
                (COALESCE(r.raw_user_meta_data->>'role', 'cliente'))::role_type,
                r.raw_user_meta_data->>'phone',
                r.created_at,
                r.created_at
            );
            v_inserted_count := v_inserted_count + 1;
            
        EXCEPTION WHEN unique_violation THEN
            -- Si falla (probablemente por teléfono duplicado), insertar SIN teléfono
            RAISE NOTICE 'Conflicto detectado para usuario %. Intentando sin teléfono...', r.email;
            
            INSERT INTO public.users (
                id, email, full_name, role, phone, created_at, updated_at
            )
            VALUES (
                r.id, 
                r.email, 
                COALESCE(r.raw_user_meta_data->>'full_name', 'Usuario Recuperado'),
                (COALESCE(r.raw_user_meta_data->>'role', 'cliente'))::role_type,
                NULL, -- Teléfono NULL para evitar el conflicto
                r.created_at,
                r.created_at
            );
            v_rescued_count := v_rescued_count + 1;
        END;
    END LOOP;
    
    RAISE NOTICE 'Proceso finalizado. Insertados normales: %. Rescatados (sin teléfono): %', v_inserted_count, v_rescued_count;
END $$;
