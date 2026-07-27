import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCompanies from "./tools/list-companies";
import listTransactions from "./tools/list-transactions";
import createTransaction from "./tools/create-transaction";
import listReceivables from "./tools/list-receivables";
import listBillsPayable from "./tools/list-bills-payable";
import cashSummary from "./tools/cash-summary";

// Build the OAuth issuer from the project ref (NEVER from SUPABASE_URL — the
// Cloud proxy uses .lovable.cloud and mcp-js rejects issuer mismatches).
// VITE_SUPABASE_PROJECT_ID is inlined at build time, so this stays import-safe.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "financeai-mcp",
  title: "FinanceAI",
  version: "0.1.0",
  instructions:
    "Ferramentas do FinanceAI (ERP financeiro para empresas brasileiras). Use `list_companies` para descobrir os CNPJs vinculados ao usuário, depois passe o `company_id` para as demais ferramentas. Valores em BRL, datas em ISO YYYY-MM-DD. Todas as chamadas respeitam a permissão de membro da empresa (RLS).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listCompanies,
    listTransactions,
    createTransaction,
    listReceivables,
    listBillsPayable,
    cashSummary,
  ],
});
