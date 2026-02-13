import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { signIn, signUp } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Scan, Mail, Lock, User, Phone, Store, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional(),
  storeId: z.string().optional(),
});

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  
  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Signup form
  const [signupFullName, setSignupFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupStoreId, setSignupStoreId] = useState('');

  useEffect(() => {
    if (user && !loading) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validation = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        return;
      }

      setIsLoading(true);
      const { error } = await signIn(loginEmail, loginPassword);

      if (error) {
        if (error.message.includes('Invalid login')) {
          toast.error('Invalid email or password');
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success('Welcome back!');
      
      // Wait a moment for auth state to update
      setTimeout(() => {
        navigate('/');
      }, 300);
    } catch (error) {
      console.error('Login error:', error);
      toast.error('An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validation = signupSchema.safeParse({
        fullName: signupFullName,
        email: signupEmail,
        password: signupPassword,
        phone: signupPhone || undefined,
        storeId: signupStoreId || undefined,
      });

      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        return;
      }

      setIsLoading(true);

      // If store ID is provided, validate it exists
      if (signupStoreId) {
        const { data: store, error: storeError } = await supabase
          .from('stores')
          .select('id, admin_id')
          .eq('id', signupStoreId)
          .single();

        if (storeError || !store) {
          toast.error('Invalid Store ID. Please check with your super admin.');
          setIsLoading(false);
          return;
        }

        if (store.admin_id) {
          toast.error('This store already has an admin assigned.');
          setIsLoading(false);
          return;
        }
      }

      const { data, error } = await signUp(
        signupEmail, 
        signupPassword, 
        signupFullName, 
        signupPhone || undefined, 
        signupStoreId || undefined
      );

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('An account with this email already exists');
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (data.user) {
        // Update profile with additional details
        const { error: profileError } = await supabase.from('profiles').update({
          full_name: signupFullName,
          phone: signupPhone || null,
        }).eq('user_id', data.user.id);

        if (profileError) {
          console.error('Profile update error:', profileError);
        }

        // If admin (store ID provided), update role to 'admin'
        if (signupStoreId) {
          const { error: roleError } = await supabase.from('user_roles').update({
            role: 'admin',
          }).eq('user_id', data.user.id);

          if (roleError) {
            console.error('Role update error:', roleError);
          }

          // Assign to store
          const { error: storeError } = await supabase
            .from('stores')
            .update({ admin_id: data.user.id })
            .eq('id', signupStoreId);

          if (storeError) {
            console.error('Store assignment error:', storeError);
          }
        }

        toast.success('Account created successfully! Redirecting...');
        // Wait for data to sync then redirect to home
        setTimeout(() => {
          navigate('/');
        }, 800);
      }
    } catch (error) {
      console.error('Signup error:', error);
      toast.error('An error occurred during signup');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4 glow-button">
          <Scan className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="font-display text-3xl font-bold text-foreground">Scan & Go</h1>
        <p className="text-muted-foreground mt-1">Scan. Pay. Walk Out.</p>
      </div>

      {/* Auth Card */}
      <Card className="w-full max-w-md glass-card">
        <CardHeader className="text-center pb-4">
          <CardTitle className="font-display text-xl">Welcome</CardTitle>
          <CardDescription>Sign in or create an account to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type={showLoginPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showLoginPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full glow-button bg-primary hover:bg-primary/90"
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      className="pl-10"
                      value={signupFullName}
                      onChange={(e) => setSignupFullName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type={showSignupPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showSignupPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-phone">Phone (Optional)</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-phone"
                      type="tel"
                      placeholder="+1234567890"
                      className="pl-10"
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-store-id">
                    Store ID <span className="text-muted-foreground text-xs">(Only for store admins)</span>
                  </Label>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-store-id"
                      type="text"
                      placeholder="Leave empty if you're a customer"
                      className="pl-10"
                      value={signupStoreId}
                      onChange={(e) => setSignupStoreId(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Got a Store ID from your super admin? Enter it to become a store admin.
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full glow-button bg-primary hover:bg-primary/90"
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating account...' : 'Create Account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="text-xs text-muted-foreground mt-8">
        By continuing, you agree to our Terms of Service
      </p>
    </div>
  );
}
