BEGIN;

-- Fix route_type values to match frontend RouteType
-- (first migration had: ecologico, religioso, historico, personalizado)
-- (frontend has:        trilha, expedicao, passeio_barco, outro)
ALTER TABLE public.routes
  DROP CONSTRAINT IF EXISTS routes_route_type_check;
ALTER TABLE public.routes
  ADD CONSTRAINT routes_route_type_check
  CHECK (route_type IN (
    'city_tour', 'trilha', 'expedicao', 'passeio_barco',
    'cultural', 'aventura', 'gastronomico', 'outro'
  ));

-- Add metadata column for frontend fields without dedicated DB columns
-- Stores: client, date, contact, notes, isMultiDay
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';

COMMIT;
