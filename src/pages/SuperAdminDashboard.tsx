import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Copy, Store, UserPlus, Users, TrendingUp, DollarSign } from 'lucide-react';

interface StoreInfo {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  logo_url: string | null;
  admin_id: string | null;
  created_at: string;
}

interface AdminProfile {
  user_id: string;
  full_name: string;
  email: string;
}

interface AdminAnalytics {
  user_id: string;
  full_name: string;
  email: string;
  store_name: string;
  total_revenue: number;
  transaction_count: number;
}

interface UserAnalytics {
  user_id: string;
  full_name: string;
  email: string;
  total_spent: number;
  transaction_count: number;
}

interface StoreRevenue {
  store_id: string;
  store_name: string;
  total_revenue: number;
  transaction_count: number;
}

export default function SuperAdminDashboard() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [adminsById, setAdminsById] = useState<Record<string, AdminProfile>>({});
  const [loadingStores, setLoadingStores] = useState(true);
  
  // Analytics states
  const [adminAnalytics, setAdminAnalytics] = useState<AdminAnalytics[]>([]);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics[]>([]);
  const [storeRevenue, setStoreRevenue] = useState<StoreRevenue[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  const [assigningStoreId, setAssigningStoreId] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState('');

  useEffect(() => {
    if (!loading && (!user || role !== 'super_admin')) {
      navigate('/');
    }
  }, [user, role, loading, navigate]);

  useEffect(() => {
    const fetchStores = async () => {
      if (!user || role !== 'super_admin') return;

      setLoadingStores(true);
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, description, address, logo_url, admin_id, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching stores:', error);
        toast.error('Failed to load stores');
        setLoadingStores(false);
        return;
      }

      setStores(data || []);

      const adminIds = Array.from(new Set((data || []).map(s => s.admin_id).filter(Boolean))) as string[];
      if (adminIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', adminIds);

        if (profilesError) {
          console.error('Error fetching admin profiles:', profilesError);
        } else if (profiles) {
          const map: Record<string, AdminProfile> = {};
          for (const p of profiles) {
            map[p.user_id] = p as AdminProfile;
          }
          setAdminsById(map);
        }
      } else {
        setAdminsById({});
      }

      setLoadingStores(false);
    };

    fetchStores();
  }, [user, role]);

  // Fetch analytics data
  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!user || role !== 'super_admin') return;

      setLoadingAnalytics(true);

      try {
        // Fetch all transactions with store info
        const { data: transactions, error: txError } = await supabase
          .from('transactions')
          .select('id, total_amount, user_id, store_id, created_at');

        if (txError) {
          console.error('Error fetching transactions:', txError);
          console.log('Transactions error details:', JSON.stringify(txError));
          setLoadingAnalytics(false);
          return;
        }

        console.log('Transactions fetched:', transactions?.length || 0);

        // Fetch all store information
        const { data: storeList, error: storeListError } = await supabase
          .from('stores')
          .select('id, name, admin_id');

        if (storeListError) {
          console.error('Error fetching stores:', storeListError);
          setLoadingAnalytics(false);
          return;
        }

        // Build store mapping
        const storeMap: Record<string, any> = {};
        storeList?.forEach((s) => {
          storeMap[s.id] = s;
        });

        // Fetch all user profiles
        const { data: userProfiles, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email');

        if (profileError) {
          console.error('Error fetching profiles:', profileError);
          setLoadingAnalytics(false);
          return;
        }

        // Build user mapping
        const userMap: Record<string, any> = {};
        userProfiles?.forEach((p) => {
          userMap[p.user_id] = p;
        });

        // Calculate admin analytics
        const adminRevenueMap: Record<string, AdminAnalytics> = {};
        const storeRevenueMap: Record<string, StoreRevenue> = {};

        transactions?.forEach((tx) => {
          const store = storeMap[tx.store_id];
          if (!store) return;

          const adminId = store.admin_id;
          const amount = tx.total_amount || 0;

          // Admin revenue
          if (adminId) {
            const admin = adminsById[adminId];
            if (admin) {
              if (!adminRevenueMap[adminId]) {
                adminRevenueMap[adminId] = {
                  user_id: adminId,
                  full_name: admin.full_name,
                  email: admin.email,
                  store_name: store.name,
                  total_revenue: 0,
                  transaction_count: 0,
                };
              }
              adminRevenueMap[adminId].total_revenue += amount;
              adminRevenueMap[adminId].transaction_count += 1;
            }
          }

          // Store revenue
          if (!storeRevenueMap[tx.store_id]) {
            storeRevenueMap[tx.store_id] = {
              store_id: tx.store_id,
              store_name: store.name,
              total_revenue: 0,
              transaction_count: 0,
            };
          }
          storeRevenueMap[tx.store_id].total_revenue += amount;
          storeRevenueMap[tx.store_id].transaction_count += 1;
        });

        setAdminAnalytics(Object.values(adminRevenueMap));
        setStoreRevenue(
          Object.values(storeRevenueMap).sort((a, b) => b.total_revenue - a.total_revenue)
        );

        // Calculate user analytics
        const userSpendMap: Record<string, UserAnalytics> = {};
        transactions?.forEach((tx) => {
          const userId = tx.user_id;
          const user = userMap[userId];
          const amount = tx.total_amount || 0;

          if (user) {
            if (!userSpendMap[userId]) {
              userSpendMap[userId] = {
                user_id: userId,
                full_name: user.full_name,
                email: user.email,
                total_spent: 0,
                transaction_count: 0,
              };
            }
            userSpendMap[userId].total_spent += amount;
            userSpendMap[userId].transaction_count += 1;
          }
        });

        setUserAnalytics(
          Object.values(userSpendMap).sort((a, b) => b.total_spent - a.total_spent)
        );

        console.log('Analytics updated:', {
          admins: Object.keys(adminRevenueMap).length,
          users: Object.keys(userSpendMap).length,
          stores: Object.keys(storeRevenueMap).length,
        });
      } catch (error) {
        console.error('Error fetching analytics:', error);
      }

      setLoadingAnalytics(false);
    };

    fetchAnalytics();
  }, [user, role, adminsById]);

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!name.trim()) {
      toast.error('Store name is required');
      return;
    }

    const { data, error } = await supabase
      .from('stores')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        address: address.trim() || null,
        logo_url: logoUrl.trim() || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating store:', error);
      toast.error('Failed to create store');
      return;
    }

    toast.success('Store created');
    setName('');
    setDescription('');
    setAddress('');
    setLogoUrl('');
    setStores(prev => [data as StoreInfo, ...prev]);
  };

  const handleCopyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      toast.success('Store ID copied to clipboard');
    } catch {
      toast.error('Failed to copy Store ID');
    }
  };

  const handleAssignAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningStoreId || !adminEmail.trim()) return;

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('email', adminEmail.trim())
        .single();

      if (profileError || !profile) {
        toast.error('User with this email was not found');
        return;
      }

      const userId = (profile as AdminProfile).user_id;

      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert(
          { user_id: userId, role: 'admin' },
          { onConflict: 'user_id,role' }
        );

      if (roleError) {
        console.error('Error assigning admin role:', roleError);
        toast.error('Failed to assign admin role');
        return;
      }

      const { error: storeError } = await supabase
        .from('stores')
        .update({ admin_id: userId })
        .eq('id', assigningStoreId);

      if (storeError) {
        console.error('Error assigning store admin:', storeError);
        toast.error('Failed to assign store admin');
        return;
      }

      toast.success('Admin assigned to store');
      setAssigningStoreId(null);
      setAdminEmail('');

      setStores(prev =>
        prev.map(s =>
          s.id === assigningStoreId ? { ...s, admin_id: userId } : s
        )
      );

      setAdminsById(prev => ({
        ...prev,
        [userId]: profile as AdminProfile,
      }));
    } catch (error) {
      console.error('Error assigning admin:', error);
      toast.error('Failed to assign admin');
    }
  };

  const unassignedStores = stores.filter(s => !s.admin_id).length;

  if (loading || !user || role !== 'super_admin') {
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
          <Store className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Super Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Create stores and assign store admins
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Create Store</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreateStore}>
              <div className="space-y-2">
                <Label htmlFor="store-name">Store Name</Label>
                <Input
                  id="store-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Downtown Supermarket"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="store-address">Address</Label>
                <Input
                  id="store-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Store address (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="store-description">Description</Label>
                <Input
                  id="store-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="store-logo">Logo URL</Label>
                <Input
                  id="store-logo"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://... (optional)"
                />
              </div>

              <Button type="submit" className="w-full">
                Create Store
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Stores</p>
                <p className="text-2xl font-display font-bold">{stores.length}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Stores without admin</p>
                <p className="text-2xl font-display font-bold">{unassignedStores}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Management & Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="stores" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="stores">Stores</TabsTrigger>
              <TabsTrigger value="admins">Store Admins</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
            </TabsList>

            {/* Stores Tab */}
            <TabsContent value="stores" className="space-y-4 mt-4">
          {loadingStores ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : stores.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No stores created yet. Use the form above to add your first store.
            </p>
          ) : (
            <div className="space-y-4">
              {stores.map((store) => {
                const admin = store.admin_id ? adminsById[store.admin_id] : null;

                return (
                  <div
                    key={store.id}
                    className="border rounded-xl p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-primary" />
                        <p className="font-semibold truncate">{store.name}</p>
                      </div>
                      {store.address && (
                        <p className="text-xs text-muted-foreground truncate">{store.address}</p>
                      )}
                      {store.description && (
                        <p className="text-xs text-muted-foreground truncate">{store.description}</p>
                      )}

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono truncate">ID: {store.id}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => handleCopyId(store.id)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Admin:{' '}
                        {admin ? (
                          <span>{admin.full_name} ({admin.email})</span>
                        ) : (
                          <span className="italic">Unassigned</span>
                        )}
                      </div>
                    </div>

                    <div className="w-full md:w-64 mt-2 md:mt-0">
                      {assigningStoreId === store.id ? (
                        <form className="space-y-2" onSubmit={handleAssignAdmin}>
                          <Label htmlFor={`admin-email-${store.id}`} className="text-xs">
                            Assign admin by email
                          </Label>
                          <Input
                            id={`admin-email-${store.id}`}
                            type="email"
                            value={adminEmail}
                            onChange={(e) => setAdminEmail(e.target.value)}
                            placeholder="admin@example.com"
                            required
                          />
                          <div className="flex gap-2">
                            <Button type="submit" size="sm" className="flex-1">
                              Assign
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setAssigningStoreId(null);
                                setAdminEmail('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full flex items-center justify-center gap-2"
                          onClick={() => {
                            setAssigningStoreId(store.id);
                            setAdminEmail('');
                          }}
                        >
                          <UserPlus className="w-4 h-4" />
                          {admin ? 'Change Admin' : 'Assign Admin'}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
            </TabsContent>

            {/* Store Admins Tab */}
            <TabsContent value="admins" className="space-y-4 mt-4">
              {loadingAnalytics ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : adminAnalytics.length === 0 ? (
                <p className="text-muted-foreground text-sm">No admin data available yet.</p>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {adminAnalytics.map((admin) => (
                    <div key={admin.user_id} className="border rounded-xl p-3 flex justify-between items-start">
                      <div className="space-y-1 flex-1">
                        <p className="font-semibold">{admin.full_name}</p>
                        <p className="text-xs text-muted-foreground">{admin.email}</p>
                        <p className="text-xs text-muted-foreground">Store: {admin.store_name}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4 text-primary" />
                          <p className="font-display font-semibold">₹{admin.total_revenue.toFixed(2)}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{admin.transaction_count} transactions</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users" className="space-y-4 mt-4">
              {loadingAnalytics ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : userAnalytics.length === 0 ? (
                <p className="text-muted-foreground text-sm">No user data available yet.</p>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {userAnalytics.map((user) => (
                    <div key={user.user_id} className="border rounded-xl p-3 flex justify-between items-start">
                      <div className="space-y-1 flex-1">
                        <p className="font-semibold">{user.full_name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4 text-primary" />
                          <p className="font-display font-semibold">₹{user.total_spent.toFixed(2)}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{user.transaction_count} purchases</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Revenue Tab */}
            <TabsContent value="revenue" className="space-y-4 mt-4">
              {loadingAnalytics ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : storeRevenue.length === 0 ? (
                <p className="text-muted-foreground text-sm">No revenue data available yet.</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Card className="border bg-card/50">
                      <CardContent className="pt-6">
                        <div className="text-center space-y-2">
                          <p className="text-sm text-muted-foreground">Total Revenue</p>
                          <p className="text-2xl font-display font-bold text-primary">
                            ₹{storeRevenue.reduce((sum, s) => sum + s.total_revenue, 0).toFixed(2)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border bg-card/50">
                      <CardContent className="pt-6">
                        <div className="text-center space-y-2">
                          <p className="text-sm text-muted-foreground">Total Transactions</p>
                          <p className="text-2xl font-display font-bold">
                            {storeRevenue.reduce((sum, s) => sum + s.transaction_count, 0)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border bg-card/50">
                      <CardContent className="pt-6">
                        <div className="text-center space-y-2">
                          <p className="text-sm text-muted-foreground">Active Stores</p>
                          <p className="text-2xl font-display font-bold">{storeRevenue.length}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                    {storeRevenue.map((store) => (
                      <div key={store.store_id} className="border rounded-xl p-3 flex justify-between items-start">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <Store className="w-4 h-4 text-primary" />
                            <p className="font-semibold">{store.store_name}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">{store.transaction_count} transactions</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-4 h-4 text-success" />
                            <p className="font-display font-semibold text-primary">₹{store.total_revenue.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
