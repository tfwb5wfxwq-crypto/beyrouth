-- Migration: Add language column to orders table
-- Purpose: Store user's language preference (fr/en) at order creation time
-- Used by email Edge Functions to send bilingual confirmation emails

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS language VARCHAR(2) NOT NULL DEFAULT 'fr'
  CHECK (language IN ('fr', 'en'));

COMMENT ON COLUMN orders.language IS 'Language preference of the customer at time of order (fr or en)';
