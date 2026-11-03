-- Alinea geocerca Challhuahuacho con cliente (radio 300 m + coords canónicas).
-- Ejecutar en Supabase → SQL Editor tras calibrar en campo (opcional: reemplazar lat/lon).

UPDATE public.branches
SET
  latitud = -14.1166670,
  longitud = -72.2450000,
  radio_geocerca_metros = 300,
  updated_at = NOW()
WHERE id = 'challhuahuacho';

-- Tras "Anclar oficina aquí", pegue sus coords reales, por ejemplo:
-- UPDATE public.branches
-- SET latitud = -14.XXXXXXX, longitud = -72.XXXXXXX, radio_geocerca_metros = 200
-- WHERE id = 'challhuahuacho';

SELECT id, latitud, longitud, radio_geocerca_metros
FROM public.branches
WHERE id = 'challhuahuacho';
