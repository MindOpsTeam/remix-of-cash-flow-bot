/**
 * sugerir-fiscal — propõe NCM e cClassTrib para produtos sem classificação.
 *
 * Por que existe: a partir de 03/08/2026 o grupo IBS/CBS é obrigatório no
 * documento fiscal, e a LC 227/2026 art. 341-G VI põe a multa em quem
 * DESENVOLVE o software. Em produção, 22 dos 22 produtos estão sem cClassTrib.
 * Pedir para o dono da PME classificar 22 itens à mão, um a um, é o mesmo que
 * não pedir. A IA propõe o lote inteiro e ele confere.
 *
 * A regra da casa vale inteira aqui, e com um cuidado a mais porque é fiscal:
 *
 *   1. O modelo NUNCA decide sozinho. Ele PROPÕE, e a proposta só vira dado do
 *      produto quando um humano confirma na tela. Nada é gravado por aqui.
 *   2. Formato é validado deterministicamente: NCM tem 8 dígitos, cClassTrib
 *      tem 6. O que não bate vira nulo, não vira "quase certo".
 *   3. cClassTrib é conferido contra `cclasstrib_codigos`, a tabela oficial.
 *      Enquanto ela estiver VAZIA, a resposta diz `tabela_oficial: false` e a
 *      sugestão sai marcada como não conferida. Fingir validação oficial contra
 *      uma tabela vazia seria pior do que não validar.
 *   4. Todo consumo é medido em `ai_usage`.
 */

import { authenticate, jsonResp } from "../_shared/auth.ts";
import { corsPreflightResponse } from "../_shared/cors.ts";
import { chamarModelo, registrarUso } from "../_shared/ia.ts";

interface Sugestao {
  id: string;
  ncm: string | null;
  cclasstrib: string | null;
  confidence: "high" | "medium" | "low";
  justificativa: string;
  /** true quando o cClassTrib proposto existe na tabela oficial carregada. */
  cclasstrib_conferido: boolean;
}

const MAX_ITENS = 100;
const so_digitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

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

  const ids = Array.isArray(body.product_ids) ? (body.product_ids as string[]).slice(0, MAX_ITENS) : [];

  let consulta = supabase
    .from("products")
    .select("id, name, description, type, unit, sku, ncm, cclasstrib")
    .eq("company_id", companyId)
    .eq("active", true);
  if (ids.length > 0) consulta = consulta.in("id", ids);

  const [produtosRes, codigosRes] = await Promise.all([
    consulta.limit(MAX_ITENS),
    supabase.from("cclasstrib_codigos").select("codigo, descricao").eq("ativo", true).limit(300),
  ]);

  const produtos = produtosRes.data ?? [];
  if (produtos.length === 0) {
    return jsonResp({ sugestoes: [], resumo: { total: 0, custo_centavos: 0, tabela_oficial: false } }, 200, corsHeaders);
  }

  const oficiais = (codigosRes.data ?? []) as Array<{ codigo: string; descricao: string }>;
  const temTabelaOficial = oficiais.length > 0;
  const codigosValidos = new Set(oficiais.map((c) => c.codigo));

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return jsonResp({ error: "A sugestão fiscal precisa da IA configurada." }, 503, corsHeaders);
  }

  const lista = produtos
    .map((p: Record<string, unknown>, i: number) =>
      `${i}. [${p.type === "service" ? "serviço" : "mercadoria"}] ${p.name}` +
      (p.description ? ` — ${p.description}` : "") +
      (p.unit ? ` (un: ${p.unit})` : ""))
    .join("\n");

  const blocoOficial = temTabelaOficial
    ? `\n\nUse SOMENTE um destes códigos de cClassTrib:\n${oficiais.map((c) => `${c.codigo} ${c.descricao}`).join("\n")}`
    : `\n\nA tabela oficial de cClassTrib ainda não foi carregada neste ambiente. Se não tiver certeza do código, devolva cclasstrib vazio em vez de inventar.`;

  const r = await chamarModelo<{
    itens: Array<{ i: number; ncm: string; cclasstrib: string; confidence: "high" | "medium" | "low"; justificativa: string }>;
  }>(
    apiKey,
    [
      {
        role: "system",
        content:
          `Você classifica produtos e serviços de empresas brasileiras para emissão de documento fiscal.\n\n` +
          `Para cada item devolva:\n` +
          `- ncm: 8 dígitos, SOMENTE para mercadoria. Para serviço devolva vazio.\n` +
          `- cclasstrib: 6 dígitos da classificação tributária do IBS/CBS.\n` +
          `- confidence: "high" só quando o item é inequívoco pelo nome. Se o nome for genérico ` +
          `(por exemplo "serviço", "produto A", "diversos"), use "low" e devolva os campos vazios.\n` +
          `- justificativa: uma frase curta dizendo em que você se baseou.\n\n` +
          `Nunca invente código para parecer útil. Campo vazio é resposta aceitável e preferível ao chute: ` +
          `classificação fiscal errada gera multa.` + blocoOficial,
      },
      { role: "user", content: lista },
    ],
    {
      modelo: "google/gemini-2.5-flash",
      maxTokens: Math.min(16000, 800 + produtos.length * 140),
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
              required: ["i", "ncm", "cclasstrib", "confidence", "justificativa"],
              properties: {
                i: { type: "integer" },
                ncm: { type: "string" },
                cclasstrib: { type: "string" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
                justificativa: { type: "string" },
              },
            },
          },
        },
      },
    },
  );

  await registrarUso(supabase, companyId, "sugerir-fiscal", r);

  if (!r.dados) {
    return jsonResp({ error: r.erro ?? "A IA não respondeu." }, 502, corsHeaders);
  }

  const porIndice = new Map(r.dados.itens.map((it) => [it.i, it]));

  const sugestoes: Sugestao[] = produtos.map((p: Record<string, unknown>, i: number) => {
    const s = porIndice.get(i);
    const ehServico = p.type === "service";

    // Formato antes de conteúdo: NCM tem 8 dígitos e cClassTrib tem 6. O que
    // não bate não é "quase certo", é nulo.
    const ncmBruto = so_digitos(s?.ncm);
    const ncm = !ehServico && ncmBruto.length === 8 ? ncmBruto : null;

    const classBruto = so_digitos(s?.cclasstrib);
    const classFormato = classBruto.length === 6 ? classBruto : null;

    // Com tabela oficial carregada, código fora dela é recusado. Sem tabela, a
    // sugestão passa mas sai marcada como NÃO conferida.
    const conferido = classFormato !== null && temTabelaOficial && codigosValidos.has(classFormato);
    const cclasstrib = temTabelaOficial ? (conferido ? classFormato : null) : classFormato;

    return {
      id: String(p.id),
      ncm,
      cclasstrib,
      confidence: s?.confidence ?? "low",
      justificativa: s?.justificativa ?? "",
      cclasstrib_conferido: conferido,
    };
  });

  return jsonResp(
    {
      sugestoes,
      resumo: {
        total: sugestoes.length,
        com_ncm: sugestoes.filter((s) => s.ncm).length,
        com_cclasstrib: sugestoes.filter((s) => s.cclasstrib).length,
        conferidos_na_tabela_oficial: sugestoes.filter((s) => s.cclasstrib_conferido).length,
        tabela_oficial: temTabelaOficial,
        custo_centavos: Number(r.custoCentavos.toFixed(4)),
      },
    },
    200,
    corsHeaders,
  );
});
