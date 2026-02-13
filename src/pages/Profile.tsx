import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Store, User, Phone } from 'lucide-react';
import { toast } from 'sonner';

interface StoreInfo {
  id: string;
  name: string;
}

export default function Profile() {
  const { user, profile, role, storeId, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [store, setStore] = useState<StoreInfo | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setPhone(profile.phone ?? '');
    }
  }, [profile]);

  useEffect(() => {
    const fetchStore = async () => {
      if (role === 'admin' && storeId) {
        const { data } = await supabase
          .from('stores')
          .select('id, name')
          .eq('id', storeId)
          .single();
        if (data) {
          setStore(data as StoreInfo);
        }
      }
    };

    fetchStore();
  }, [role, storeId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!fullName.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        email: user.email ?? profile?.email ?? '',
        user_id: user.id,
      };

      if (profile) {
        const { error } = await supabase
          .from('profiles')
          .update(payload)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error updating profile:', error);
          toast.error('Failed to update profile');
          return;
        }
      } else {
        const { error } = await supabase
          .from('profiles')
          .insert(payload);

        if (error) {
          console.error('Error creating profile:', error);
          toast.error('Failed to save profile');
          return;
        }
      }

      toast.success('Profile updated');
      await refreshProfile();
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
          <User className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Profile</h1>
          <p className="text-muted-foreground text-sm">Manage your account details</p>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSave}>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user.email ?? ''} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="full-name">Full Name</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91..."
                  className="pl-9"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Role & Store</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium capitalize">{role?.replace('_', ' ')}</span>
          </div>
          {role === 'admin' && store && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Store className="w-3 h-3" />
                Store
              </span>
              <span className="font-medium">{store.name}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
