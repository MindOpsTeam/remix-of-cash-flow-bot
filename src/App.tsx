import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { CompanyProvider } from "@/hooks/useCompany";
import { AppModeProvider } from "@/hooks/useAppMode";
import { lazy, Suspense, ReactNode } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Eagerly loaded (used on first render / small)
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy-loaded pages (code-split per route)
const Index = lazy(() => import("./pages/Index"));
const Transactions = lazy(() => import("./pages/Transactions"));
const DRE = lazy(() => import("./pages/DRE"));
const Reports = lazy(() => import("./pages/Reports"));
const WhatsApp = lazy(() => import("./pages/WhatsAppAgent"));
const CFODigital = lazy(() => import("./pages/CFODigital"));
const CashFlowForecast = lazy(() => import("./pages/CashFlowForecast"));
const ExecutiveSummary = lazy(() => import("./pages/ExecutiveSummary"));
const Simulator = lazy(() => import("./pages/Simulator"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const ChartOfAccountsPage = lazy(() => import("./pages/settings/ChartOfAccounts"));
const CostCentersPage = lazy(() => import("./pages/settings/CostCenters"));
const IntegrationsPage = lazy(() => import("./pages/settings/Integrations"));
const AsaasIntegrationPage = lazy(() => import("./pages/settings/AsaasIntegration"));
const PersonalDashboard = lazy(() => import("./pages/personal/PersonalDashboard"));
const PersonalTransactions = lazy(() => import("./pages/personal/PersonalTransactions"));
const PersonalAccounts = lazy(() => import("./pages/personal/PersonalAccounts"));
const PersonalForecast = lazy(() => import("./pages/personal/PersonalForecast"));
const PersonalSummary = lazy(() => import("./pages/personal/PersonalSummary"));
const PersonalSettings = lazy(() => import("./pages/personal/PersonalSettings"));
const PersonalIntegrations = lazy(() => import("./pages/personal/PersonalIntegrations"));
const PersonalTransfers = lazy(() => import("./pages/personal/PersonalTransfers"));
const PersonalBills = lazy(() => import("./pages/personal/PersonalBills"));
const CompanyTransfers = lazy(() => import("./pages/CompanyTransfers"));
const CompanyBills = lazy(() => import("./pages/CompanyBills"));
const DocumentScanner = lazy(() => import("./pages/DocumentScanner"));
const OwnerTransactions = lazy(() => import("./pages/OwnerTransactions"));
const PersonalReports = lazy(() => import("./pages/personal/PersonalReports"));
const PersonalCategories = lazy(() => import("./pages/personal/PersonalCategories"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-muted-foreground text-sm">Carregando...</div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <PageLoader />;
  }
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/" element={<PublicRoute><Auth /></PublicRoute>} />
      {/* Business routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
      <Route path="/transfers" element={<ProtectedRoute><CompanyTransfers /></ProtectedRoute>} />
      <Route path="/bills" element={<ProtectedRoute><CompanyBills /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><DocumentScanner /></ProtectedRoute>} />
      <Route path="/owner-transactions" element={<ProtectedRoute><OwnerTransactions /></ProtectedRoute>} />
      <Route path="/dre" element={<ProtectedRoute><DRE /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/whatsapp" element={<ProtectedRoute><WhatsApp /></ProtectedRoute>} />
      <Route path="/cfo-digital" element={<ProtectedRoute><CFODigital /></ProtectedRoute>} />
      <Route path="/forecast" element={<ProtectedRoute><CashFlowForecast /></ProtectedRoute>} />
      <Route path="/summary" element={<ProtectedRoute><ExecutiveSummary /></ProtectedRoute>} />
      <Route path="/simulator" element={<ProtectedRoute><Simulator /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/settings/chart-of-accounts" element={<ProtectedRoute><ChartOfAccountsPage /></ProtectedRoute>} />
      <Route path="/settings/cost-centers" element={<ProtectedRoute><CostCentersPage /></ProtectedRoute>} />
      <Route path="/settings/integrations" element={<ProtectedRoute><IntegrationsPage /></ProtectedRoute>} />
      <Route path="/settings/integrations/asaas" element={<ProtectedRoute><AsaasIntegrationPage /></ProtectedRoute>} />
      {/* Personal routes */}
      <Route path="/personal" element={<ProtectedRoute><PersonalDashboard /></ProtectedRoute>} />
      <Route path="/personal/transactions" element={<ProtectedRoute><PersonalTransactions /></ProtectedRoute>} />
      <Route path="/personal/transfers" element={<ProtectedRoute><PersonalTransfers /></ProtectedRoute>} />
      <Route path="/personal/bills" element={<ProtectedRoute><PersonalBills /></ProtectedRoute>} />
      <Route path="/personal/accounts" element={<ProtectedRoute><PersonalAccounts /></ProtectedRoute>} />
      <Route path="/personal/forecast" element={<ProtectedRoute><PersonalForecast /></ProtectedRoute>} />
      <Route path="/personal/summary" element={<ProtectedRoute><PersonalSummary /></ProtectedRoute>} />
      <Route path="/personal/reports" element={<ProtectedRoute><PersonalReports /></ProtectedRoute>} />
      <Route path="/personal/categories" element={<ProtectedRoute><PersonalCategories /></ProtectedRoute>} />
      <Route path="/personal/settings" element={<ProtectedRoute><PersonalSettings /></ProtectedRoute>} />
      <Route path="/personal/settings/integrations" element={<ProtectedRoute><PersonalIntegrations /></ProtectedRoute>} />
      <Route path="/personal/settings/integrations/asaas" element={<ProtectedRoute><AsaasIntegrationPage /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <CompanyProvider>
              <AppModeProvider>
                <AppRoutes />
              </AppModeProvider>
            </CompanyProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
