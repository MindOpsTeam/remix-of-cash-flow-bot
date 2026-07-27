#!/usr/bin/env python3
"""Gera o mapa HTML da plataforma a partir do modelo levantado."""
import json, os, re, html

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.expanduser("~/remix-of-cash-flow-bot")
m = json.load(open(os.path.join(AQUI, "plataforma-modelo.json")))
T = m["tabelas"]

# --------------------------------------------------------------- navegação real
side = open(f"{REPO}/src/components/AppSidebar.tsx", encoding="utf-8").read()
bloco = side[side.find("const sections"):]
bloco = bloco[: bloco.find("\n];")]
secoes = []
for grupo in re.finditer(r'label:\s*"([^"]+)",\s*\n\s*icon:[^\n]*\n\s*personas:\s*\[([^\]]*)\],\s*\n\s*items:\s*\[(.*?)\n\s*\],', bloco, re.S):
    itens = re.findall(r'\{\s*to:\s*"([^"]+)",\s*label:\s*"([^"]+)"', grupo.group(3))
    secoes.append({"nome": grupo.group(1), "personas": grupo.group(2).replace('"', '').strip(),
                   "itens": [{"rota": r, "nome": n} for r, n in itens]})

# --------------------------------------------------------------- domínios
DOMINIOS = [
    ("Tenancy", "quem é a empresa e quem pode ver", ["companies", "company_members", "api_keys"]),
    ("Razão (fonte da verdade)", "todo número do DRE nasce aqui", ["transactions", "chart_of_accounts", "cost_centers", "bank_accounts", "monthly_close", "budgets"]),
    ("A receber", "o que deve entrar", ["contracts", "receivables", "invoices", "sales_orders", "sales_order_items"]),
    ("A pagar", "o que deve sair", ["bills_payable", "purchase_orders", "purchase_order_items"]),
    ("Banco e Open Finance", "o que entrou de fato", ["bank_connections", "bank_transactions_raw", "openfinance_config", "inter_config", "reconciliation_log"]),
    ("Fiscal", "nota, imposto e arquivo", ["nfse_config", "plugnotas_config", "plugnotas_documents", "focus_config", "tax_guides", "tax_rates", "municipalities", "fiscal_files"]),
    ("Cobrança (Asaas)", "boleto e assinatura por empresa", [t for t in T if t.startswith("company_asaas_")]),
    ("Cadastros", "com quem se opera", ["contacts", "products", "warehouses", "stock_movements"]),
    ("Canais e automação", "WhatsApp, webhooks e agentes", ["whatsapp_configs", "whatsapp_messages", "whatsapp_pending_actions", "webhooks", "webhook_logs", "agent_actions"]),
    ("Sócio ↔ Empresa", "a ponte PF/PJ", ["owner_transactions", "company_journal_entries", "journal_entries"]),
    ("Legado desligado", "existe no banco, ninguém usa", [t for t in T if t.startswith("personal_")] + [t for t in T if t.startswith("asaas_")] + ["user_preferences"]),
]

FLUXO = {
    "entradas": [
        ("Open Finance", "Pluggy traz extrato, cartão e investimento", "bank_transactions_raw", "openfinance-connect · openfinance-sync"),
        ("Cobrança Asaas", "boleto pago vira receita", "company_asaas_payments", "company-asaas-webhook"),
        ("Contratos", "recorrência gera o que deve entrar", "receivables", "contracts-billing"),
        ("Nota fiscal", "três emissores, um destino", "invoices · plugnotas_documents", "nfse-proxy · plugnotas-* · focus-nfe"),
        ("Scanner e OCR", "documento vira lançamento", "transactions", "ocr-document"),
        ("WhatsApp", "conversa vira ação", "whatsapp_messages", "whatsapp-webhook"),
        ("Digitação", "lançamento manual e importação", "transactions", "UI"),
    ],
    "saidas": [
        ("DRE", "receita, custo e despesa pela régua única", "/dre"),
        ("Fechamento mensal", "trava o período", "/close"),
        ("Orçamento × realizado", "meta contra fato", "/budget"),
        ("Previsão de caixa", "projeção com IA", "/forecast"),
        ("Consolidação do grupo", "vários CNPJs somados", "/settings/consolidation"),
        ("Simulador da Reforma", "carga tributária 2027-2033", "/reforma"),
        ("CFO Digital e agentes", "leitura e ação automática", "/cfo-digital"),
        ("API pública", "BI e planilha do cliente", "/settings/api"),
    ],
}

INTEGRACOES = [
    ("Open Finance", "Pluggy", "entrada de extrato", "openfinance_config", "/settings/integrations/openfinance"),
    ("Cobrança", "Asaas", "boleto, assinatura e recebimento", "company_asaas_config", "/settings/integrations/asaas"),
    ("Banco", "Inter", "extrato e saldo por API oficial", "inter_config", "/settings/integrations/inter"),
    ("Nota fiscal", "NFS-e Nacional", "padrão da Receita, certificado A1", "nfse_config", "/settings/integrations/nfse"),
    ("Nota fiscal", "PlugNotas", "NF-e, NFS-e, NFC-e, CT-e, MDF-e", "plugnotas_config", "/settings/integrations/plugnotas"),
    ("Nota fiscal", "Focus NFe", "todos os documentos numa API", "focus_config", "/settings/integrations/focus"),
]

SEV = {"CRITICA": ("critico", "crítica"), "ALTA": ("alto", "alta"), "MEDIA": ("medio", "média"), "BAIXA": ("baixo", "baixa")}
e = html.escape

def chip_tabela(t):
    if t not in T:
        return f'<span class="tab ausente">{e(t)}</span>'
    i = T[t]
    morta = not i["lido_por"] and not i["escrito_por"]
    cls = "tab morta" if morta else "tab"
    return (f'<span class="{cls}" title="{i["linhas"]} linhas · {i["policies"]} policies · '
            f'lido por {len(i["lido_por"])} · escrito por {len(i["escrito_por"])}">'
            f'{e(t)}<b>{i["linhas"]}</b></span>')

achados_html = "".join(
    f'<tr><td><span class="sev {SEV[a["severidade"]][0]}">{SEV[a["severidade"]][1]}</span></td>'
    f'<td class="mono">{e(a["alvo"])}</td><td>{e(a["descricao"])}'
    + (f'<span class="ev">{e(a["evidencia"])}</span>' if a["evidencia"] else "")
    + f'</td><td class="mono dim">{e(a["tipo"])}</td></tr>'
    for a in m["achados"])

dominios_html = ""
for nome, sub, tabs in DOMINIOS:
    tabs = [t for t in tabs if t in T]
    if not tabs:
        continue
    linhas = sum(T[t]["linhas"] for t in tabs)
    dominios_html += (
        f'<article class="dom"><header><h3>{e(nome)}</h3><span class="dim">{e(sub)}</span>'
        f'<span class="cnt">{len(tabs)} tabelas · {linhas} linhas</span></header>'
        f'<div class="tabs">{"".join(chip_tabela(t) for t in sorted(tabs))}</div></article>')

entradas_html = "".join(
    f'<li><b>{e(n)}</b><span class="dim">{e(d)}</span><code>{e(tab)}</code><span class="fn">{e(fn)}</span></li>'
    for n, d, tab, fn in FLUXO["entradas"])
saidas_html = "".join(
    f'<li><b>{e(n)}</b><span class="dim">{e(d)}</span><code>{e(r)}</code></li>'
    for n, d, r in FLUXO["saidas"])

integr_html = "".join(
    f'<tr><td class="mono dim">{e(c)}</td><td><b>{e(nome)}</b></td><td>{e(desc)}</td>'
    f'<td>{chip_tabela(tab)}</td><td class="mono dim">{e(rota)}</td></tr>'
    for c, nome, desc, tab, rota in INTEGRACOES)

nav_html = ""
for s in secoes:
    itens = "".join(f'<li>{e(i["nome"])}<code>{e(i["rota"])}</code></li>' for i in s["itens"])
    nav_html += (f'<article class="sec"><header><h3>{e(s["nome"])}</h3>'
                 f'<span class="dim">{e(s["personas"]) or "todas as personas"}</span></header>'
                 f'<ul class="rotas">{itens}</ul></article>')

edges = m["edge_functions"]
inv = m["edge_invocadas_pela_ui"]
edges_html = "".join(
    f'<span class="tab{"" if f in inv else " cron"}" title="{"chamada pela tela" if f in inv else "webhook, cron ou chamada externa"}">{e(f)}</span>'
    for f in edges)

r = m["resumo"]
alta = sum(1 for a in m["achados"] if a["severidade"] in ("CRITICA", "ALTA"))

HTML = f"""<title>FinanceAI · mapa da plataforma</title>
<style>
:root {{
  --papel:#eef1f5; --sup:#ffffff; --linha:#c9d2de; --tinta:#101a26; --dim:#5b6a7d;
  --fluxo:#0f6f8c; --fluxo-fraco:#d6eaf1;
  --ok:#1a7f45; --atencao:#a8620a; --critico:#a81f1f;
  --sombra:0 1px 2px rgba(16,26,38,.06),0 8px 24px -18px rgba(16,26,38,.5);
}}
@media (prefers-color-scheme: dark) {{
  :root {{ --papel:#0b1219; --sup:#121c26; --linha:#25333f; --tinta:#e6edf4; --dim:#8a9cae;
    --fluxo:#4bb8d6; --fluxo-fraco:#12303c; --ok:#5cc98b; --atencao:#e0a34a; --critico:#f0817c;
    --sombra:0 1px 2px rgba(0,0,0,.4),0 10px 30px -20px #000; }}
}}
:root[data-theme="dark"] {{ --papel:#0b1219; --sup:#121c26; --linha:#25333f; --tinta:#e6edf4; --dim:#8a9cae;
  --fluxo:#4bb8d6; --fluxo-fraco:#12303c; --ok:#5cc98b; --atencao:#e0a34a; --critico:#f0817c;
  --sombra:0 1px 2px rgba(0,0,0,.4),0 10px 30px -20px #000; }}
:root[data-theme="light"] {{ --papel:#eef1f5; --sup:#ffffff; --linha:#c9d2de; --tinta:#101a26; --dim:#5b6a7d;
  --fluxo:#0f6f8c; --fluxo-fraco:#d6eaf1; --ok:#1a7f45; --atencao:#a8620a; --critico:#a81f1f;
  --sombra:0 1px 2px rgba(16,26,38,.06),0 8px 24px -18px rgba(16,26,38,.5); }}

* {{ box-sizing:border-box; }}
body {{ margin:0; background:var(--papel); color:var(--tinta); font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
  font-size:15px; line-height:1.55; -webkit-font-smoothing:antialiased; }}
.mono, code, .tab, .cnt, .sev {{ font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace; }}
.wrap {{ max-width:1180px; margin:0 auto; padding:40px 22px 90px; }}
.dim {{ color:var(--dim); }}

header.topo {{ border-bottom:2px solid var(--tinta); padding-bottom:18px; margin-bottom:26px; }}
.olho {{ font-family:ui-monospace,monospace; font-size:11px; letter-spacing:.16em; text-transform:uppercase;
  color:var(--fluxo); margin:0 0 8px; }}
h1 {{ font-size:clamp(26px,4vw,40px); margin:0 0 6px; letter-spacing:-.02em; text-wrap:balance; }}
h1 small {{ display:block; font-size:15px; font-weight:400; color:var(--dim); letter-spacing:0; margin-top:6px; }}

.stats {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:1px;
  background:var(--linha); border:1px solid var(--linha); margin:26px 0 42px; }}
.stat {{ background:var(--sup); padding:14px 16px; }}
.stat b {{ display:block; font-family:ui-monospace,monospace; font-size:26px; font-variant-numeric:tabular-nums; letter-spacing:-.02em; }}
.stat span {{ font-size:11px; text-transform:uppercase; letter-spacing:.09em; color:var(--dim); }}
.stat.alerta b {{ color:var(--atencao); }}

h2 {{ font-size:12px; text-transform:uppercase; letter-spacing:.15em; color:var(--dim);
  border-top:1px solid var(--linha); padding-top:14px; margin:52px 0 18px; font-weight:600; }}
h2 em {{ font-style:normal; color:var(--fluxo); }}

.fluxo {{ display:grid; grid-template-columns:1fr auto 1fr; gap:20px; align-items:start; }}
@media (max-width:820px) {{ .fluxo {{ grid-template-columns:1fr; }} .nucleo-seta {{ display:none; }} }}
.fluxo ul {{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }}
.fluxo li {{ background:var(--sup); border:1px solid var(--linha); border-left:3px solid var(--fluxo);
  padding:10px 13px; box-shadow:var(--sombra); }}
.fluxo li b {{ display:block; font-size:14px; }}
.fluxo li .dim {{ display:block; font-size:12.5px; }}
.fluxo li code {{ display:inline-block; font-size:11px; background:var(--fluxo-fraco); color:var(--fluxo);
  padding:1px 6px; margin-top:5px; }}
.fluxo li .fn {{ display:block; font-family:ui-monospace,monospace; font-size:10.5px; color:var(--dim); margin-top:3px; }}
.nucleo {{ background:var(--tinta); color:var(--papel); padding:22px 18px; text-align:center; align-self:center;
  min-width:190px; box-shadow:var(--sombra); }}
.nucleo strong {{ display:block; font-family:ui-monospace,monospace; font-size:17px; letter-spacing:-.01em; }}
.nucleo span {{ display:block; font-size:11.5px; opacity:.72; margin-top:8px; line-height:1.45; }}
.nucleo .regra {{ margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,255,255,.18);
  font-family:ui-monospace,monospace; font-size:10.5px; opacity:.9; }}

.grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:14px; }}
.dom, .sec {{ background:var(--sup); border:1px solid var(--linha); padding:14px; box-shadow:var(--sombra); }}
.dom header, .sec header {{ display:flex; flex-wrap:wrap; align-items:baseline; gap:8px; margin-bottom:10px; }}
.dom h3, .sec h3 {{ margin:0; font-size:14.5px; }}
.dom .dim, .sec .dim {{ font-size:12px; }}
.cnt {{ margin-left:auto; font-size:10.5px; color:var(--dim); font-variant-numeric:tabular-nums; }}
.tabs {{ display:flex; flex-wrap:wrap; gap:5px; }}
.tab {{ font-size:11px; background:var(--papel); border:1px solid var(--linha); padding:2px 7px;
  display:inline-flex; gap:5px; align-items:center; }}
.tab b {{ color:var(--fluxo); font-variant-numeric:tabular-nums; }}
.tab.morta {{ border-style:dashed; color:var(--dim); text-decoration:line-through; text-decoration-thickness:1px; }}
.tab.morta b {{ color:var(--dim); }}
.tab.cron {{ border-style:dashed; }}
.rotas {{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:4px; font-size:13px; }}
.rotas li {{ display:flex; justify-content:space-between; gap:10px; border-bottom:1px dotted var(--linha); padding-bottom:3px; }}
.rotas code {{ font-size:11px; color:var(--dim); }}

.tabela {{ overflow-x:auto; border:1px solid var(--linha); background:var(--sup); box-shadow:var(--sombra); }}
table {{ width:100%; border-collapse:collapse; font-size:13.5px; }}
th {{ text-align:left; font-size:10.5px; text-transform:uppercase; letter-spacing:.09em; color:var(--dim);
  padding:9px 12px; border-bottom:1px solid var(--linha); font-weight:600; white-space:nowrap; }}
td {{ padding:9px 12px; border-bottom:1px solid var(--linha); vertical-align:top; }}
tr:last-child td {{ border-bottom:0; }}
.sev {{ font-size:10px; text-transform:uppercase; letter-spacing:.06em; padding:2px 7px; white-space:nowrap;
  border:1px solid currentColor; }}
.sev.critico {{ color:var(--critico); }} .sev.alto {{ color:var(--critico); }}
.sev.medio {{ color:var(--atencao); }} .sev.baixo {{ color:var(--dim); }}
.ev {{ display:block; font-family:ui-monospace,monospace; font-size:11px; color:var(--dim); margin-top:3px; }}
.nota {{ background:var(--fluxo-fraco); border-left:3px solid var(--fluxo); padding:12px 15px; margin:16px 0 0;
  font-size:13.5px; }}
footer {{ margin-top:60px; padding-top:16px; border-top:1px solid var(--linha); font-size:12px; color:var(--dim); }}
</style>

<div class="wrap">
<header class="topo">
  <p class="olho">FinanceAI · ERP financeiro · varredura de {m["gerado_em"]}</p>
  <h1>Como o dado atravessa a plataforma
    <small>Todo caminho de entrada, o razão que recebe tudo e cada saída que lê de lá. Números medidos no banco de produção, não estimados.</small></h1>
</header>

<div class="stats">
  <div class="stat"><b>{r["tabelas"]}</b><span>tabelas</span></div>
  <div class="stat"><b>{r["fks"]}</b><span>chaves estrangeiras</span></div>
  <div class="stat"><b>{r["rotas"]}</b><span>rotas</span></div>
  <div class="stat"><b>{r["edge_functions"]}</b><span>funções de servidor</span></div>
  <div class="stat"><b>{r["rpcs_usadas"]}</b><span>procedimentos</span></div>
  <div class="stat"><b>{r["linhas_totais"]}</b><span>linhas gravadas</span></div>
  <div class="stat alerta"><b>{alta}</b><span>achados graves</span></div>
</div>

<h2>Fluxo de dados <em>· entrada, razão, saída</em></h2>
<div class="fluxo">
  <ul>{entradas_html}</ul>
  <div class="nucleo">
    <strong>transactions</strong>
    <span>O razão único. Toda origem termina aqui, e todo relatório lê daqui.</span>
    <div class="regra">receita = type revenue<br>custo = expense + conta 4.x<br>despesa = expense + conta ≠ 4<br>só status confirmed<br>intercompany fora</div>
  </div>
  <ul>{saidas_html}</ul>
</div>
<p class="nota">A régua acima vive em dois lugares que precisam mudar juntos: as views SQL de margem e o <code>DRE.tsx</code>. Mudar um só é o jeito mais rápido de fazer a plataforma mentir.</p>

<h2>Serviços conectáveis <em>· o que a empresa pode ligar</em></h2>
<div class="tabela"><table>
<thead><tr><th>categoria</th><th>serviço</th><th>o que faz</th><th>configuração</th><th>tela</th></tr></thead>
<tbody>{integr_html}</tbody></table></div>

<h2>Modelo de dados <em>· por domínio</em></h2>
<div class="grid">{dominios_html}</div>
<p class="nota">O número no chip é a quantidade de linhas em produção. Chip riscado é tabela que nenhum código lê nem escreve.</p>

<h2>Navegação <em>· o que o usuário alcança</em></h2>
<div class="grid">{nav_html}</div>

<h2>Funções de servidor <em>· {len(edges)} no total</em></h2>
<div class="tabs">{edges_html}</div>
<p class="nota">Contorno cheio: alguma tela chama. Contorno tracejado: webhook, cron ou chamada externa.</p>

<h2>Achados da varredura <em>· {len(m["achados"])} itens</em></h2>
<div class="tabela"><table>
<thead><tr><th>severidade</th><th>alvo</th><th>o que está acontecendo</th><th>tipo</th></tr></thead>
<tbody>{achados_html}</tbody></table></div>

<footer>Gerado por varredura automática cruzando o schema de produção (<span class="mono">oxymhnddzamsjxwfglud</span>)
com o código de <span class="mono">MindOpsTeam/remix-of-cash-flow-bot</span>. O modelo completo está em
<span class="mono">docs/plataforma-modelo.json</span>.</footer>
</div>
"""

saida = os.path.join(AQUI, "plataforma-mapa.html")
open(saida, "w", encoding="utf-8").write(HTML)
print(f"HTML -> {saida} ({len(HTML)} bytes)")
print(f"seções de navegação: {len(secoes)} | domínios: {sum(1 for d in DOMINIOS if any(t in T for t in d[2]))}")
