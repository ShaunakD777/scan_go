-- Add INSERT policy for user_roles table to allow users to insert their own role
-- This is needed for the signup flow to work properly

CREATE POLICY "Users can insert own role" ON public.user_roles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Also ensure there's a default role assignment on user creation
-- by creating an auth trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile with data from auth metadata or defaults
  INSERT INTO public.profiles (user_id, full_name, email, phone)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', EXCLUDED.full_name),
    phone = COALESCE(NEW.raw_user_meta_data->>'phone', EXCLUDED.phone);
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


