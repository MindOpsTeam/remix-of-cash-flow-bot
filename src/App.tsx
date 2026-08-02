import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { CompanyProvider } from "@/hooks/useCompany";
import { DetalheProvider } from "@/components/detalhe/DetalheProvider";
import { lazy, Suspense, ReactNode } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Eagerly loaded (used on first render / small)
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import OAuthConsent from "./pages/OAuthConsent";

// Lazy-loaded pages (code-split per route)
const Index = lazy(() => import("./pages/Index"));
const Transactions = lazy(() => import("./pages/Transactions"));
const BankInbox = lazy(() => import("./pages/BankInbox"));
const Repasses = lazy(() => import("./pages/Repasses"));
const DRE = lazy(() => import("./pages/DRE"));
const Consolidado = lazy(() => import("./pages/Consolidado"));
const Contador = lazy(() => import("./pages/Contador"));
const PDV = lazy(() => import("./pages/PDV"));
const Reports = lazy(() => import("./pages/Reports"));
const WhatsApp = lazy(() => import("./pages/WhatsAppAgent"));
const CFODigital = lazy(() => import("./pages/CFODigital"));
const Agents = lazy(() => import("./pages/Agents"));
const MonthlyClose = lazy(() => import("./pages/MonthlyClose"));
const BudgetPage = lazy(() => import("./pages/Budget"));
const RecorrenciaPage = lazy(() => import("./pages/RecorrenciaRecompra"));
const CashFlowForecast = lazy(() => import("./pages/CashFlowForecast"));
const ExecutiveSummary = lazy(() => import("./pages/ExecutiveSummary"));
const Simulator = lazy(() => import("./pages/Simulator"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const ChartOfAccountsPage = lazy(() => import("./pages/settings/ChartOfAccounts"));
const CostCentersPage = lazy(() => import("./pages/settings/CostCenters"));
const IntegrationsPage = lazy(() => import("./pages/settings/Integrations"));
const ConfiguracaoPlataformaPage = lazy(() => import("./pages/settings/ConfiguracaoPlataforma"));
const AsaasIntegrationPJ = lazy(() => import("./pages/settings/AsaasIntegrationPJ"));
const PreferencesPage = lazy(() => import("./pages/settings/Preferences"));
const CompanySettingsPage = lazy(() => import("./pages/settings/CompanySettings"));
const GroupConsolidationPage = lazy(() => import("./pages/settings/GroupConsolidation"));
const ApiKeysPage = lazy(() => import("./pages/settings/ApiKeys"));
const UsersPage = lazy(() => import("./pages/settings/Users"));
const BankAccountsPage = lazy(() => import("./pages/settings/BankAccounts"));
const InterIntegrationPage = lazy(() => import("./pages/settings/InterIntegration"));
const InterBankingPage = lazy(() => import("./pages/InterBanking"));
const NfseIntegrationPage = lazy(() => import("./pages/settings/NfseIntegration"));
const PlugnotasIntegrationPage = lazy(() => import("./pages/settings/PlugnotasIntegration"));
const FocusIntegrationPage = lazy(() => import("./pages/settings/FocusIntegration"));
const OpenFinanceIntegrationPage = lazy(() => import("./pages/settings/OpenFinanceIntegration"));
const ContaAzulIntegrationPage = lazy(() => import("./pages/settings/ContaAzulIntegration"));
const PlugnotasEmitPage = lazy(() => import("./pages/PlugnotasEmit"));
const FocusEmitPage = lazy(() => import("./pages/FocusEmit"));
const AuditoriaPage = lazy(() => import("./pages/Auditoria"));
const CompanyTransfers = lazy(() => import("./pages/CompanyTransfers"));
const CompanyBills = lazy(() => import("./pages/CompanyBills"));
const DocumentScanner = lazy(() => import("./pages/DocumentScanner"));
const OwnerTransactions = lazy(() => import("./pages/OwnerTransactions"));
const ReceivablesPage = lazy(() => import("./pages/Receivables"));
const ContractsPage = lazy(() => import("./pages/Contracts"));

// Cadastros (ERP)
const ContactsPage = lazy(() => import("./pages/Contacts"));
const ProductsPage = lazy(() => import("./pages/Products"));

// Vendas & Compras
const SalesOrdersPage = lazy(() => import("./pages/SalesOrders"));
const SalespeoplePage = lazy(() => import("./pages/Salespeople"));
const PropostaPublicaPage = lazy(() => import("./pages/PropostaPublica"));
const PurchaseOrdersPage = lazy(() => import("./pages/PurchaseOrders"));

// Estoque & Fiscal
const StockPage = lazy(() => import("./pages/Stock"));
const FiscalPage = lazy(() => import("./pages/Fiscal"));
const NfseEmitPage = lazy(() => import("./pages/NfseEmit"));
const TaxCalendarPage = lazy(() => import("./pages/fiscal/TaxCalendar"));
const BillsPayablePage = lazy(() => import("./pages/fiscal/BillsPayable"));
const FiscalFilesPage = lazy(() => import("./pages/fiscal/FiscalFiles"));
const ReformaSimulatorPage = lazy(() => import("./pages/ReformaSimulator"));
const ReformaImpactoPage = lazy(() => import("./pages/ReformaImpactoClientes"));

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

function isSafeRelative(next: string | null): next is string {
  return !!next && next.startsWith("/") && !next.startsWith("//");
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    const next = new URLSearchParams(window.location.search).get("next");
    return <Navigate to={isSafeRelative(next) ? next : "/dashboard"} replace />;
  }
  return <>{children}</>;
}

const P = ({ children }: { children: ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

const AppRoutes = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/" element={<PublicRoute><Auth /></PublicRoute>} />
      <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />

      {/* Proposta que o cliente abre: pública de propósito, o token da URL é a
          credencial e as funções do banco só devolvem o que o comprador vê. */}
      <Route path="/proposta/:token" element={<PropostaPublicaPage />} />

      {/* Dashboard */}
      <Route path="/dashboard" element={<P><Index /></P>} />

      {/* Financeiro */}
      <Route path="/transactions" element={<P><Transactions /></P>} />
      <Route path="/bank-inbox" element={<P><BankInbox /></P>} />
      <Route path="/repasses" element={<P><Repasses /></P>} />
      <Route path="/pdv" element={<P><PDV /></P>} />
      <Route path="/transfers" element={<P><CompanyTransfers /></P>} />
      <Route path="/receivables" element={<P><ReceivablesPage /></P>} />
      <Route path="/contracts" element={<P><ContractsPage /></P>} />
      <Route path="/bills" element={<Navigate to="/fiscal/contas-a-pagar" replace />} />
      <Route path="/documents" element={<P><DocumentScanner /></P>} />
      <Route path="/owner-transactions" element={<P><OwnerTransactions /></P>} />
      <Route path="/inter" element={<P><InterBankingPage /></P>} />

      {/* Cadastros */}
      <Route path="/contacts" element={<P><ContactsPage /></P>} />
      <Route path="/products" element={<P><ProductsPage /></P>} />

      {/* Vendas & Compras */}
      <Route path="/sales" element={<P><SalesOrdersPage /></P>} />
      <Route path="/salespeople" element={<P><SalespeoplePage /></P>} />
      <Route path="/purchases" element={<P><PurchaseOrdersPage /></P>} />

      {/* Estoque & Fiscal */}
      <Route path="/stock" element={<P><StockPage /></P>} />
      <Route path="/fiscal" element={<P><FiscalPage /></P>} />
      <Route path="/fiscal/nfse/emit" element={<P><NfseEmitPage /></P>} />
      <Route path="/fiscal/plugnotas/emit" element={<P><PlugnotasEmitPage /></P>} />
      <Route path="/fiscal/focus/emit" element={<P><FocusEmitPage /></P>} />
      <Route path="/auditoria" element={<P><AuditoriaPage /></P>} />
      <Route path="/fiscal/impostos" element={<P><TaxCalendarPage /></P>} />
      <Route path="/reforma" element={<P><ReformaSimulatorPage /></P>} />
      <Route path="/reforma/impacto" element={<P><ReformaImpactoPage /></P>} />
      <Route path="/fiscal/contas-a-pagar" element={<P><BillsPayablePage /></P>} />
      <Route path="/fiscal/arquivos" element={<P><FiscalFilesPage /></P>} />

      {/* Análise */}
      <Route path="/dre" element={<P><DRE /></P>} />
      <Route path="/consolidado" element={<P><Consolidado /></P>} />
      <Route path="/contador" element={<P><Contador /></P>} />
      <Route path="/reports" element={<P><Reports /></P>} />
      <Route path="/forecast" element={<P><CashFlowForecast /></P>} />
      <Route path="/summary" element={<P><ExecutiveSummary /></P>} />

      {/* Inteligência */}
      <Route path="/cfo-digital" element={<P><CFODigital /></P>} />
      <Route path="/agents" element={<P><Agents /></P>} />
      <Route path="/close" element={<P><MonthlyClose /></P>} />
      <Route path="/budget" element={<P><BudgetPage /></P>} />
      <Route path="/recorrencia" element={<P><RecorrenciaPage /></P>} />
      <Route path="/simulator" element={<P><Simulator /></P>} />
      <Route path="/whatsapp" element={<P><WhatsApp /></P>} />

      {/* Configurações */}
      <Route path="/settings" element={<P><SettingsPage /></P>} />
      <Route path="/settings/company" element={<P><CompanySettingsPage /></P>} />
      <Route path="/settings/consolidation" element={<P><GroupConsolidationPage /></P>} />
      <Route path="/settings/api" element={<P><ApiKeysPage /></P>} />
      <Route path="/settings/users" element={<P><UsersPage /></P>} />
      <Route path="/settings/bank-accounts" element={<P><BankAccountsPage /></P>} />
      <Route path="/settings/chart-of-accounts" element={<P><ChartOfAccountsPage /></P>} />
      <Route path="/settings/cost-centers" element={<P><CostCentersPage /></P>} />
      <Route path="/settings/integrations" element={<P><IntegrationsPage /></P>} />
      <Route path="/settings/plataforma" element={<P><ConfiguracaoPlataformaPage /></P>} />
      <Route path="/settings/integrations/asaas" element={<P><AsaasIntegrationPJ /></P>} />
      <Route path="/settings/integrations/inter" element={<P><InterIntegrationPage /></P>} />
      <Route path="/settings/integrations/nfse" element={<P><NfseIntegrationPage /></P>} />
      <Route path="/settings/integrations/plugnotas" element={<P><PlugnotasIntegrationPage /></P>} />
      <Route path="/settings/integrations/focus" element={<P><FocusIntegrationPage /></P>} />
      <Route path="/settings/integrations/openfinance" element={<P><OpenFinanceIntegrationPage /></P>} />
      <Route path="/settings/integrations/contaazul" element={<P><ContaAzulIntegrationPage /></P>} />
      <Route path="/settings/preferences" element={<P><PreferencesPage /></P>} />

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
              <DetalheProvider>
                <AppRoutes />
              </DetalheProvider>
            </CompanyProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
