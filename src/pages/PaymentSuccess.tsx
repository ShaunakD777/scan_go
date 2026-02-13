import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Home, Download, Store, Clock } from 'lucide-react';
import QRCode from 'qrcode';

interface TransactionData {
  id: string;
  user_id: string;
  store_id: string;
  total_amount: number;
  payment_id: string;
  created_at: string;
}

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  const { transaction, productNames, storeName } = location.state as {
    transaction: TransactionData;
    productNames: string[];
    storeName: string;
  } || {};

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }

    if (!transaction) {
      navigate('/');
      return;
    }

    // Generate QR code with transaction data
    const generateQR = async () => {
      const qrData = JSON.stringify({
        transaction_id: transaction.id,
        user_id: transaction.user_id,
        store_id: transaction.store_id,
        payment_id: transaction.payment_id,
        total_amount: transaction.total_amount,
        products: productNames,
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
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    };

    generateQR();
  }, [user, loading, transaction, navigate, productNames]);

  if (loading || !transaction) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const formattedDate = new Date(transaction.created_at).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-6 max-w-md mx-auto">
      {/* Success Animation */}
      <div className="text-center pt-8">
        <div className="success-checkmark mx-auto mb-6">
          <CheckCircle className="w-12 h-12 text-success" />
        </div>
        <h1 className="font-display text-3xl font-bold text-success">Payment Successful!</h1>
        <p className="text-muted-foreground mt-2">Thank you for shopping with us</p>
      </div>

      {/* Receipt Card */}
      <Card className="glass-card overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-accent p-4 text-center">
          <h2 className="font-display text-xl font-bold text-primary-foreground">
            Digital Receipt
          </h2>
        </div>
        <CardContent className="p-6 space-y-4">
          {/* Transaction Info */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-secondary/50 p-3 rounded-lg">
            <div>
              <p className="text-muted-foreground font-medium">Transaction ID</p>
              <p className="font-mono text-xs break-all">{transaction.id}</p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium">Payment ID</p>
              <p className="font-mono text-xs break-all">{transaction.payment_id}</p>
            </div>
          </div>

          {/* Store Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <Store className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">{storeName}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{formattedDate}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Items */}
          <div className="space-y-2">
            <h3 className="font-medium text-sm text-muted-foreground">Items Purchased</h3>
            {productNames.map((name, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm">{name}</span>
                <CheckCircle className="w-4 h-4 text-success" />
              </div>
            ))}
          </div>

          <Separator />

          {/* Pricing Breakdown */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>₹{(transaction.total_amount / 1.02).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GST (2%)</span>
              <span>₹{(transaction.total_amount - transaction.total_amount / 1.02).toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total Paid</span>
              <span className="font-display text-2xl font-bold text-primary">
                ₹{transaction.total_amount.toFixed(2)}
              </span>
            </div>
          </div>

          <Separator />

          {/* QR Code */}
          <div className="text-center space-y-3 bg-secondary/30 p-4 rounded-lg">
            <p className="text-sm font-medium text-foreground">
              Scan QR Code at Exit Gate
            </p>
            {qrCodeUrl ? (
              <img 
                src={qrCodeUrl} 
                alt="Receipt QR Code" 
                className="w-40 h-40 mx-auto border-4 border-white rounded-lg shadow-md" 
              />
            ) : (
              <div className="w-40 h-40 mx-auto skeleton rounded-lg" />
            )}
            <p className="text-xs text-muted-foreground font-medium">
              Keep this receipt with you
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="space-y-3">
        <Button
          variant="outline"
          className="w-full"
          onClick={async () => {
            // Create a canvas-based receipt image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            canvas.width = 400;
            canvas.height = 600;
            
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
            ctx.fillText(formattedDate, canvas.width / 2, yPos);
            
            yPos += 30;
            ctx.textAlign = 'left';
            ctx.font = 'bold 11px Arial';
            ctx.fillText('Items Purchased:', 20, yPos);
            yPos += 15;
            
            ctx.font = '10px Arial';
            productNames.forEach(name => {
              ctx.fillText('• ' + name, 25, yPos);
              yPos += 12;
            });
            
            yPos += 10;
            ctx.font = 'bold 12px Arial';
            ctx.fillText('Subtotal: ₹' + (transaction.total_amount / 1.02).toFixed(2), 20, yPos);
            yPos += 15;
            ctx.fillText('GST (2%): ₹' + (transaction.total_amount - transaction.total_amount / 1.02).toFixed(2), 20, yPos);
            yPos += 15;
            ctx.font = 'bold 14px Arial';
            ctx.fillText('Total: ₹' + transaction.total_amount.toFixed(2), 20, yPos);
            
            yPos += 30;
            ctx.textAlign = 'center';
            ctx.font = '9px Arial';
            ctx.fillText('Transaction ID:', canvas.width / 2, yPos);
            yPos += 12;
            ctx.font = '8px monospace';
            ctx.fillText(transaction.id.substring(0, 20), canvas.width / 2, yPos);
            
            yPos += 20;
            if (qrCodeUrl) {
              const img = new Image();
              img.onload = () => {
                ctx.drawImage(img, (canvas.width - 100) / 2, yPos, 100, 100);
                canvas.toBlob(blob => {
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `receipt-${transaction.payment_id}.png`;
                  link.click();
                  URL.revokeObjectURL(url);
                });
              };
              img.src = qrCodeUrl;
            }
          }}
        >
          <Download className="w-4 h-4 mr-2" />
          Download Receipt
        </Button>
        <Button
          className="w-full glow-button bg-primary hover:bg-primary/90"
          onClick={() => navigate('/')}
        >
          <Home className="w-4 h-4 mr-2" />
          Back to Home
        </Button>
      </div>
    </div>
  );
}
