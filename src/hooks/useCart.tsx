import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    barcode_id: string;
    image_url: string | null;
  };
}

interface Cart {
  id: string;
  store_id: string;
  is_active: boolean;
  items: CartItem[];
}

interface CartContextType {
  cart: Cart | null;
  loading: boolean;
  selectedStoreId: string | null;
  totalAmount: number;
  itemCount: number;
  selectStore: (storeId: string) => Promise<void>;
  addToCart: (productId: string) => Promise<{ success: boolean; message: string }>;
  removeFromCart: (cartItemId: string) => Promise<{ success: boolean; message: string }>;
  removeProductFromOtherCarts: (productId: string, currentUserId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  const fetchCart = useCallback(async () => {
    if (!user || role !== 'user') return;

    setLoading(true);
    try {
      // Get active cart
      const { data: cartData, error: cartError } = await supabase
        .from('carts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (cartError && cartError.code !== 'PGRST116') {
        console.error('Error fetching cart:', cartError);
        return;
      }

      if (cartData) {
        setSelectedStoreId(cartData.store_id);

        // Fetch cart items with product details
        const { data: itemsData } = await supabase
          .from('cart_items')
          .select(`
            id,
            product_id,
            quantity,
            product:products (
              id,
              name,
              price,
              barcode_id,
              image_url
            )
          `)
          .eq('cart_id', cartData.id);

        setCart({
          id: cartData.id,
          store_id: cartData.store_id,
          is_active: cartData.is_active,
          items: (itemsData || []).map(item => ({
            ...item,
            product: Array.isArray(item.product) ? item.product[0] : item.product
          })) as CartItem[],
        });
      }
    } catch (error) {
      console.error('Error in fetchCart:', error);
    } finally {
      setLoading(false);
    }
  }, [user, role]);

  const refreshCart = useCallback(async () => {
    await fetchCart();
  }, [fetchCart]);

  useEffect(() => {
    if (user && role === 'user') {
      fetchCart();
    } else {
      setCart(null);
      setSelectedStoreId(null);
    }
  }, [user, role, fetchCart]);

  const selectStore = async (storeId: string) => {
    if (!user) return;

    setLoading(true);
    try {
      // Deactivate existing carts
      await supabase
        .from('carts')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true);

      // Create new cart for selected store
      const { data: newCart, error } = await supabase
        .from('carts')
        .insert({
          user_id: user.id,
          store_id: storeId,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setSelectedStoreId(storeId);
      setCart({
        id: newCart.id,
        store_id: newCart.store_id,
        is_active: true,
        items: [],
      });

      toast.success('Store selected! Start scanning products.');
    } catch (error) {
      console.error('Error selecting store:', error);
      toast.error('Failed to select store');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (productId: string): Promise<{ success: boolean; message: string }> => {
    if (!user || !cart) {
      return { success: false, message: 'Please select a store first' };
    }

    try {
      // First check if product exists and is from the correct store
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (productError || !product) {
        return { success: false, message: 'Product not found' };
      }

      // Check if product is from the selected store
      if (product.store_id !== cart.store_id) {
        return { success: false, message: 'This product is from a different store. Please change your store selection.' };
      }

      // Check if product is already paid
      if (product.is_paid) {
        return { success: false, message: 'This product has already been purchased' };
      }

      // Check if product is already in this cart
      const existingItem = cart.items.find(item => item.product_id === productId);
      if (existingItem) {
        return { success: false, message: 'Product already in your cart' };
      }

      // Add to cart (trigger will remove from other carts)
      const { error: insertError } = await supabase
        .from('cart_items')
        .insert({
          cart_id: cart.id,
          product_id: productId,
          quantity: 1,
        });

      if (insertError) {
        console.error('Insert error:', insertError);
        return { success: false, message: 'Failed to add product to cart' };
      }

      await fetchCart();
      return { success: true, message: 'Product added to cart!' };
    } catch (error) {
      console.error('Error adding to cart:', error);
      return { success: false, message: 'An error occurred' };
    }
  };

  const removeFromCart = async (cartItemId: string): Promise<{ success: boolean; message: string }> => {
    if (!cart) return { success: false, message: 'No active cart' };

    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', cartItemId);

      if (error) throw error;

      await fetchCart();
      return { success: true, message: 'Item removed from cart' };
    } catch (error) {
      console.error('Error removing from cart:', error);
      return { success: false, message: 'Failed to remove item' };
    }
  };

  const removeProductFromOtherCarts = async (productId: string, currentUserId: string) => {
    try {
      // Get all active carts with this product except current user's cart
      const { data: otherCarts, error: cartsError } = await supabase
        .from('carts')
        .select('id, user_id')
        .eq('is_active', true)
        .neq('user_id', currentUserId);

      if (cartsError || !otherCarts) return;

      // Find cart items with this product in other users' carts
      for (const otherCart of otherCarts) {
        const { data: items } = await supabase
          .from('cart_items')
          .select('id')
          .eq('cart_id', otherCart.id)
          .eq('product_id', productId);

        if (items && items.length > 0) {
          // Delete these items
          await supabase
            .from('cart_items')
            .delete()
            .eq('cart_id', otherCart.id)
            .eq('product_id', productId);
        }
      }
    } catch (error) {
      console.error('Error removing product from other carts:', error);
    }
  };

  const clearCart = async () => {
    if (!cart) return;

    try {
      await supabase
        .from('cart_items')
        .delete()
        .eq('cart_id', cart.id);

      await fetchCart();
      toast.success('Cart cleared');
    } catch (error) {
      console.error('Error clearing cart:', error);
      toast.error('Failed to clear cart');
    }
  };

  const totalAmount = cart?.items.reduce((sum, item) => {
    return sum + (item.product?.price || 0) * item.quantity;
  }, 0) || 0;

  const itemCount = cart?.items.length || 0;

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        selectedStoreId,
        totalAmount,
        itemCount,
        selectStore,
        addToCart,
        removeFromCart,
        removeProductFromOtherCarts,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
