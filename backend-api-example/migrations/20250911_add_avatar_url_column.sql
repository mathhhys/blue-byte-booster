-- Add avatar_url column to users table for Clerk integration
ALTER TABLE public.users ADD COLUMN avatar_url text NULL;

-- Add index for better performance if needed
CREATE INDEX IF NOT EXISTS idx_users_avatar_url ON public.users USING btree (avatar_url) TABLESPACE pg_default;