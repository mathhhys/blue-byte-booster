ALTER TABLE users
ADD COLUMN avatar_url TEXT;

ALTER TABLE users
ADD CONSTRAINT unique_clerk_id UNIQUE (clerk_id);