-- ============================================================
-- TRIGGER ROBUSTO (Manejo de Errores)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    BEGIN
        -- Intento 1: Insertar con todos los datos
        INSERT INTO public.users (
            id, 
            email, 
            full_name, 
            phone, 
            role
        )
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario Nuevo'),
            NEW.raw_user_meta_data->>'phone',
            (COALESCE(NEW.raw_user_meta_data->>'role', 'cliente'))::role_type
        )
        ON CONFLICT (id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            phone = COALESCE(EXCLUDED.phone, users.phone);
            
    EXCEPTION WHEN unique_violation THEN
        -- Intento 2 (Fallback): Si falla por teléfono duplicado, insertar SIN teléfono
        INSERT INTO public.users (
            id, 
            email, 
            full_name, 
            phone, 
            role
        )
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario Nuevo'),
            NULL, -- Teléfono omitido para permitir registro
            (COALESCE(NEW.raw_user_meta_data->>'role', 'cliente'))::role_type
        )
        ON CONFLICT (id) DO NOTHING;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
