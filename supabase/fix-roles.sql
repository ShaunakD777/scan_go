-- Manual script to check and fix missing user roles
-- Run this in Supabase SQL Editor if users are missing roles

-- Check existing users without roles
SELECT 
  au.id,
  au.email,
  ur.role
FROM auth.users au
LEFT JOIN public.user_roles ur ON au.id = ur.user_id
WHERE ur.role IS NULL;

-- For the admin user with store_id, update their role to admin
-- Replace 'USER_ID_HERE' with the actual user ID from above query
UPDATE public.user_roles 
SET role = 'admin' 
WHERE user_id = 'USER_ID_HERE' AND role = 'user';

-- Or insert admin role if it doesn't exist
INSERT INTO public.user_roles (user_id, role)
VALUES ('USER_ID_HERE', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
