-- =============================================
-- SCAN & GO - COMPLETE DATABASE SCHEMA
-- =============================================

-- 1. Create user role enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'user');

-- 2. User Roles Table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    UNIQUE (user_id, role)
);

-- 3. Profiles Table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Stores Table
CREATE TABLE public.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    logo_url TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Products Table
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_code TEXT NOT NULL,
    barcode_id TEXT NOT NULL,
    rfid_id TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    image_url TEXT,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    is_paid BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(barcode_id, store_id)
);

-- 6. Carts Table
CREATE TABLE public.carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Cart Items Table
CREATE TABLE public.cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID REFERENCES public.carts(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(cart_id, product_id)
);

-- 8. Transactions Table
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL NOT NULL,
    cart_id UUID REFERENCES public.carts(id) ON DELETE SET NULL,
    product_ids UUID[] NOT NULL,
    product_names TEXT[] NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_id TEXT,
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- SECURITY DEFINER HELPER FUNCTIONS
-- =============================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin')
$$;

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Check if user is admin of a specific store
CREATE OR REPLACE FUNCTION public.is_store_admin(_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = _store_id AND admin_id = auth.uid()
  )
$$;

-- Check if product can be added to cart (not paid, from correct store)
CREATE OR REPLACE FUNCTION public.can_add_product_to_cart(_product_id UUID, _store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.products
    WHERE id = _product_id 
    AND store_id = _store_id 
    AND is_paid = false
  )
$$;

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- User Roles Policies
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Super admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.is_super_admin());

-- Profiles Policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_super_admin());

-- Stores Policies
CREATE POLICY "Anyone authenticated can view stores" ON public.stores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins can manage stores" ON public.stores
  FOR ALL USING (public.is_super_admin());

CREATE POLICY "Store admins can update their store" ON public.stores
  FOR UPDATE USING (admin_id = auth.uid());

-- Products Policies
CREATE POLICY "Authenticated users can view products" ON public.products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Store admins can manage their products" ON public.products
  FOR ALL USING (public.is_store_admin(store_id));

CREATE POLICY "Super admins can manage all products" ON public.products
  FOR ALL USING (public.is_super_admin());

-- Carts Policies
CREATE POLICY "Users can view own carts" ON public.carts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own carts" ON public.carts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own carts" ON public.carts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own carts" ON public.carts
  FOR DELETE USING (auth.uid() = user_id);

-- Cart Items Policies
CREATE POLICY "Users can view own cart items" ON public.cart_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.carts 
      WHERE carts.id = cart_items.cart_id 
      AND carts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add to own cart" ON public.cart_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.carts 
      WHERE carts.id = cart_items.cart_id 
      AND carts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own cart items" ON public.cart_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.carts 
      WHERE carts.id = cart_items.cart_id 
      AND carts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove from own cart" ON public.cart_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.carts 
      WHERE carts.id = cart_items.cart_id 
      AND carts.user_id = auth.uid()
    )
  );

-- Transactions Policies
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Store admins can view store transactions" ON public.transactions
  FOR SELECT USING (public.is_store_admin(store_id));

CREATE POLICY "Super admins can view all transactions" ON public.transactions
  FOR SELECT USING (public.is_super_admin());

CREATE POLICY "Users can create own transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================
-- TRIGGERS
-- =============================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_carts_updated_at
  BEFORE UPDATE ON public.carts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- CREATE SUPER ADMIN FUNCTION (for edge function use)
-- =============================================
CREATE OR REPLACE FUNCTION public.assign_role_to_user(_user_id UUID, _role app_role)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Function to remove product from other carts when added to new cart
CREATE OR REPLACE FUNCTION public.remove_product_from_other_carts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove this product from all other carts
  DELETE FROM public.cart_items
  WHERE product_id = NEW.product_id
  AND cart_id != NEW.cart_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER remove_product_from_other_carts_trigger
  AFTER INSERT ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.remove_product_from_other_carts();

-- =============================================
-- INSERT PREDEFINED SUPER ADMIN
-- This will be done via edge function on first signup
-- =============================================