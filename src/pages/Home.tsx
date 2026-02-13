import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Scan, Store, ArrowRight, CheckCircle, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StoreInfo {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  logo_url: string | null;
}

export default function Home() {
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  const { selectStore, selectedStoreId, loading: cartLoading } = useCart();
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    // Redirect based on role
    if (!authLoading && role === 'super_admin') {
      navigate('/admin/dashboard');
      return;
    }

    if (!authLoading && role === 'admin') {
      navigate('/store/dashboard');
      return;
    }

    // Fetch stores for regular users
    const fetchStores = async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, description, address, logo_url')
        .order('name');

      if (!error && data) {
        setStores(data);
      }
      setLoading(false);
    };

    if (user && role === 'user') {
      fetchStores();
    }
  }, [user, role, authLoading, navigate]);

  const handleStoreSelect = async (storeId: string) => {
    await selectStore(storeId);
    navigate('/scan');
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4 pt-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
          <Scan className="w-4 h-4" />
          <span>Self-Checkout Made Simple</span>
        </div>
        <h1 className="font-display text-4xl font-bold">
          Choose Your Store
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Select a store to start scanning products. Your cart will be linked to this store.
        </p>
      </div>

      {/* Store List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stores.length === 0 ? (
          <Card className="glass-card col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Store className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                No stores available yet.<br />
                Please check back later.
              </p>
            </CardContent>
          </Card>
        ) : (
          stores.map((store) => (
            <Card
              key={store.id}
              className={cn(
                "store-card cursor-pointer",
                selectedStoreId === store.id && "selected"
              )}
              onClick={() => handleStoreSelect(store.id)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center">
                      {store.logo_url ? (
                        <img 
                          src={store.logo_url} 
                          alt={store.name}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <Store className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-lg">{store.name}</h3>
                      {store.address && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <MapPin className="w-3 h-3" />
                          <span>{store.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {selectedStoreId === store.id ? (
                    <CheckCircle className="w-6 h-6 text-primary" />
                  ) : (
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                {store.description && (
                  <p className="text-sm text-muted-foreground mt-4 line-clamp-2">
                    {store.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Quick Actions */}
      {selectedStoreId && (
        <div className="fixed bottom-24 left-0 right-0 px-4">
          <Button 
            className="w-full max-w-md mx-auto flex items-center justify-center gap-2 glow-button bg-primary hover:bg-primary/90 h-14 text-lg"
            onClick={() => navigate('/scan')}
          >
            <Scan className="w-5 h-5" />
            Start Scanning
          </Button>
        </div>
      )}
    </div>
  );
}
