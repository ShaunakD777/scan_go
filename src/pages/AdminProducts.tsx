import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PackageSearch, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ProductRow {
  id: string;
  name: string;
  barcode_id: string;
  rfid_id: string | null;
  price: number;
  is_paid: boolean;
}

export default function AdminProducts() {
  const { user, role, storeId, loading } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [filtered, setFiltered] = useState<ProductRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productToDelete, setProductToDelete] = useState<ProductRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!loading && (!user || role !== 'admin')) {
      navigate('/');
    }
  }, [user, role, loading, navigate]);

  useEffect(() => {
    const fetchProducts = async () => {
      if (!user || role !== 'admin' || !storeId) {
        console.log('Cannot fetch products:', { user: !!user, isAdmin: role === 'admin', storeId });
        setLoadingProducts(false);
        return;
      }
      setLoadingProducts(true);
      console.log('Fetching products for store:', storeId);

      const { data, error } = await supabase
        .from('products')
        .select('id, name, barcode_id, rfid_id, price, is_paid')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Products fetch error:', error);
      } else {
        console.log('Products fetched:', data?.length || 0, 'products');
        if (data) {
          setProducts(data as ProductRow[]);
          setFiltered(data as ProductRow[]);
        }
      }

      setLoadingProducts(false);
    };

    fetchProducts();
  }, [user, role, storeId]);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    if (!term) {
      setFiltered(products);
      return;
    }
    setFiltered(
      products.filter((p) =>
        p.name.toLowerCase().includes(term) ||
        p.barcode_id.toLowerCase().includes(term) ||
        (p.rfid_id && p.rfid_id.toLowerCase().includes(term))
      )
    );
  }, [searchTerm, products]);

  const handleDeleteProduct = async (product: ProductRow) => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id)
        .eq('store_id', storeId);

      if (error) {
        console.error('Delete error:', error);
        toast.error('Failed to delete product');
        setIsDeleting(false);
        return;
      }

      toast.success(`Product "${product.name}" deleted successfully`);
      setProducts(products.filter(p => p.id !== product.id));
      setProductToDelete(null);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('An error occurred while deleting the product');
    } finally {
      setIsDeleting(false);
    }
  };

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
          <PackageSearch className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground text-sm">Manage all products for this store</p>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm font-normal text-muted-foreground">Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, barcode, or RFID..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Products ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingProducts ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No products found. Use the Add Product page to create new items.
            </p>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {filtered.map((product) => (
                <div
                  key={product.id}
                  className="border rounded-xl p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="font-medium truncate">{product.name}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">Barcode: {product.barcode_id}</span>
                      {product.rfid_id && (
                        <span className="font-mono">RFID: {product.rfid_id}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 md:mt-0">
                    <div className="text-right">
                      <p className="font-display font-semibold">₹{product.price.toFixed(2)}</p>
                      <Badge
                        variant={product.is_paid ? 'default' : 'outline'}
                        className={product.is_paid ? 'bg-success text-success-foreground' : ''}
                      >
                        {product.is_paid ? 'Paid' : 'Unpaid'}
                      </Badge>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setProductToDelete(product)}
                      disabled={product.is_paid}
                      title={product.is_paid ? 'Cannot delete paid products' : 'Delete product'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">{productToDelete?.name}</span>? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-muted p-3 rounded-lg text-sm">
            <p className="text-muted-foreground">
              Barcode: <span className="font-mono">{productToDelete?.barcode_id}</span>
            </p>
            <p className="text-muted-foreground">
              Price: <span className="font-semibold">₹{productToDelete?.price.toFixed(2)}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={() => {
                if (productToDelete) {
                  handleDeleteProduct(productToDelete);
                }
              }}
            >
              {isDeleting ? 'Deleting...' : 'Delete Product'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
