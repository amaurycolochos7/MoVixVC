-- ============================================================
-- SCRIPT DE REPARACIÓN Y SINCRONIZACIÓN DE USUARIOS
-- ============================================================

-- 1. Limpiar usuarios huérfanos en public.users (que no existen en auth)
-- Esto elimina datos residuales que causan conflictos de Email/Teléfono
DELETE FROM public.users 
WHERE id NOT IN (SELECT id FROM auth.users);

-- 2. Sincronizar usuarios faltantes (Existen en Auth pero no en Public)
-- Esto repara el usuario que acabas de crear y falló
INSERT INTO public.users (
    id, 
    email, 
    full_name, 
    phone, 
    role,
    created_at,
    updated_at
)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', 'Usuario Recuperado'),
    raw_user_meta_data->>'phone',
    COALESCE((raw_user_meta_data->>'role')::role_type, 'cliente'),
    created_at,
    COALESCE(last_sign_in_at, created_at)
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;

-- 3. Confirmar reparación
DO $$
DECLARE
    v_missing_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_missing_count
    FROM auth.users a
    LEFT JOIN public.users p ON a.id = p.id
    WHERE p.id IS NULL;
    
    IF v_missing_count > 0 THEN
        RAISE NOTICE 'Aún hay % usuarios desincronizados', v_missing_count;
    ELSE
        RAISE NOTICE 'Sincronización completada exitosamente';
    END IF;
END $$;
