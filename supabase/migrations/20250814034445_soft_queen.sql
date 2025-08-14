/*
  # Add Series Status and Admin RPC Function

  1. New Enum
    - `series_status` enum with 'ongoing' and 'completed' values

  2. Table Changes
    - Add `status` column to `series` table with default 'ongoing'

  3. Functions
    - Add `admin_update_series_status` RPC function for updating series status

  4. Security
    - Grant execute permissions to anon and authenticated roles
*/

-- Create series status enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'series_status') THEN
    CREATE TYPE public.series_status AS ENUM ('ongoing', 'completed');
  END IF;
END $$;

-- Add status column to series table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'series' AND column_name = 'status' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.series ADD COLUMN status public.series_status NOT NULL DEFAULT 'ongoing';
  END IF;
END $$;

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_series_status ON public.series (status);

-- Create admin function to update series status
CREATE OR REPLACE FUNCTION public.admin_update_series_status(
  admin_code text,
  p_series_id uuid,
  p_status public.series_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF admin_code <> 'Shivam2008' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.series
  SET status = p_status,
      updated_at = now()
  WHERE id = p_series_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Series not found';
  END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.admin_update_series_status(text, uuid, public.series_status) TO anon, authenticated;