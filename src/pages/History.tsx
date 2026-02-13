import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  History as HistoryIcon, 
  Store, 
  Clock, 
  Package, 
  ChevronRight,
  ShoppingBag,
  Download,
  X
} from 'lucide-react';
import QRCode from 'qrcode';

interface Transaction {
  id: string;
  store_id: string;
  product_names: string[];
  total_amount: number;
  payment_id: string;
  payment_status: string;
  created_at: string;
  store?: {
    name: string;
  };
}

export default function History() {
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [storeName, setStoreName] = useState('');
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [formattedDate, setFormattedDate] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (!authLoading && role !== 'user') {
      navigate('/');
      return;
    }

    const fetchTransactions = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          store_id,
          product_names,
          total_amount,
          payment_id,
          payment_status,
          created_at,
          store:stores (name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setTransactions(data.map(t => ({
          ...t,
          store: Array.isArray(t.store) ? t.store[0] : t.store
        })));
      }
      setLoading(false);
    };

    if (user) {
      fetchTransactions();
    }
  }, [user, role, authLoading, navigate]);

  const handleViewReceipt = async (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowReceiptDialog(true);

    // Generate QR code
    const qrData = JSON.stringify({
      transaction_id: transaction.id,
      payment_id: transaction.payment_id,
      total_amount: transaction.total_amount,
      products: transaction.product_names,
      timestamp: transaction.created_at,
    });

    try {
      const url = await QRCode.toDataURL(qrData, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrCodeUrl(url);
      setStoreName(transaction.store?.name || 'Unknown Store');
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!selectedTransaction) return;

    // Create a canvas-based receipt image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 400;
    canvas.height = 700;

    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Black border
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    ctx.fillStyle = 'black';
    ctx.font = 'bold 16px Arial';
    let yPos = 30;
    ctx.textAlign = 'center';
    ctx.fillText('RECEIPT', canvas.width / 2, yPos);

    yPos += 30;
    ctx.font = '12px Arial';
    ctx.fillText(storeName, canvas.width / 2, yPos);
    yPos += 20;

    const formattedDate = new Date(selectedTransaction.created_at).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    ctx.fillText(formattedDate, canvas.width / 2, yPos);

    yPos += 30;
    ctx.textAlign = 'left';
    ctx.font = 'bold 11px Arial';
    ctx.fillText('Items Purchased:', 20, yPos);
    yPos += 15;

    ctx.font = '10px Arial';
    selectedTransaction.product_names.forEach(name => {
      ctx.fillText('• ' + name, 25, yPos);
      yPos += 12;
    });

    yPos += 10;
    ctx.font = 'bold 12px Arial';
    ctx.fillText('Subtotal: ₹' + (selectedTransaction.total_amount / 1.02).toFixed(2), 20, yPos);
    yPos += 15;
    ctx.fillText('GST (2%): ₹' + (selectedTransaction.total_amount - selectedTransaction.total_amount / 1.02).toFixed(2), 20, yPos);
    yPos += 15;
    ctx.font = 'bold 14px Arial';
    ctx.fillText('Total: ₹' + selectedTransaction.total_amount.toFixed(2), 20, yPos);

    yPos += 30;
    ctx.textAlign = 'center';
    ctx.font = '9px Arial';
    ctx.fillText('Transaction ID:', canvas.width / 2, yPos);
    yPos += 12;
    ctx.font = '8px monospace';
    ctx.fillText(selectedTransaction.id.substring(0, 20), canvas.width / 2, yPos);

    yPos += 20;
    if (qrCodeUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, (canvas.width - 100) / 2, yPos, 100, 100);
        canvas.toBlob(blob => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `receipt-${selectedTransaction.payment_id}.png`;
          link.click();
          URL.revokeObjectURL(url);
        });
      };
      img.src = qrCodeUrl;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
          <HistoryIcon className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Purchase History</h1>
          <p className="text-muted-foreground text-sm">
            {transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}
          </p>
        </div>
      </div>

      {/* Transactions List */}
      {transactions.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingBag className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="font-display text-xl font-semibold mb-2">No purchases yet</h3>
            <p className="text-muted-foreground text-center mb-6">
              Start shopping to see your purchase history
            </p>
            <Button onClick={() => navigate('/')}>
              Start Shopping
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {transactions.map((transaction) => (
            <Card 
              key={transaction.id} 
              className="glass-card cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => handleViewReceipt(transaction)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    {/* Store Name */}
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-primary" />
                      <span className="font-semibold">{transaction.store?.name || 'Unknown Store'}</span>
                    </div>

                    {/* Date */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(transaction.created_at)}</span>
                    </div>

                    {/* Items */}
                    <div className="flex items-start gap-2 text-sm">
                      <Package className="w-3 h-3 mt-1 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-muted-foreground line-clamp-2">
                          {transaction.product_names.join(', ')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {transaction.product_names.length} {transaction.product_names.length === 1 ? 'item' : 'items'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      <p className="font-display font-bold text-lg text-primary">
                        ₹{transaction.total_amount.toFixed(2)}
                      </p>
                      <span className="text-xs px-2 py-1 rounded-full bg-success/20 text-success">
                        Paid
                      </span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewReceipt(transaction);
                      }}
                    >
                      View Receipt
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Receipt Dialog */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Receipt Details</DialogTitle>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4">
              {/* Transaction Info */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-secondary/50 p-3 rounded-lg">
                <div>
                  <p className="text-muted-foreground font-medium">Transaction ID</p>
                  <p className="font-mono text-xs break-all">{selectedTransaction.id.substring(0, 12)}...</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium">Payment ID</p>
                  <p className="font-mono text-xs break-all">{selectedTransaction.payment_id.substring(0, 12)}...</p>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-muted-foreground">Items Purchased</h3>
                {selectedTransaction.product_names.map((name, index) => (
                  <p key={index} className="text-sm">• {name}</p>
                ))}
              </div>

              <Separator />

              {/* Pricing Breakdown */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{(selectedTransaction.total_amount / 1.02).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GST (2%)</span>
                  <span>₹{(selectedTransaction.total_amount - selectedTransaction.total_amount / 1.02).toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total Paid</span>
                  <span className="font-display text-lg font-bold text-primary">
                    ₹{selectedTransaction.total_amount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* QR Code */}
              {qrCodeUrl && (
                <div className="text-center space-y-2">
                  <img 
                    src={qrCodeUrl} 
                    alt="Receipt QR Code" 
                    className="w-40 h-40 mx-auto border-4 border-white rounded-lg shadow-md" 
                  />
                  <p className="text-xs text-muted-foreground">Scan QR Code at Exit Gate</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => setShowReceiptDialog(false)}
            >
              Close
            </Button>
            <Button 
              className="flex-1"
              onClick={handleDownloadReceipt}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
