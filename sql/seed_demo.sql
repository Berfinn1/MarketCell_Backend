-- Demo seller + store (re-run safe). Adjust GSM as needed for CodeNight demo.
INSERT INTO stores (id, name, logo_url)
VALUES (
  '00000000-0000-4000-8000-000000000001'::uuid,
  'Demo Satıcı Mağazası',
  NULL
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (gsm, role, store_id)
VALUES (
  '905550000001',
  'seller',
  '00000000-0000-4000-8000-000000000001'::uuid
)
ON CONFLICT (gsm) DO UPDATE
SET role = EXCLUDED.role,
    store_id = EXCLUDED.store_id;
