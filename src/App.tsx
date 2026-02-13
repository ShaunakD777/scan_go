import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import { Layout } from "@/components/Layout";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Scanner from "./pages/Scanner";
import Cart from "./pages/Cart";
import PaymentSuccess from "./pages/PaymentSuccess";
import History from "./pages/History";
import NotFound from "./pages/NotFound";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AdminProducts from "./pages/AdminProducts";
import AddProduct from "./pages/AddProduct";
import Profile from "./pages/Profile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <Layout>
              <Routes>
                {/* User routes */}
                <Route path="/" element={<Home />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/scan" element={<Scanner />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/payment-success" element={<PaymentSuccess />} />
                <Route path="/history" element={<History />} />

                {/* Super admin routes */}
                <Route path="/admin/dashboard" element={<SuperAdminDashboard />} />
                <Route path="/admin/stores" element={<SuperAdminDashboard />} />

                {/* Store admin routes */}
                <Route path="/store/dashboard" element={<AdminDashboard />} />
                <Route path="/store/products" element={<AdminProducts />} />
                <Route path="/store/add-product" element={<AddProduct />} />

                {/* Shared */}
                <Route path="/profile" element={<Profile />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
