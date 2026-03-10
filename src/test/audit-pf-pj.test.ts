/**
 * 🔍 Auditor Agent: Separação PF × PJ
 *
 * Validates the rules defined in .lovable/plan.md
 * Ensures Asaas (gateway empresarial) does NOT leak into the PF (personal) side.
 *
 * Run: npm test -- --testPathPattern=audit-pf-pj
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.resolve(__dirname, "..");

// ─── Helpers ────────────────────────────────────────────────────────────────

function readFile(relativePath: string): string {
  const fullPath = path.join(SRC, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }
  return fs.readFileSync(fullPath, "utf-8");
}

function findAsaasReferences(content: string): string[] {
  const lines = content.split("\n");
  const matches: string[] = [];
  lines.forEach((line, i) => {
    // Skip comments and imports of types only used for PJ
    if (/asaas/i.test(line)) {
      matches.push(`L${i + 1}: ${line.trim()}`);
    }
  });
  return matches;
}

function listFiles(dir: string, ext: string): string[] {
  const fullDir = path.join(SRC, dir);
  if (!fs.existsSync(fullDir)) return [];
  return fs.readdirSync(fullDir)
    .filter((f) => f.endsWith(ext))
    .map((f) => path.join(dir, f));
}

// ─── Plan Rules ─────────────────────────────────────────────────────────────

describe("🔍 Auditor PF×PJ — .lovable/plan.md", () => {

  // ════════════════════════════════════════════════════════════════════════════
  // RULE 1: usePersonalAccounts must have ZERO Asaas logic
  // ════════════════════════════════════════════════════════════════════════════
  describe("Rule 1: usePersonalAccounts — sem Asaas", () => {
    const file = "hooks/usePersonalAccounts.ts";

    it("should not query asaas_config", () => {
      const content = readFile(file);
      expect(content).not.toMatch(/asaas_config/i);
    });

    it("should not query asaas_balance or edge function", () => {
      const content = readFile(file);
      expect(content).not.toMatch(/asaas.balance/i);
      expect(content).not.toMatch(/asaas-api/i);
    });

    it("should not query asaas_payments as fallback balance", () => {
      const content = readFile(file);
      expect(content).not.toMatch(/asaas_payments/i);
    });

    it("should not have asaasBalance, hasAsaas, or asaasAccount variables", () => {
      const content = readFile(file);
      expect(content).not.toMatch(/asaasBalance/i);
      expect(content).not.toMatch(/hasAsaas/i);
      expect(content).not.toMatch(/asaasAccount/i);
    });

    it("should not include Asaas in totalBalance calculation", () => {
      const content = readFile(file);
      // totalBalance should only sum personal_accounts
      const totalBalanceLine = content
        .split("\n")
        .find((l) => l.includes("totalBalance"));
      if (totalBalanceLine) {
        expect(totalBalanceLine).not.toMatch(/asaas/i);
      }
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // RULE 2: usePersonalKPIs must have ZERO Asaas additions
  // ════════════════════════════════════════════════════════════════════════════
  describe("Rule 2: usePersonalKPIs — sem Asaas", () => {
    const file = "hooks/usePersonalKPIs.ts";

    it("should not query asaas_payments for KPIs", () => {
      const content = readFile(file);
      expect(content).not.toMatch(/asaas_payments/i);
    });

    it("should not have asaasKpiAdditions variable", () => {
      const content = readFile(file);
      expect(content).not.toMatch(/asaasKpi/i);
    });

    it("should not subscribe to asaas_payments realtime", () => {
      const content = readFile(file);
      expect(content).not.toMatch(/asaas_payments/i);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // RULE 3: PersonalAccounts page must NOT render Asaas card
  // ════════════════════════════════════════════════════════════════════════════
  describe("Rule 3: PersonalAccounts page — sem card Asaas", () => {
    const file = "pages/personal/PersonalAccounts.tsx";

    it("should not reference Asaas anywhere", () => {
      const content = readFile(file);
      const refs = findAsaasReferences(content);
      expect(refs).toEqual([]);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // RULE 4: ConsolidatedPatrimony must use COMPANY Asaas (PJ), not PF Asaas
  // ════════════════════════════════════════════════════════════════════════════
  describe("Rule 4: ConsolidatedPatrimony — Asaas via PJ only", () => {
    const file = "components/ConsolidatedPatrimony.tsx";

    it("should query company_asaas_config (not personal asaas_config)", () => {
      const content = readFile(file);
      expect(content).toMatch(/company_asaas_config/);
      expect(content).not.toMatch(/(?<!\w)asaas_config(?!_)/); // no bare "asaas_config"
    });

    it("should use company-asaas-api edge function (not personal asaas-api)", () => {
      const content = readFile(file);
      expect(content).toMatch(/company-asaas-api/);
      // Should not call the personal edge function
      expect(content).not.toMatch(/(?<!company-)asaas-api(?!-)/);
    });

    it("should fallback to company_asaas_payments (not personal asaas_payments)", () => {
      const content = readFile(file);
      expect(content).toMatch(/company_asaas_payments/);
      expect(content).not.toMatch(/(?<!\w)asaas_payments(?!_)/);
    });

    it("should add company Asaas balance to pjBalance, not pfBalance", () => {
      const content = readFile(file);
      // pjBalance should include companyAsaasBalance
      expect(content).toMatch(/pjBalance\s*=.*companyAsaas/i);
      // pfBalance should NOT include any Asaas
      const pfLine = content.split("\n").find((l) => /pfBalance\s*=/.test(l));
      if (pfLine) {
        expect(pfLine).not.toMatch(/asaas/i);
      }
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // EXTENDED AUDIT: Other personal hooks/pages that may still leak Asaas
  // (Beyond the 4 files in plan.md — discovered by the auditor)
  // ════════════════════════════════════════════════════════════════════════════
  describe("Extended: usePersonalTransactions — confusão patrimonial", () => {
    const file = "hooks/usePersonalTransactions.ts";

    it("should NOT merge asaas_payments into personal transactions", () => {
      const content = readFile(file);
      const refs = findAsaasReferences(content);
      expect(refs).toEqual([]);
    });
  });

  describe("Extended: usePersonalForecast — confusão patrimonial", () => {
    const file = "hooks/usePersonalForecast.ts";

    it("should NOT query asaas_payments for personal forecast", () => {
      const content = readFile(file);
      expect(content).not.toMatch(/asaas_payments/i);
    });
  });

  describe("Extended: usePersonalNotifications — confusão patrimonial", () => {
    const file = "hooks/usePersonalNotifications.ts";

    it("should NOT listen to asaas_webhook_events for personal notifications", () => {
      const content = readFile(file);
      expect(content).not.toMatch(/asaas_webhook_events/);
    });

    it("should NOT invalidate personal-level Asaas query caches", () => {
      const content = readFile(file);
      // Company-level invalidations are OK, personal are not
      const personalAsaasKeys = [
        "asaas_payments_kpis",
        "asaas_payments_transactions",
        "asaas_balance",
        "asaas_transfers",
        "asaas_bills",
        "asaas_subscriptions",
        "asaas_invoices",
        "asaas_anticipations",
      ];
      for (const key of personalAsaasKeys) {
        expect(content).not.toContain(`"${key}"`);
      }
    });
  });

  describe("Extended: Personal pages — Asaas UI leaks", () => {
    it("PersonalTransactions should NOT have Asaas filter/source", () => {
      const content = readFile("pages/personal/PersonalTransactions.tsx");
      // Filter tab "Asaas" should not exist
      expect(content).not.toMatch(/source.*asaas/i);
    });

    it("PersonalBills should NOT import useAsaasBills (PF hook)", () => {
      const content = readFile("pages/personal/PersonalBills.tsx");
      expect(content).not.toMatch(/useAsaasBills/);
    });

    it("PersonalTransfers should NOT import useAsaasTransfers (PF hook)", () => {
      const content = readFile("pages/personal/PersonalTransfers.tsx");
      expect(content).not.toMatch(/useAsaasTransfers/);
    });

    it("PersonalTransfers should NOT import useAsaasSubscriptions (PF hook)", () => {
      const content = readFile("pages/personal/PersonalTransfers.tsx");
      expect(content).not.toMatch(/useAsaasSubscriptions/);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // STRUCTURAL: PF hooks directory should not have personal-level Asaas hooks
  // ════════════════════════════════════════════════════════════════════════════
  describe("Structural: PF-level Asaas hooks should be removed or migrated", () => {
    const pfAsaasHooks = [
      "hooks/useAsaasBills.ts",
      "hooks/useAsaasSubscriptions.ts",
      "hooks/useAsaasTransfers.ts",
    ];

    for (const hook of pfAsaasHooks) {
      it(`${hook} should not exist (migrate to company-level or remove)`, () => {
        const fullPath = path.join(SRC, hook);
        const exists = fs.existsSync(fullPath);
        // This is a WARNING-level check: these files query personal-level
        // Asaas tables (asaas_bills, asaas_transfers, asaas_subscriptions)
        // which belong to PJ, not PF
        if (exists) {
          const content = readFile(hook);
          // At minimum, they should use company context, not user context
          expect(content).toMatch(/useCompany|company/i);
        }
      });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // GOLDEN RULE: owner_transactions is the ONLY bridge PF↔PJ
  // ════════════════════════════════════════════════════════════════════════════
  describe("Golden Rule: PF↔PJ communication only via owner_transactions", () => {
    const personalHooks = listFiles("hooks", ".ts").filter(
      (f) => /personal/i.test(f) && !f.includes(".test.")
    );

    for (const hook of personalHooks) {
      it(`${hook} should not directly query company/PJ tables`, () => {
        const content = readFile(hook);
        // Personal hooks should never directly query company-level tables
        // (except via owner_transactions)
        const forbidden = [
          /\.from\(["']transactions["']\)/,      // PJ transactions
          /\.from\(["']company_asaas/,            // company Asaas tables
          /company-asaas-api/,                    // company edge function
        ];
        for (const pattern of forbidden) {
          const match = content.match(pattern);
          if (match) {
            // owner_transactions is the exception
            expect(hook).toContain("OwnerTransaction");
          }
        }
      });
    }
  });
});
