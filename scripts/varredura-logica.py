#!/usr/bin/env python3
"""
Varredura lógica da plataforma FinanceAI.

Cruza o schema real do banco (tabelas, RLS, FKs) com o código que lê e escreve
cada tabela (UI e edge functions) e com as rotas, para achar:
  - dado que entra e nunca é lido (sumidouro)
  - tabela que ninguém toca (peso morto)
  - coluna de tenant sem chave estrangeira
  - função de servidor que ninguém chama
  - rota inalcançável
  - famílias duplicadas (legado convivendo com o novo)
"""
import json, os, re, glob, sys
from collections import defaultdict

REPO = os.path.expanduser("~/remix-of-cash-flow-bot")
AQUI = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- schema real
tabelas = {}
for linha in open(os.path.join(AQUI, "db_tables.txt")):
    nome, pol, linhas, cid, trg = linha.strip().split("|")
    tabelas[nome] = {
        "policies": int(pol), "linhas": int(linhas),
        "tem_company_id": cid == "1", "triggers": int(trg),
        "rls": True,
    }

fks = []
for linha in open(os.path.join(AQUI, "db_fks.txt")):
    esq, alvo = linha.strip().split(">")
    origem, coluna = esq.rsplit(".", 1)
    fks.append({"de": origem, "coluna": coluna, "para": alvo})

fk_por_tabela = defaultdict(list)
for f in fks:
    fk_por_tabela[f["de"]].append(f)

# ---------------------------------------------------------------- uso no código
OPS = ["select", "insert", "update", "upsert", "delete"]
uso = defaultdict(lambda: {"le": [], "escreve": []})
rpcs = defaultdict(list)
invokes = defaultdict(list)

def escanear(padrao, camada):
    for caminho in glob.glob(padrao, recursive=True):
        if "/node_modules/" in caminho or caminho.endswith("types.ts"):
            continue
        arq = os.path.basename(caminho)
        txt = open(caminho, encoding="utf-8", errors="ignore").read()
        for m in re.finditer(r'\.from\(\s*"([a-z_0-9]+)"', txt):
            tabela = m.group(1)
            janela = txt[m.end(): m.end() + 260]
            ops = [o for o in OPS if f".{o}(" in janela]
            destino = "escreve" if any(o in ops for o in ("insert", "update", "upsert", "delete")) else "le"
            uso[tabela][destino].append(f"{camada}:{arq}")
            if destino == "escreve" and "select" in ops:
                uso[tabela]["le"].append(f"{camada}:{arq}")
        for m in re.finditer(r'\.rpc\(\s*"([a-z_0-9]+)"', txt):
            rpcs[m.group(1)].append(f"{camada}:{arq}")
        # A UI chama edge function de três jeitos: invoke, fetch na URL e helper edgeUrl.
        for padrao in (r'functions\.invoke\(\s*[\'"`]([a-z0-9-]+)[\'"`]',
                       r'/functions/v1/([a-z0-9-]+)',
                       r'edgeUrl\(\s*[\'"`]([a-z0-9-]+)[\'"`]'):
            for m in re.finditer(padrao, txt):
                invokes[m.group(1)].append(f"{camada}:{arq}")

escanear(f"{REPO}/src/**/*.ts", "ui")
escanear(f"{REPO}/src/**/*.tsx", "ui")
escanear(f"{REPO}/supabase/functions/**/*.ts", "edge")

for t in uso:
    uso[t]["le"] = sorted(set(uso[t]["le"]))
    uso[t]["escreve"] = sorted(set(uso[t]["escreve"]))

# ---------------------------------------------------------------- rotas e nav
app = open(f"{REPO}/src/App.tsx", encoding="utf-8").read()
rotas = [r for r in re.findall(r'<Route path="([^"]+)"', app) if r != "*"]
links = set()
for caminho in glob.glob(f"{REPO}/src/**/*.tsx", recursive=True) + glob.glob(f"{REPO}/src/**/*.ts", recursive=True):
    if caminho.endswith("App.tsx"):
        continue
    s = open(caminho, encoding="utf-8", errors="ignore").read()
    links |= set(re.findall(r'to="(/[^"]*)"', s))
    links |= set(re.findall(r'navigate\("(/[^"]*)"', s))
    links |= set(re.findall(r'(?:url|to|emitir|configurar):\s*"(/[^"]*)"', s))

funcoes_edge = sorted(
    d for d in os.listdir(f"{REPO}/supabase/functions")
    if os.path.isdir(f"{REPO}/supabase/functions/{d}") and not d.startswith("_")
)

# ---------------------------------------------------------------- achados
achados = []
def achar(sev, tipo, alvo, desc, evidencia=""):
    achados.append({"severidade": sev, "tipo": tipo, "alvo": alvo,
                    "descricao": desc, "evidencia": evidencia})

# 1. tenant sem amarração
for t, info in tabelas.items():
    if info["tem_company_id"] and not any(f["coluna"] == "company_id" and f["para"] == "companies"
                                          for f in fk_por_tabela[t]):
        achar("MEDIA", "fk_ausente", t,
              "tem company_id mas sem chave estrangeira para companies: aceita empresa inexistente e não cascateia na exclusão")

# 2. peso morto e sumidouros
CRON_OU_TRIGGER = {"tax_rates", "municipalities", "journal_entries", "company_journal_entries",
                   "webhook_logs", "asaas_webhook_events", "company_asaas_webhook_events"}
for t, info in tabelas.items():
    u = uso.get(t, {"le": [], "escreve": []})
    if not u["le"] and not u["escreve"]:
        achar("ALTA" if info["linhas"] > 0 else "BAIXA", "tabela_sem_uso", t,
              f"nenhum código lê nem escreve ({info['linhas']} linhas no banco)")
    elif u["escreve"] and not u["le"] and t not in CRON_OU_TRIGGER:
        achar("ALTA", "sumidouro", t,
              "dado entra e nunca é lido: escrita sem leitura em lugar nenhum",
              "escrito por " + ", ".join(u["escreve"][:4]))

# 3. função de servidor que ninguém chama
CHAMADA_EXTERNA = {"openfinance-webhook", "company-asaas-webhook", "asaas-webhook", "focus-webhook",
                   "whatsapp-webhook", "inbound-webhook", "public-api", "mcp",
                   "contracts-billing", "smart-alerts", "agent-collections", "agent-anomalies",
                   "tax-rates-sync", "openfinance-sync", "reconcile-transactions"}
for f in funcoes_edge:
    if f not in invokes and f not in CHAMADA_EXTERNA:
        achar("MEDIA", "edge_orfa", f,
              "nenhuma tela invoca e não é webhook/cron conhecido")

# 4. rota inalcançável
INTENCIONAL = {"/.lovable/oauth/consent", "/bills", "/"}
for r in rotas:
    if r not in links and r not in INTENCIONAL:
        achar("MEDIA", "rota_orfa", r, "nenhuma tela linka para esta rota")

# 5. famílias duplicadas
legado_asaas = [t for t in tabelas if t.startswith("asaas_")]
novo_asaas = [t for t in tabelas if t.startswith("company_asaas_")]
if legado_asaas and novo_asaas:
    vivas = [t for t in legado_asaas if tabelas[t]["linhas"] > 0]
    achar("MEDIA" if vivas else "BAIXA", "familia_duplicada", "asaas_* vs company_asaas_*",
          f"{len(legado_asaas)} tabelas legadas (por usuário) convivem com {len(novo_asaas)} novas (por empresa)",
          "legado com dados: " + (", ".join(f"{t}({tabelas[t]['linhas']})" for t in vivas) or "nenhuma"))

# 6. integrações novas amarradas?
for t in ("focus_config", "openfinance_config"):
    u = uso.get(t, {"le": [], "escreve": []})
    if not u["le"]:
        achar("ALTA", "integracao_solta", t, "tabela de configuração que nenhuma tela lê")

# 7. RLS sem policy
for t, info in tabelas.items():
    if info["policies"] == 0:
        achar("CRITICA", "rls_sem_policy", t, "RLS ligado sem nenhuma policy: tabela inacessível para o app")

# ---------------------------------------------------------------- modelo
modelo = {
    "gerado_em": "2026-07-27",
    "projeto": {"nome": "FinanceAI", "supabase": "oxymhnddzamsjxwfglud",
                "repo": "MindOpsTeam/remix-of-cash-flow-bot"},
    "resumo": {
        "tabelas": len(tabelas), "fks": len(fks), "rotas": len(rotas),
        "edge_functions": len(funcoes_edge), "rpcs_usadas": len(rpcs),
        "tabelas_com_dados": sum(1 for t in tabelas.values() if t["linhas"] > 0),
        "linhas_totais": sum(t["linhas"] for t in tabelas.values()),
    },
    "tabelas": {t: {**info, "fks": fk_por_tabela[t],
                    "lido_por": uso.get(t, {}).get("le", []),
                    "escrito_por": uso.get(t, {}).get("escreve", [])}
                for t, info in sorted(tabelas.items())},
    "rotas": sorted(rotas),
    "rotas_alcancaveis": sorted(r for r in rotas if r in links or r in INTENCIONAL),
    "edge_functions": funcoes_edge,
    "edge_invocadas_pela_ui": {k: sorted(set(v)) for k, v in sorted(invokes.items())},
    "rpcs": {k: sorted(set(v)) for k, v in sorted(rpcs.items())},
    "achados": sorted(achados, key=lambda a: ["CRITICA", "ALTA", "MEDIA", "BAIXA"].index(a["severidade"])),
}

saida = os.path.join(AQUI, "plataforma-modelo.json")
json.dump(modelo, open(saida, "w"), ensure_ascii=False, indent=1)

print(f"tabelas {modelo['resumo']['tabelas']} | fks {modelo['resumo']['fks']} | rotas {modelo['resumo']['rotas']} | edges {modelo['resumo']['edge_functions']}")
print(f"\n=== {len(achados)} ACHADOS ===")
for a in modelo["achados"]:
    print(f"  [{a['severidade']:7}] {a['tipo']:20} {a['alvo'][:38]:38} {a['descricao'][:70]}")
    if a["evidencia"]:
        print(f"{'':12}{a['evidencia'][:100]}")
print(f"\nmodelo -> {saida}")
