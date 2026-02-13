import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { 
  Scan, 
  ShoppingCart, 
  User, 
  Store, 
  LogOut, 
  Home,
  LayoutDashboard,
  Package,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, role, profile, signOut } = useAuth();
  const { itemCount } = useCart();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  // Different nav items based on role
  const getNavItems = () => {
    if (role === 'super_admin') {
      return [
        { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/admin/stores', icon: Store, label: 'Stores' },
        { path: '/profile', icon: User, label: 'Profile' },
      ];
    }

    if (role === 'admin') {
      return [
        { path: '/store/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/store/products', icon: Package, label: 'Products' },
        { path: '/store/add-product', icon: Scan, label: 'Add Product' },
        { path: '/profile', icon: User, label: 'Profile' },
      ];
    }

    // Regular user
    return [
      { path: '/', icon: Home, label: 'Home' },
      { path: '/scan', icon: Scan, label: 'Scan' },
      { path: '/cart', icon: ShoppingCart, label: 'Cart', badge: itemCount },
      { path: '/history', icon: History, label: 'History' },
      { path: '/profile', icon: User, label: 'Profile' },
    ];
  };

  const navItems = getNavItems();

  // Hide layout on auth page
  if (location.pathname === '/auth') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col pb-20">
      {/* Header */}
      <header className="glass-card sticky top-0 z-50 border-x-0 border-t-0 rounded-none">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Scan className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-foreground">Scan & Go</h1>
              <p className="text-[10px] text-muted-foreground tracking-wider uppercase">Scan. Pay. Walk Out.</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {user && (
              <>
                <span className={cn(
                  "role-badge hidden sm:inline-flex",
                  role === 'super_admin' && 'super-admin',
                  role === 'admin' && 'admin',
                  role === 'user' && 'user'
                )}>
                  {role?.replace('_', ' ')}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSignOut}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6 page-enter">
        {children}
      </main>

      {/* Bottom Navigation */}
      {user && (
        <nav className="bottom-nav">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-around">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all",
                      isActive 
                        ? "text-primary bg-primary/10" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className="relative">
                      <Icon className="w-6 h-6" />
                      {item.badge !== undefined && item.badge > 0 && (
                        <Badge 
                          className="absolute -top-2 -right-2 h-5 min-w-[20px] flex items-center justify-center p-0 text-xs bg-primary text-primary-foreground"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}
