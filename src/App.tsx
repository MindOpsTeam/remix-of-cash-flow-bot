import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { CompanyProvider } from "@/hooks/useCompany";
import Index from "./pages/Index";
import Transactions from "./pages/Transactions";
import DRE from "./pages/DRE";
import Reports from "./pages/Reports";
import WhatsApp from "./pages/WhatsAppAgent";
import CFODigital from "./pages/CFODigital";
import CashFlowForecast from "./pages/CashFlowForecast";
import ExecutiveSummary from "./pages/ExecutiveSummary";
import SettingsPage from "./pages/Settings";
import ChartOfAccountsPage from "./pages/settings/ChartOfAccounts";
import CostCentersPage from "./pages/settings/CostCenters";
import IntegrationsPage from "./pages/settings/Integrations";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { ReactNode } from "react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
    <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
    <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
    <Route path="/dre" element={<ProtectedRoute><DRE /></ProtectedRoute>} />
    <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
    <Route path="/whatsapp" element={<ProtectedRoute><WhatsApp /></ProtectedRoute>} />
    <Route path="/cfo-digital" element={<ProtectedRoute><CFODigital /></ProtectedRoute>} />
    <Route path="/forecast" element={<ProtectedRoute><CashFlowForecast /></ProtectedRoute>} />
    <Route path="/summary" element={<ProtectedRoute><ExecutiveSummary /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
    <Route path="/settings/chart-of-accounts" element={<ProtectedRoute><ChartOfAccountsPage /></ProtectedRoute>} />
    <Route path="/settings/cost-centers" element={<ProtectedRoute><CostCentersPage /></ProtectedRoute>} />
    <Route path="/settings/integrations" element={<ProtectedRoute><IntegrationsPage /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CompanyProvider>
            <AppRoutes />
          </CompanyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
