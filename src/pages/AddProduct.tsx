import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Camera, PackagePlus } from 'lucide-react';
import { toast } from 'sonner';

export default function AddProduct() {
  const { user, role, storeId, loading } = useAuth();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [barcodeId, setBarcodeId] = useState('');
  const [productCode, setProductCode] = useState(`PRD-${Date.now()}`);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [rfidId, setRfidId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!loading && (!user || role !== 'admin')) {
      navigate('/');
    }
  }, [user, role, loading, navigate]);

  // Camera-based barcode scanning for admin product creation
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
          setCameraError('Barcode scanning is not supported in this browser.');
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
              setBarcodeId(code);
              setScanning(false);
              return;
            }
          } catch (err) {
            console.error('Barcode detection error', err);
          }

          frameRef.current = requestAnimationFrame(scanFrame);
        };

        frameRef.current = requestAnimationFrame(scanFrame);
      } catch (err) {
        console.error('Camera error', err);
        setCameraError('Could not access camera. Please allow camera permissions in your browser.');
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [scanning]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !storeId) return;

    if (!name.trim() || !price.trim() || !barcodeId.trim()) {
      toast.error('Name, price, and barcode are required');
      return;
    }

    const parsedPrice = parseFloat(price);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error('Please enter a valid price');
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .insert({
          name: name.trim(),
          price: parsedPrice,
          barcode_id: barcodeId.trim(),
          product_code: productCode.trim() || `PRD-${Date.now()}`,
          description: description.trim() || null,
          image_url: imageUrl.trim() || null,
          rfid_id: rfidId.trim() || null,
          store_id: storeId,
        })
        .select()
        .single();

      if (error) {
        if ((error as any).code === '23505') {
          toast.error('A product with this barcode already exists for this store');
        } else {
          console.error('Error creating product:', error);
          toast.error('Failed to create product');
        }
        return;
      }

      toast.success('Product created');
      setName('');
      setPrice('');
      setBarcodeId('');
      setDescription('');
      setImageUrl('');
      setRfidId('');
      setProductCode(`PRD-${Date.now()}`);

      if (data) {
        navigate('/store/products');
      }
    } finally {
      setIsSaving(false);
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
          <PackagePlus className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Add Product</h1>
          <p className="text-muted-foreground text-sm">
            Register new products with barcode and optional RFID tag
          </p>
        </div>
      </div>

      <Card className="glass-card overflow-hidden">
        <CardHeader>
          <CardTitle>Admin Scanner</CardTitle>
        </CardHeader>
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
                <p className="font-medium">Barcode Scanner</p>
                <p className="text-sm text-muted-foreground">
                  Use your phone camera to scan the product barcode
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setScanning((prev) => !prev)}
                className="border-primary text-primary hover:bg-primary/10"
              >
                {scanning ? 'Stop Camera' : 'Start Camera Scan'}
              </Button>
              {cameraError && (
                <p className="text-xs text-destructive max-w-xs mx-auto">
                  {cameraError}
                </p>
              )}
            </div>

            {scanning && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="scanner-overlay absolute inset-0" />
                <div className="absolute inset-4 border-2 border-primary/50 rounded-lg" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Organic Apple Juice 1L"
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="price">Price (INR)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 199.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="barcode">Barcode ID</Label>
                <Input
                  id="barcode"
                  value={barcodeId}
                  onChange={(e) => setBarcodeId(e.target.value)}
                  placeholder="Scan or type barcode"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-code">Product Code</Label>
                <Input
                  id="product-code"
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  placeholder="Internal code (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rfid">RFID Tag ID (optional)</Label>
                <Input
                  id="rfid"
                  value={rfidId}
                  onChange={(e) => setRfidId(e.target.value)}
                  placeholder="RFID serial if available"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="image-url">Image URL (optional)</Label>
              <Input
                id="image-url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description that customers will see"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Product'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
