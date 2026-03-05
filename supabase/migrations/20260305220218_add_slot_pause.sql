-- Ajouter le paramètre de pause des créneaux
INSERT INTO public.settings (key, value) VALUES
  ('next_slot_available_at', '')
ON CONFLICT (key) DO NOTHING;
