import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Contrato de credenciais da Solução whitelabel.
 *
 * Duas regras que, se quebrarem, só aparecem quando um cliente faz o remix:
 *  1. nenhuma chave de terceiro pode ser lida de variável de ambiente, porque
 *     o Lovable varre o código e monta a tela "Update secrets" na importação;
 *  2. nenhuma credencial pode ser lida de coluna de tabela, porque o valor foi
 *     migrado para o Vault e as colunas ficaram vazias.
 *
 * Estes testes falham no CI antes de o defeito chegar num remix.
 */

const FUNCTIONS_DIR = join(process.cwd(), "supabase", "functions");

/** Provisionadas pelo Lovable Cloud: não geram tela de secret. */
const ENV_PERMITIDAS = new Set([
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL",
  "LOVABLE_API_KEY",
]);

/** Colunas de credencial que foram migradas para o Vault. */
const COLUNAS_MIGRADAS = [
  "api_key_production",
  "api_key_sandbox",
  "webhook_auth_token",
  "evolution_api_key",
];

function arquivosTs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const saida: string[] = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) saida.push(...arquivosTs(caminho));
    else if (entrada.name.endsWith(".ts")) saida.push(caminho);
  }
  return saida;
}

const ARQUIVOS = arquivosTs(FUNCTIONS_DIR);

describe("nenhuma chave de terceiro no ambiente", () => {
  it("encontra as edge functions para auditar", () => {
    expect(ARQUIVOS.length).toBeGreaterThan(30);
  });

  it("só lê env provisionada pelo Cloud", () => {
    const infratores: string[] = [];

    for (const arquivo of ARQUIVOS) {
      const conteudo = readFileSync(arquivo, "utf-8");
      for (const achado of conteudo.matchAll(/Deno\.env\.get\(\s*["'`]([A-Z0-9_]+)["'`]\s*\)/g)) {
        const nome = achado[1];
        if (!ENV_PERMITIDAS.has(nome)) {
          infratores.push(`${arquivo.replace(FUNCTIONS_DIR, "")} lê ${nome}`);
        }
      }
    }

    // mensagem explica o efeito, não só o erro
    expect(
      infratores,
      `Leitura de env não permitida. Cada nome vira um campo obrigatório na tela ` +
        `"Update secrets" do remix e trava o cliente na importação. ` +
        `Mova a credencial para o Vault (set_integration_secret / get_integration_secret).\n` +
        infratores.join("\n"),
    ).toEqual([]);
  });

  it("CRON_SECRET não é lido do ambiente", () => {
    const comCron = ARQUIVOS.filter((a) =>
      /Deno\.env\.get\(\s*["'`]CRON_SECRET["'`]/.test(readFileSync(a, "utf-8")),
    );
    expect(comCron, "o segredo do cron vem de get_cron_secret(), lido do Vault").toEqual([]);
  });
});

describe("credenciais vêm do cofre, não da coluna", () => {
  it("existe o helper de leitura do Vault", () => {
    const helper = join(FUNCTIONS_DIR, "_shared", "segredos.ts");
    expect(existsSync(helper)).toBe(true);
    const conteudo = readFileSync(helper, "utf-8");
    expect(conteudo).toContain("get_integration_secret");
    expect(conteudo).toContain("segredoDaIntegracao");
  });

  it("o helper do cron lê do Vault e não do ambiente", () => {
    const cron = readFileSync(join(FUNCTIONS_DIR, "_shared", "cron.ts"), "utf-8");
    expect(cron).toContain("get_cron_secret");
    expect(cron).not.toMatch(/Deno\.env\.get\(\s*["'`]CRON_SECRET/);
  });

  it("nenhuma function usa coluna de credencial já migrada", () => {
    const infratores: string[] = [];

    for (const arquivo of ARQUIVOS) {
      if (arquivo.includes("_shared/segredos.ts")) continue;
      const conteudo = readFileSync(arquivo, "utf-8");
      for (const coluna of COLUNAS_MIGRADAS) {
        // uso como propriedade (config.api_key_production), não em select() nem comentário
        const regex = new RegExp(`(?<![\\w"'\`.])\\w+\\.${coluna}\\b`, "g");
        for (const achado of conteudo.matchAll(regex)) {
          const linha = conteudo.slice(0, achado.index).split("\n").length;
          const texto = conteudo.split("\n")[linha - 1].trim();
          if (texto.startsWith("//") || texto.startsWith("*")) continue;
          // atribuição para preencher a partir do cofre é o padrão correto
          if (/=\s*(await\s+)?segredo/.test(texto)) continue;
          infratores.push(`${arquivo.replace(FUNCTIONS_DIR, "")}:${linha} ${texto.slice(0, 70)}`);
        }
      }
    }

    expect(
      infratores,
      `Credencial lida de coluna. As colunas foram esvaziadas na migration ` +
        `20260819180000 e o SELECT delas é revogado do cliente: o valor vem ` +
        `de segredoDaIntegracao().\n` + infratores.join("\n"),
    ).toEqual([]);
  });
});

describe("migrations do cofre estão versionadas", () => {
  const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

  it("a migration do cron secret existe e usa o nome maiúsculo", () => {
    const arquivo = join(MIGRATIONS, "20260819160000_cron_secret_no_vault.sql");
    expect(existsSync(arquivo)).toBe(true);
    const sql = readFileSync(arquivo, "utf-8");
    // chamar_funcao_agendada lê 'CRON_SECRET'; divergir o caso derruba os crons
    expect(sql).toContain("'CRON_SECRET'");
    expect(sql).toContain("get_cron_secret");
    expect(sql).toContain("grant execute on function public.get_cron_secret() to service_role");
    // o remix copia estrutura e não dados: o segredo tem que nascer na leitura,
    // não num bloco DO de migration (que não roda no remix)
    expect(sql).toContain("ensure_cron_secret");
    expect(sql, "provisionamento por DO block não sobrevive ao remix").not.toMatch(
      /do \$\$[\s\S]*vault\.create_secret/,
    );
  });

  it("a migration das credenciais cria as três RPCs e tranca a leitura", () => {
    const arquivo = join(MIGRATIONS, "20260819180000_credenciais_no_vault.sql");
    expect(existsSync(arquivo)).toBe(true);
    const sql = readFileSync(arquivo, "utf-8");

    expect(sql).toContain("set_integration_secret");
    expect(sql).toContain("get_integration_secret");
    expect(sql).toContain("integration_secrets_status");

    // get_ é o único que devolve valor: não pode chegar ao browser
    expect(sql).toMatch(
      /revoke execute on function public\.get_integration_secret\(uuid, text, text\) from public, anon, authenticated/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.get_integration_secret\(uuid, text, text\) to service_role/,
    );

    // revoke de coluna isolado é no-op: tem que revogar a tabela e regrantear
    for (const tabela of [
      "company_asaas_config",
      "inter_config",
      "plugnotas_config",
      "whatsapp_configs",
    ]) {
      expect(sql, `${tabela} precisa de revoke da tabela`).toContain(
        `revoke select on public.${tabela} from anon, authenticated`,
      );
    }

    // segredo órfão no cofre quando a empresa é apagada
    expect(sql).toContain("limpar_secrets_da_empresa");
  });
});


describe("a UI grava no cofre e nunca lê o valor", () => {
  const IO = readFileSync(join(process.cwd(), "src", "lib", "integracoes-io.ts"), "utf-8");

  it("grava por set_integration_secret", () => {
    expect(IO).toContain("set_integration_secret");
  });

  it("consulta status por integration_secrets_status, que devolve booleanos", () => {
    expect(IO).toContain("integration_secrets_status");
  });

  it("não grava credencial em coluna de tabela", () => {
    // Só conta gravação em COLUNA. Parâmetro de RPC (p_client_secret:) é o
    // caminho correto, porque a própria RPC guarda no cofre.
    const emColuna = [
      /(?<!p_)api_key_production:/,
      /(?<!p_)api_key_sandbox:/,
      /(?<!p_)evolution_api_key:/,
      /(?<!p_)client_secret:/,
      /api_key: v\.api_key/,
    ];
    for (const padrao of emColuna) {
      expect(
        IO,
        `${padrao} grava credencial em coluna: deve ir para o Vault por set_integration_secret`,
      ).not.toMatch(padrao);
    }
  });

  it("não seleciona coluna de credencial revogada", () => {
    for (const proibido of [
      'select("api_key_sandbox, api_key_production")',
      'select("api_key")',
    ]) {
      expect(IO, `${proibido} falha: o SELECT dessas colunas foi revogado`).not.toContain(proibido);
    }
  });
});


describe("catálogo: toda credencial declara o cofre", () => {
  const CAT = readFileSync(join(process.cwd(), "src", "lib", "integracoes-catalogo.ts"), "utf-8");

  it("nenhuma integração diz que guarda segredo em tabela", () => {
    // A UI mostra ao usuário onde a credencial fica. Depois da migration
    // 20260819180000 todas vão para o Vault: dizer "tabela" seria mentir para
    // quem está decidindo se confia o dado bancário ao sistema.
    expect(CAT, 'ondeFicaGuardado: "tabela" não existe mais').not.toContain(
      'ondeFicaGuardado: "tabela"',
    );
  });

  it("toda integração com campo secreto tem guia de como obter", () => {
    // sem guia, o admin do remix trava e abre chamado, e a Solução não tem suporte
    const blocos = CAT.split(/\n  \{\n    id: "/).slice(1);
    const semGuia = blocos
      .filter((b) => b.includes("segredo: true") && !b.includes("guia:"))
      .map((b) => b.slice(0, b.indexOf('"')));
    expect(semGuia, `integrações sem guia: ${semGuia.join(", ")}`).toEqual([]);
  });
});
