-- ============================================================
-- MoVix Seed Data for Testing
-- Description: Minimal test data for Phase 2
-- ============================================================

-- Note: auth.users entries should be created via Supabase Auth
-- These are placeholder UUIDs for testing

-- ============================================================
-- TEST USERS
-- ============================================================

-- 1 Admin
INSERT INTO users (id, email, full_name, role, is_active, is_available) VALUES
    ('00000000-0000-0000-0000-000000000001', 'admin@movix.test', 'Admin MoVix', 'admin', TRUE, FALSE);

-- 1 Cliente
INSERT INTO users (id, email, phone, full_name, role, is_active, is_available) VALUES
    ('00000000-0000-0000-0000-000000000002', 'cliente@test.com', '+52-555-123-4567', 
     'Juan Pérez Cliente', 'cliente', TRUE, FALSE);

-- 1 Taxi Driver
INSERT INTO users (id, email, phone, full_name, role, is_active, is_available, current_lat, current_lng, location_updated_at) VALUES
    ('00000000-0000-0000-0000-000000000003', 'taxi@test.com', '+52-555-234-5678',
     'Carlos González Taxista', 'taxi', TRUE, TRUE, 19.4326077, -99.1332080, NOW());

-- 1 Mandadito Driver
INSERT INTO users (id, email, phone, full_name, role, is_active, is_available, current_lat, current_lng, location_updated_at) VALUES
    ('00000000-0000-0000-0000-000000000004', 'mandadito@test.com', '+52-555-345-6789',
     'María López Mensajera', 'mandadito', TRUE, TRUE, 19.4284706, -99.1276627, NOW());

-- ============================================================
-- TEST SERVICE REQUESTS
-- ============================================================

-- Solicitud Taxi (pending - waiting for offers)
INSERT INTO service_requests (
    id, 
    client_id, 
    service_type, 
    status,
    origin_address, 
    origin_lat, 
    origin_lng,
    destination_address, 
    destination_lat, 
    destination_lng,
    notes, 
    estimated_price
) VALUES (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'taxi', 
    'pending',
    'Av. Insurgentes Sur 1602, Col. Crédito Constructor, CDMX', 
    19.3876, 
    -99.1770,
    'Aeropuerto Internacional Benito Juárez, Terminal 1', 
    19.4361, 
    -99.0719,
    'Vuelo a las 6pm, necesito llegar con tiempo. 2 maletas grandes.', 
    250.00
);

-- Solicitud Mandadito (pending - with multiple stops)
INSERT INTO service_requests (
    id, 
    client_id, 
    service_type, 
    status,
    origin_address, 
    origin_lat, 
    origin_lng,
    notes, 
    estimated_price
) VALUES (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'mandadito', 
    'pending',
    'Calle Roma 55, Col. Roma Norte, CDMX', 
    19.4169, 
    -99.1644,
    'Recoger paquetes de farmacia y entregar documentos en notaría. Urgente.', 
    150.00
);

-- ============================================================
-- TEST REQUEST STOPS (for mandadito request)
-- ============================================================

INSERT INTO request_stops (request_id, stop_order, address, lat, lng, instructions, status) VALUES
    ('10000000-0000-0000-0000-000000000002', 1, 
     'Farmacia del Ahorro, Av. Chapultepec 123, Col. Roma Norte', 
     19.4215, -99.1615,
     'Recoger medicamentos recetados. Preguntar por el pedido a nombre de Juan Pérez.', 
     'pending');

INSERT INTO request_stops (request_id, stop_order, address, lat, lng, instructions, status) VALUES
    ('10000000-0000-0000-0000-000000000002', 2,
     'Notaría 45, Av. Horacio 456, Col. Polanco', 
     19.4328, -99.1921,
     'Entregar sobre con documentos firmados. Pedir acuse de recibo.', 
     'pending');

INSERT INTO request_stops (request_id, stop_order, address, lat, lng, instructions, status) VALUES
    ('10000000-0000-0000-0000-000000000002', 3,
     'Calle Roma 55, Col. Roma Norte, CDMX', 
     19.4169, -99.1644,
     'Punto final: Entregar medicamentos al cliente.', 
     'pending');

-- ============================================================
-- USEFUL QUERIES FOR TESTING
-- ============================================================

/*
-- List all users with roles
SELECT id, email, full_name, role, is_active, is_available FROM users;

-- List pending requests
SELECT id, service_type, status, origin_address, destination_address, estimated_price 
FROM service_requests WHERE status = 'pending';

-- List stops for mandadito request
SELECT stop_order, address, instructions, status 
FROM request_stops 
WHERE request_id = '10000000-0000-0000-0000-000000000002'
ORDER BY stop_order;

-- Test driver assignment (simulating offer acceptance)
SELECT assign_driver_to_request(
    '10000000-0000-0000-0000-000000000001'::UUID, -- request_id
    '00000000-0000-0000-0000-000000000003'::UUID, -- driver_id (taxi)
    'OFFER_ID_HERE'::UUID, -- offer_id
    1 -- expected_version
);

-- Check ledger after completing a service
SELECT * FROM ledger_entries WHERE driver_id = '00000000-0000-0000-0000-000000000003';
*/
