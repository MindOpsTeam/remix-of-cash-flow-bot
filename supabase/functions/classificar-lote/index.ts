/**
 * classificar-lote — classifica muitos lançamentos numa chamada só.
 *
 * Existe porque importar 90 dias de extrato com uma chamada de modelo POR LINHA
 * é caro e lento. Aqui a ordem é a da casa:
 *
 *   1. Regra aprendida da empresa   → zero token, resposta estável
 *   2. O que sobrou, em UMA chamada → o modelo vê o lote inteiro de uma vez
 *   3. Tudo validado contra o plano de contas real da empresa
 *
 * Numa segunda importação do mesmo banco, a maior parte cai na etapa 1 e o
 * custo tende a zero. É esse o desenho que faz a IA ficar mais barata conforme
 * o cliente usa, em vez de mais cara.
 */

import { authenticate, jsonResp } from "../_shared/auth.ts";
import { corsPreflightResponse } from "../_shared/cors.ts";
import { chamarModelo, registrarUso, normalizarDescricao } from "../_shared/ia.ts";

interface ItemEntrada {
  descricao: string;
  tipo: "revenue" | "expense";
}

/** Correção que o humano fez na tela de revisão e que vira regra. */
interface Aprendizado {
  descricao: string;
  account_id: string;
  cost_center_id?: string | null;
}

interface ItemSaida {
  indice: number;
  account_id: string | null;
  cost_center_id: string | null;
  confidence: "high" | "medium" | "low";
  origem: "regra" | "ia" | "nenhuma";
}

const MAX_ITENS = 300;

Deno.serve(async (req: Request) => {
  const pre = corsPreflightResponse(req);
  if (pre) return pre;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResp({ error: "JSON inválido" }, 400, {});
  }

  const companyId = String(body.company_id ?? "");
  if (!companyId) return jsonResp({ error: "company_id é obrigatório" }, 400, {});

  const auth = await authenticate(req, { requireCompany: companyId });
  if (auth instanceof Response) return auth;
  const { supabase, corsHeaders } = auth;

  // ── Modo aprendizado: a tela manda a descrição CRUA e quem normaliza é aqui.
  // O padrão da regra tem que sair do mesmo normalizador que faz a busca, senão
  // a regra gravada nunca casa com o lançamento seguinte. Uma régua só.
  if (Array.isArray(body.aprender)) {
    const aprender = (body.aprender as Aprendizado[]).filter(
      (a) => a && typeof a.descricao === "string" && typeof a.account_id === "string",
    );
    if (!aprender.length) return jsonResp({ aprendidas: 0 }, 200, corsHeaders);

    const { data: contasOk } = await supabase
      .from("chart_of_accounts").select("id").eq("company_id", companyId);
    const permitidas = new Set((contasOk ?? []).map((c: { id: string }) => c.id));

    const regras = aprender
      .map((a) => ({
        company_id: companyId,
        padrao: normalizarDescricao(a.descricao),
        account_id: a.account_id,
        cost_center_id: a.cost_center_id ?? null,
        origem: "humano",
      }))
      .filter((r) => r.padrao.length >= 3 && permitidas.has(r.account_id));

    if (!regras.length) return jsonResp({ aprendidas: 0 }, 200, corsHeaders);

    const { error } = await supabase
      .from("classification_rules")
      .upsert(regras, { onConflict: "company_id,padrao" });
    if (error) return jsonResp({ error: error.message }, 400, corsHeaders);

    return jsonResp({ aprendidas: regras.length }, 200, corsHeaders);
  }

  const itens = (Array.isArray(body.itens) ? body.itens : []) as ItemEntrada[];
  if (!itens.length) return jsonResp({ error: "Nenhum item para classificar." }, 400, corsHeaders);
  if (itens.length > MAX_ITENS) {
    return jsonResp({ error: `Máximo de ${MAX_ITENS} lançamentos por vez.` }, 400, corsHeaders);
  }

  const [contasRes, centrosRes, regrasRes] = await Promise.all([
    supabase.from("chart_of_accounts").select("id, name, code, type").eq("company_id", companyId),
    supabase.from("cost_centers").select("id, name").eq("company_id", companyId).eq("active", true),
    supabase.from("classification_rules").select("padrao, account_id, cost_center_id").eq("company_id", companyId),
  ]);

  const contas = contasRes.data ?? [];
  const centros = centrosRes.data ?? [];
  const idsContas = new Set(contas.map((c: { id: string }) => c.id));
  const idsCentros = new Set(centros.map((c: { id: string }) => c.id));

  const regras = new Map<string, { account_id: string; cost_center_id: string | null }>();
  for (const r of regrasRes.data ?? []) {
    if (r.account_id) regras.set(r.padrao, { account_id: r.account_id, cost_center_id: r.cost_center_id });
  }

  const saidas: ItemSaida[] = new Array(itens.length);
  const pendentes: Array<{ indice: number; item: ItemEntrada }> = [];

  // ── 1. Regra aprendida
  itens.forEach((item, i) => {
    const chave = normalizarDescricao(item.descricao);
    const regra = chave ? regras.get(chave) : undefined;
    if (regra && idsContas.has(regra.account_id)) {
      saidas[i] = {
        indice: i,
        account_id: regra.account_id,
        cost_center_id: regra.cost_center_id && idsCentros.has(regra.cost_center_id) ? regra.cost_center_id : null,
        confidence: "high",
        origem: "regra",
      };
    } else {
      pendentes.push({ indice: i, item });
    }
  });

  // ── 2. O resto, numa chamada só
  let custoTotal = 0;
  if (pendentes.length > 0) {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      pendentes.forEach(({ indice }) => {
        saidas[indice] = { indice, account_id: null, cost_center_id: null, confidence: "low", origem: "nenhuma" };
      });
    } else {
      const listaContas = contas
        .map((c: { code: string; name: string; type: string; id: string }) => `${c.code} ${c.name} (${c.type}) [${c.id}]`)
        .join("\n");
      const listaCentros = centros.map((c: { name: string; id: string }) => `${c.name} [${c.id}]`).join("\n");
      const lote = pendentes
        .map(({ item }, n) => `${n}. [${item.tipo === "revenue" ? "entrada" : "saída"}] ${item.descricao}`)
        .join("\n");

      const r = await chamarModelo<{ itens: Array<{ i: number; account_id: string | null; cost_center_id: string | null; confidence: "high" | "medium" | "low" }> }>(
        apiKey,
        [
          {
            role: "system",
            content: `Você classifica lançamentos de extrato bancário de uma empresa brasileira no plano de contas dela.

Contas:
${listaContas}

Centros de custo:
${listaCentros}

Devolva um item para CADA número recebido, usando o id exato de uma conta da lista. Entrada só pode receber conta de receita, saída só conta de despesa. Se nenhuma conta servir, devolva account_id nulo com confidence "low". Nunca invente id.`,
          },
          { role: "user", content: lote },
        ],
        {
          modelo: "google/gemini-2.5-flash-lite",
          maxTokens: Math.min(4000, 120 + pendentes.length * 60),
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["itens"],
            properties: {
              itens: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["i", "account_id", "cost_center_id", "confidence"],
                  properties: {
                    i: { type: "integer" },
                    account_id: { type: ["string", "null"] },
                    cost_center_id: { type: ["string", "null"] },
                    confidence: { type: "string", enum: ["high", "medium", "low"] },
                  },
                },
              },
            },
          },
        },
      );

      await registrarUso(supabase, companyId, "classificar-lote", r);
      custoTotal = r.custoCentavos;

      const porIndice = new Map<number, { account_id: string | null; cost_center_id: string | null; confidence: "high" | "medium" | "low" }>();
      for (const linha of r.dados?.itens ?? []) porIndice.set(linha.i, linha);

      pendentes.forEach(({ indice }, n) => {
        const sugestao = porIndice.get(n);
        const contaValida = sugestao?.account_id && idsContas.has(sugestao.account_id) ? sugestao.account_id : null;
        const centroValido = sugestao?.cost_center_id && idsCentros.has(sugestao.cost_center_id) ? sugestao.cost_center_id : null;
        saidas[indice] = {
          indice,
          account_id: contaValida,
          cost_center_id: centroValido,
          confidence: contaValida ? (sugestao?.confidence ?? "medium") : "low",
          origem: contaValida ? "ia" : "nenhuma",
        };
      });
    }
  }

  return jsonResp(
    {
      itens: saidas,
      resumo: {
        total: itens.length,
        por_regra: saidas.filter((s) => s.origem === "regra").length,
        por_ia: saidas.filter((s) => s.origem === "ia").length,
        sem_classificacao: saidas.filter((s) => s.origem === "nenhuma").length,
        custo_centavos: Number(custoTotal.toFixed(4)),
      },
    },
    200,
    corsHeaders,
  );
});
