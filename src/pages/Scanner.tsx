import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Scan, Camera, ShoppingCart, Check, X, AlertTriangle, Search } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ScannedProduct {
  id: string;
  name: string;
  price: number;
  barcode_id: string;
  image_url: string | null;
}

export default function Scanner() {
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  const { cart, selectedStoreId, addToCart, removeProductFromOtherCarts, itemCount } = useCart();
  const [scanning, setScanning] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null);
  const [scanResult, setScanResult] = useState<'success' | 'error' | 'warning' | null>(null);
  const [resultMessage, setResultMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (!authLoading && role !== 'user') {
      navigate('/');
      return;
    }

    if (!authLoading && !selectedStoreId) {
      toast.error('Please select a store first');
      navigate('/');
    }
  }, [user, role, authLoading, selectedStoreId, navigate]);

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBarcode.trim()) return;
    await processBarcode(manualBarcode.trim());
    setManualBarcode('');
  };

  const processBarcode = async (barcode: string) => {
    if (!selectedStoreId || isProcessing) return;

    setIsProcessing(true);
    setScannedProduct(null);
    setScanResult(null);

    try {
      // Look up product by barcode
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, price, barcode_id, image_url, store_id, is_paid')
        .eq('barcode_id', barcode);

      if (error) throw error;

      if (!products || products.length === 0) {
        setScanResult('error');
        setResultMessage('Product not found. Please try again.');
        return;
      }

      // Check if product is from selected store
      const product = products.find(p => p.store_id === selectedStoreId);
      
      if (!product) {
        setScanResult('warning');
        setResultMessage('This product is from a different store. Please change your store selection.');
        return;
      }

      // Check if product is already paid
      if (product.is_paid) {
        setScanResult('error');
        setResultMessage('This product has already been purchased.');
        return;
      }

      // Check if already in cart
      const isInCart = cart?.items.some(item => item.product_id === product.id);
      if (isInCart) {
        setScanResult('warning');
        setResultMessage('This product is already in your cart.');
        setScannedProduct(product);
        return;
      }

      setScannedProduct(product);
      setScanResult('success');
      setResultMessage('Product found! Add to cart?');
    } catch (error) {
      console.error('Error scanning:', error);
      setScanResult('error');
      setResultMessage('Failed to scan product. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Camera-based barcode scanning using the BarcodeDetector API where available
  useEffect(() => {
    const stopCamera = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };

    if (!scanning) {
      stopCamera();
      return;
    }

    let cancelled = false;

    const startCamera = async () => {
      setCameraError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });

        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        await videoRef.current.play();

        const anyWindow = window as any;
        if (!anyWindow.BarcodeDetector) {
          setCameraError('Barcode scanning is not supported in this browser. Please use manual entry.');
          return;
        }

        const detector = new anyWindow.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'code_128', 'qr_code'],
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const scanFrame = async () => {
          if (cancelled || !videoRef.current || !ctx) return;

          if (videoRef.current.readyState !== 4) {
            frameRef.current = requestAnimationFrame(scanFrame);
            return;
          }

          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

          try {
            const barcodes = await detector.detect(canvas as any);
            if (barcodes.length > 0) {
              const code = barcodes[0].rawValue as string;
              await processBarcode(code);
              setScanning(false);
              return;
            }
          } catch (err) {
            console.error('Barcode detection error:', err);
          }

          frameRef.current = requestAnimationFrame(scanFrame);
        };

        frameRef.current = requestAnimationFrame(scanFrame);
      } catch (err) {
        console.error('Camera error:', err);
        setCameraError('Could not access camera. Please allow camera permissions in your browser.');
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [scanning]);

  const handleAddToCart = async () => {
    if (!scannedProduct || !user) return;

    setIsProcessing(true);
    const result = await addToCart(scannedProduct.id);
    
    if (result.success) {
      // Remove this product from other users' carts
      try {
        await removeProductFromOtherCarts(scannedProduct.id, user.id);
      } catch (error) {
        console.error('Error syncing carts:', error);
      }
      
      toast.success(result.message);
      setScanResult(null);
      setScannedProduct(null);
    } else {
      toast.error(result.message);
    }
    setIsProcessing(false);
  };

  const handleDismiss = () => {
    setScannedProduct(null);
    setScanResult(null);
    setResultMessage('');
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="font-display text-2xl font-bold">Scan Products</h1>
        <p className="text-muted-foreground">
          Scan barcodes or enter them manually
        </p>
      </div>

      {/* Scanner Area */}
      <Card className="glass-card overflow-hidden">
        <CardContent className="p-0">
          <div className="relative aspect-[4/3] bg-secondary/50 flex items-center justify-center">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />

            <div className="relative z-10 text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                <Camera className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">Camera Scanner</p>
                <p className="text-sm text-muted-foreground">
                  Use your phone camera to scan the product barcode
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setScanning(!scanning)}
                className="border-primary text-primary hover:bg-primary/10"
              >
                {scanning ? 'Stop Scanning' : 'Start Camera Scan'}
              </Button>
              {cameraError && (
                <p className="text-xs text-destructive max-w-xs mx-auto">
                  {cameraError}
                </p>
              )}
            </div>

            {/* Scanning overlay animation */}
            {scanning && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="scanner-overlay absolute inset-0" />
                <div className="absolute inset-4 border-2 border-primary/50 rounded-lg" />
                <div
                  className="pulse-ring"
                  style={{
                    top: '50%',
                    left: '50%',
                    width: '100px',
                    height: '100px',
                    marginTop: '-50px',
                    marginLeft: '-50px',
                  }}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Manual Entry */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <form onSubmit={handleManualSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Enter barcode manually..."
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" disabled={isProcessing}>
              <Scan className="w-4 h-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Scan Result */}
      {scanResult && (
        <Card className={cn(
          "glass-card border-2 animate-scale-in",
          scanResult === 'success' && "border-success",
          scanResult === 'error' && "border-destructive",
          scanResult === 'warning' && "border-warning"
        )}>
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                scanResult === 'success' && "bg-success/20",
                scanResult === 'error' && "bg-destructive/20",
                scanResult === 'warning' && "bg-warning/20"
              )}>
                {scanResult === 'success' && <Check className="w-6 h-6 text-success" />}
                {scanResult === 'error' && <X className="w-6 h-6 text-destructive" />}
                {scanResult === 'warning' && <AlertTriangle className="w-6 h-6 text-warning" />}
              </div>

              <div className="flex-1 min-w-0">
                {scannedProduct ? (
                  <>
                    <h3 className="font-semibold text-lg truncate">{scannedProduct.name}</h3>
                    <p className="text-2xl font-display font-bold text-primary mt-1">
                      ₹{scannedProduct.price.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Barcode: {scannedProduct.barcode_id}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">{resultMessage}</p>
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleDismiss}
                className="flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {scannedProduct && scanResult === 'success' && (
              <div className="flex gap-2 mt-4">
                <Button
                  className="flex-1 glow-button bg-primary hover:bg-primary/90"
                  onClick={handleAddToCart}
                  disabled={isProcessing}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Add to Cart
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDismiss}
                >
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cart Preview */}
      {itemCount > 0 && (
        <Button
          className="w-full h-14 text-lg"
          variant="secondary"
          onClick={() => navigate('/cart')}
        >
          <ShoppingCart className="w-5 h-5 mr-2" />
          View Cart ({itemCount} items)
        </Button>
      )}
    </div>
  );
}
