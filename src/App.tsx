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
import { BusinessRoute, PersonalRoute } from "@/components/ModeRoute";

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
const AsaasIntegrationPJ = lazy(() => import("./pages/settings/AsaasIntegrationPJ"));
const PreferencesPage = lazy(() => import("./pages/settings/Preferences"));
const CompanySettingsPage = lazy(() => import("./pages/settings/CompanySettings"));
const UsersPage = lazy(() => import("./pages/settings/Users"));
const BankAccountsPage = lazy(() => import("./pages/settings/BankAccounts"));
const PersonalPreferences = lazy(() => import("./pages/personal/PersonalPreferences"));
const AsaasIntegrationPF = lazy(() => import("./pages/personal/AsaasIntegrationPF"));
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
const PersonalBudgets = lazy(() => import("./pages/personal/PersonalBudgets"));
const PersonalGoals = lazy(() => import("./pages/personal/PersonalGoals"));
const PersonalCreditCards = lazy(() => import("./pages/personal/PersonalCreditCards"));

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

      {/* Business routes — guarded by BusinessRoute */}
      <Route path="/dashboard" element={<ProtectedRoute><BusinessRoute><Index /></BusinessRoute></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><BusinessRoute><Transactions /></BusinessRoute></ProtectedRoute>} />
      <Route path="/transfers" element={<ProtectedRoute><BusinessRoute><CompanyTransfers /></BusinessRoute></ProtectedRoute>} />
      <Route path="/bills" element={<ProtectedRoute><BusinessRoute><CompanyBills /></BusinessRoute></ProtectedRoute>} />
      <Route path="/dre" element={<ProtectedRoute><BusinessRoute><DRE /></BusinessRoute></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><BusinessRoute><Reports /></BusinessRoute></ProtectedRoute>} />
      <Route path="/cfo-digital" element={<ProtectedRoute><BusinessRoute><CFODigital /></BusinessRoute></ProtectedRoute>} />
      <Route path="/forecast" element={<ProtectedRoute><BusinessRoute><CashFlowForecast /></BusinessRoute></ProtectedRoute>} />
      <Route path="/summary" element={<ProtectedRoute><BusinessRoute><ExecutiveSummary /></BusinessRoute></ProtectedRoute>} />
      <Route path="/simulator" element={<ProtectedRoute><BusinessRoute><Simulator /></BusinessRoute></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><BusinessRoute><SettingsPage /></BusinessRoute></ProtectedRoute>} />
      <Route path="/settings/chart-of-accounts" element={<ProtectedRoute><BusinessRoute><ChartOfAccountsPage /></BusinessRoute></ProtectedRoute>} />
      <Route path="/settings/cost-centers" element={<ProtectedRoute><BusinessRoute><CostCentersPage /></BusinessRoute></ProtectedRoute>} />
      <Route path="/settings/integrations" element={<ProtectedRoute><BusinessRoute><IntegrationsPage /></BusinessRoute></ProtectedRoute>} />
      <Route path="/settings/integrations/asaas" element={<ProtectedRoute><BusinessRoute><AsaasIntegrationPJ /></BusinessRoute></ProtectedRoute>} />
      <Route path="/settings/preferences" element={<ProtectedRoute><BusinessRoute><PreferencesPage /></BusinessRoute></ProtectedRoute>} />
      <Route path="/settings/company" element={<ProtectedRoute><BusinessRoute><CompanySettingsPage /></BusinessRoute></ProtectedRoute>} />
      <Route path="/settings/users" element={<ProtectedRoute><BusinessRoute><UsersPage /></BusinessRoute></ProtectedRoute>} />
      <Route path="/settings/bank-accounts" element={<ProtectedRoute><BusinessRoute><BankAccountsPage /></BusinessRoute></ProtectedRoute>} />

      {/* Shared routes (accessible from both modes) */}
      <Route path="/documents" element={<ProtectedRoute><DocumentScanner /></ProtectedRoute>} />
      <Route path="/owner-transactions" element={<ProtectedRoute><OwnerTransactions /></ProtectedRoute>} />
      <Route path="/whatsapp" element={<ProtectedRoute><WhatsApp /></ProtectedRoute>} />

      {/* Personal routes — guarded by PersonalRoute */}
      <Route path="/personal" element={<ProtectedRoute><PersonalRoute><PersonalDashboard /></PersonalRoute></ProtectedRoute>} />
      <Route path="/personal/transactions" element={<ProtectedRoute><PersonalRoute><PersonalTransactions /></PersonalRoute></ProtectedRoute>} />
      <Route path="/personal/transfers" element={<ProtectedRoute><PersonalRoute><PersonalTransfers /></PersonalRoute></ProtectedRoute>} />
      <Route path="/personal/bills" element={<ProtectedRoute><PersonalRoute><PersonalBills /></PersonalRoute></ProtectedRoute>} />
      <Route path="/personal/accounts" element={<ProtectedRoute><PersonalRoute><PersonalAccounts /></PersonalRoute></ProtectedRoute>} />
      <Route path="/personal/forecast" element={<ProtectedRoute><PersonalRoute><PersonalForecast /></PersonalRoute></ProtectedRoute>} />
      <Route path="/personal/summary" element={<ProtectedRoute><PersonalRoute><PersonalSummary /></PersonalRoute></ProtectedRoute>} />
      <Route path="/personal/reports" element={<ProtectedRoute><PersonalRoute><PersonalReports /></PersonalRoute></ProtectedRoute>} />
      <Route path="/personal/categories" element={<ProtectedRoute><PersonalRoute><PersonalCategories /></PersonalRoute></ProtectedRoute>} />
      <Route path="/personal/settings" element={<ProtectedRoute><PersonalRoute><PersonalSettings /></PersonalRoute></ProtectedRoute>} />
      <Route path="/personal/settings/integrations" element={<ProtectedRoute><PersonalRoute><PersonalIntegrations /></PersonalRoute></ProtectedRoute>} />
      <Route path="/personal/settings/integrations/asaas" element={<ProtectedRoute><PersonalRoute><AsaasIntegrationPF /></PersonalRoute></ProtectedRoute>} />
      <Route path="/personal/settings/preferences" element={<ProtectedRoute><PersonalRoute><PersonalPreferences /></PersonalRoute></ProtectedRoute>} />
      <Route path="/personal/budgets" element={<ProtectedRoute><PersonalRoute><PersonalBudgets /></PersonalRoute></ProtectedRoute>} />
      <Route path="/personal/goals" element={<ProtectedRoute><PersonalRoute><PersonalGoals /></PersonalRoute></ProtectedRoute>} />
      <Route path="/personal/credit-cards" element={<ProtectedRoute><PersonalRoute><PersonalCreditCards /></PersonalRoute></ProtectedRoute>} />

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
