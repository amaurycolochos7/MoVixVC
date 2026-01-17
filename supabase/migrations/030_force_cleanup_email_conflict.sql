-- ============================================================
-- SCRIPT 030: LIMPIEZA PROFUNDA DE CONFLICTOS DE EMAIL
-- ============================================================

DO $$
DECLARE
    r RECORD;
    v_zombie_id UUID;
    v_deleted_count INTEGER := 0;
    v_created_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Iniciando limpieza profunda...';

    -- 1. Recorrer usuarios de Auth que NO estan en Public (los bloqueados)
    FOR r IN 
        SELECT * FROM auth.users 
        WHERE id NOT IN (SELECT id FROM public.users)
    LOOP
        -- 2. Verificar si este email ya esta siendo usado por OTRO usuario en Public (Zombi)
        SELECT id INTO v_zombie_id FROM public.users WHERE email = r.email;
        
        IF v_zombie_id IS NOT NULL THEN
            RAISE NOTICE 'Conflicto de Email detectado! Usuario Zombi: % bloquea a Nuevo Usuario: %', v_zombie_id, r.id;
            
            -- 3. ELIMINAR ZOMBI
            -- Primero intentamos borrar referencias directas si es necesario (limpieza manual si cascade falla)
            DELETE FROM driver_vehicles WHERE user_id = v_zombie_id;
            -- Borrar usuario zombi
            DELETE FROM public.users WHERE id = v_zombie_id;
            
            v_deleted_count := v_deleted_count + 1;
            RAISE NOTICE 'Zombi eliminado.';
        END IF;

        -- 4. INSERTAR USUARIO NUEVO
        BEGIN
            INSERT INTO public.users (
                id, email, full_name, role, phone, created_at, updated_at
            )
            VALUES (
                r.id, 
                r.email, 
                COALESCE(r.raw_user_meta_data->>'full_name', 'Usuario Sincronizado'),
                (COALESCE(r.raw_user_meta_data->>'role', 'cliente'))::role_type,
                r.raw_user_meta_data->>'phone',
                r.created_at,
                r.created_at
            );
            v_created_count := v_created_count + 1;
        EXCEPTION WHEN unique_violation THEN
            -- Si aun falla (por telefono duplicado), intentar sin telefono
            INSERT INTO public.users (
                id, email, full_name, role, phone, created_at, updated_at
            )
            VALUES (
                r.id, 
                r.email, 
                COALESCE(r.raw_user_meta_data->>'full_name', 'Usuario Sincronizado'),
                (COALESCE(r.raw_user_meta_data->>'role', 'cliente'))::role_type,
                NULL, -- TELEFONO NULL
                r.created_at,
                r.created_at
            );
            v_created_count := v_created_count + 1;
            RAISE NOTICE 'Usuario creado sin telefono por conflicto.';
        END;
        
    END LOOP;

    RAISE NOTICE 'Limpieza terminada: % zombis eliminados, % usuarios restaurados.', v_deleted_count, v_created_count;
END $$;
