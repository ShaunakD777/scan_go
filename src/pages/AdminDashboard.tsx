import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LayoutDashboard, Package, History, IndianRupee, Store } from 'lucide-react';

interface StoreInfo {
  id: string;
  name: string;
  address: string | null;
}

export default function AdminDashboard() {
  const { user, role, storeId, loading } = useAuth();
  const navigate = useNavigate();
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [transactionCount, setTransactionCount] = useState<number | null>(null);
  const [recentRevenue, setRecentRevenue] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && (!user || role !== 'admin')) {
      navigate('/');
    }
  }, [user, role, loading, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || role !== 'admin') {
        console.log('Admin check failed:', { user: !!user, role, storeId });
        return;
      }
      
      if (!storeId) {
        console.warn('No storeId found for admin user');
        return;
      }

      console.log('Fetching admin dashboard data for store:', storeId);

      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('id, name, address')
        .eq('id', storeId)
        .single();

      if (storeError) {
        console.error('Store fetch error:', storeError);
      } else {
        if (storeData) {
          setStore(storeData as StoreInfo);
        }
      }

      const { count: productsCount, error: productsError } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId);

      if (productsError) {
        console.error('Products count error:', productsError);
      } else {
        setProductCount(productsCount ?? 0);
      }

      const { data: transactions, error: transError } = await supabase
        .from('transactions')
        .select('id, total_amount, payment_status, created_at')
        .eq('store_id', storeId)
        .eq('payment_status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20);

      if (transError) {
        console.error('Transactions fetch error:', transError);
      } else {
        if (transactions) {
          setTransactionCount(transactions.length);
          const total = transactions.reduce((sum, t) => sum + (t.total_amount || 0), 0);
          setRecentRevenue(total);
        }
      }
    };

    fetchData();
  }, [user, role, storeId]);

  if (loading || !user || role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
          <LayoutDashboard className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Store Dashboard</h1>
          {store && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Store className="w-3 h-3" />
              <span>{store.name}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
              <Package className="w-4 h-4" />
              Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-display font-bold">{productCount ?? '--'}</p>
            <p className="text-xs text-muted-foreground mt-1">Total products in this store</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
              <History className="w-4 h-4" />
              Transactions (recent)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-display font-bold">{transactionCount ?? '--'}</p>
            <p className="text-xs text-muted-foreground mt-1">Last 20 completed payments</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
              <IndianRupee className="w-4 h-4" />
              Revenue (recent)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-display font-bold">
              {recentRevenue != null ? `₹${recentRevenue.toFixed(2)}` : '--'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">From last 20 completed transactions</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="flex-1">
              <Link to="/store/add-product">Add Product</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link to="/store/products">Manage Products</Link>
            </Button>
          </div>
          <Separator className="my-4" />
          <p className="text-xs text-muted-foreground">
            Use the admin scanner on the Add Product page to register new items with barcodes and optional RFID tags.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
