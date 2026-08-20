import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CATALOGO_INTEGRACOES } from "@/lib/integracoes-catalogo";
import { IDS_COM_DETECCAO } from "@/lib/integracoes-io";

/**
 * O catálogo declara e o executor cumpre. Quando os dois saem de sincronia, o
 * defeito é sempre silencioso e sempre do mesmo tipo: a tela mostra o
 * formulário, o admin preenche, e nada acontece.
 *
 * Já aconteceu de verdade: a integração "certificado" existia no catálogo com
 * dois campos obrigatórios e NÃO tinha case no salvarIntegracao. O admin subia
 * o .pfx, digitava a senha e recebia "Integração desconhecida". Só descobria
 * quando a primeira nota não assinava.
 *
 * Estes testes leem o código-fonte de propósito: é o único jeito de provar que
 * cada id tem tratamento sem importar e executar I/O real.
 */

const FONTE_IO = readFileSync(resolve(__dirname, "../lib/integracoes-io.ts"), "utf8");

/** Corpo da função pedida, do `{` até a próxima declaração de topo. */
function corpoDaFuncao(nome: string): string {
  const i = FONTE_IO.indexOf(`export async function ${nome}`);
  if (i < 0) throw new Error(`função ${nome} não encontrada em integracoes-io.ts`);
  const resto = FONTE_IO.slice(i + 1);
  const fim = resto.indexOf("\nexport ");
  return fim > 0 ? resto.slice(0, fim) : resto;
}

const CORPO_SALVAR = corpoDaFuncao("salvarIntegracao");
const CORPO_TESTAR = corpoDaFuncao("testarIntegracao");

describe("toda integração do catálogo sabe salvar", () => {
  for (const integ of CATALOGO_INTEGRACOES) {
    it(`${integ.id} tem case no salvarIntegracao`, () => {
      expect(
        CORPO_SALVAR.includes(`case "${integ.id}"`),
        `"${integ.id}" está no catálogo mas cai no default do salvarIntegracao: o formulário aparece e não grava nada.`,
      ).toBe(true);
    });
  }
});

describe("toda integração marcada como testável tem como ser testada", () => {
  for (const integ of CATALOGO_INTEGRACOES.filter((i) => i.testavel)) {
    it(`${integ.id} aparece no testarIntegracao`, () => {
      expect(
        CORPO_TESTAR.includes(`${integ.id}:`) || CORPO_TESTAR.includes(`"${integ.id}"`),
        `"${integ.id}" promete botão de testar e não tem chamada: a tela diz "esta integração não tem teste automático".`,
      ).toBe(true);
    });
  }
});

describe("toda integração é detectável como configurada", () => {
  for (const integ of CATALOGO_INTEGRACOES) {
    it(`${integ.id} está em IDS_COM_DETECCAO`, () => {
      expect(
        (IDS_COM_DETECCAO as readonly string[]).includes(integ.id),
        `sem detecção, "${integ.id}" aparece como não configurado para sempre e o progresso nunca chega a 100%.`,
      ).toBe(true);
    });
  }
});

describe("campos que representam a mesma coisa usam a mesma chave", () => {
  it("o certificado A1 tem uma única chave em todo o catálogo", () => {
    // nfse e certificado gravam na MESMA coluna; chaves diferentes fariam uma
    // tela sobrescrever a outra com o campo errado.
    const chaves = new Set<string>();
    for (const integ of CATALOGO_INTEGRACOES) {
      for (const campo of integ.campos) {
        if (/^cert_pfx/.test(campo.key)) chaves.add(campo.key);
      }
    }
    expect([...chaves]).toEqual(["cert_pfx_base64"]);
  });

  it("arquivo de certificado é sempre tratado como segredo", () => {
    for (const integ of CATALOGO_INTEGRACOES) {
      for (const campo of integ.campos) {
        if (campo.key === "cert_pfx_base64") {
          expect(campo.segredo, `${integ.id}.${campo.key} precisa ser segredo`).toBe(true);
        }
      }
    }
  });
});

describe("as chamadas de teste usam operação que a edge conhece", () => {
  /** Operações aceitas pelo switch de supabase/functions/nfse-operations. */
  const OPS_NFSE = ["status", "validar_dps", "cancelar", "consultar_chave", "parametros_municipio", "codigos_servico"];

  it("nfse-operations é chamada com operação existente", () => {
    // "parse_cert" era chamado e não existia no switch. Como a função não tinha
    // default, respondia 200 com data indefinido e a tela dizia "conexão
    // bem-sucedida" sem ter testado nada.
    const chamadas = [...CORPO_TESTAR.matchAll(/fn: "nfse-operations"[^\n]*operation: "([^"]+)"/g)];
    expect(chamadas.length, "esperava ao menos uma chamada a nfse-operations").toBeGreaterThan(0);
    for (const [, op] of chamadas) {
      expect(OPS_NFSE, `operação "${op}" não existe no switch da edge`).toContain(op);
    }
  });

  it("parse_cert não volta como operação (o comentário que explica o defeito pode ficar)", () => {
    expect(FONTE_IO).not.toContain('operation: "parse_cert"');
  });
});
