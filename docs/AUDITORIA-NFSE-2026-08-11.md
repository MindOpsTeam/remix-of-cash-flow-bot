# Auditoria — Emissão NFS-e via Ambiente Nacional (2026-08-11)

Escopo: cadeia completa de emissão de NFS-e pelo Emissor/Ambiente Nacional (SEFIN/ADN)
neste projeto (`biz-whisper-fin` / FinanceAI, Supabase `oxymhnddzamsjxwfglud`).
Auditado ao vivo: código no HEAD `0d12641`, banco de produção via SQL, e o worker na
Railway via HTTP + API da Railway. Não é revisão do PlugNotas (via de fallback) nem das
vias NFe/NFCe/CTe/MDFe.

## Cadeia auditada

```
UI  /fiscal/nfse/emit (NfseEmit.tsx)
     └─ supabase.functions.invoke("nfse-proxy", { operation:"emit", companyId, data })
          └─ edge nfse-proxy  (valida JWT → RLS carrega nfse_config → reserva nº via RPC)
               └─ POST {NFSE_WORKER_URL}/emit   (X-API-Key)
                    └─ nfse-worker (Express, Railway)  ── mTLS cert A1 ──▶  SEFIN Nacional
                         buildDpsXml → signDpsXml (XMLDSig) → gzip+base64 → /SefinNacional/nfse
     └─ ao sucesso: INSERT em invoices (type=nfse, status=authorized)

UI  Configurações › Integrações › NFS-e (NfseIntegration.tsx)
     └─ invoke("nfse-operations", { operation:"parse_cert" })   ← única op usada pela UI
```

Componentes de dev/suporte fora do caminho de produção: `nfse-operations` (demais ops),
`nfse-nacional-mcp` (MCP stdio). Confirmado pela `ARCHITECTURE-FISCAL.md`.

## Veredito

**A emissão NÃO funciona hoje. Bloqueio de infraestrutura (P0): o worker está fora do ar.**
Fora isso, a plataforma nunca emitiu uma NFS-e real (0 configs, 0 certificados, 0 XML
autorizado no banco — as 15 notas existentes são seed do template). Ou seja: não há
regressão em produção a apagar, mas há bugs sérios que iam morder o primeiro cliente real.
Corrigir agora, antes da obrigatoriedade do Simples (Res. CGSN 189/2026, 01/09/2026).

Ranking por severidade abaixo.

---

## P0 — BLOQUEIO: worker offline

- A URL de produção documentada (commit `00065a3`) é `https://nfse-api-production.up.railway.app`.
  `GET /health` responde **HTTP 404 `{"code":404,"message":"Application not found"}`** — não é
  o app respondendo 404 numa rota, é a Railway dizendo que **não existe serviço nesse domínio**.
- Confirmado via API da Railway (workspace `ghmbarboza's Projects`): os dois únicos projetos são
  `insightful-reprieve` (serviço `start-clean-bloom`) e `refreshing-youthfulness`
  (`usertour`, `Postgres`, `PgBouncer`, `Redis`). **Não existe nenhum serviço `nfse-worker`/`nfse-api`.**
- Consequência: qualquer `emit` real cai no `catch`/timeout do `nfse-proxy` → 504/500. A cadeia
  inteira depende dessa peça porque mTLS com cert A1 não roda em Deno Deploy (motivo de o worker existir).

**Ação:** re-deployar `nfse-worker/` na Railway (o código está íntegro no repo) e re-setar os
secrets da edge no Supabase: `NFSE_WORKER_URL` (novo domínio) e `NFSE_WORKER_API_KEY` (mesmo
valor nos dois lados). Sem isso, nada mais nesta auditoria é testável ponta a ponta.

---

## P1 — ALTO

### 1. Chave privada do certificado e senha em texto claro no banco
`nfse_config.cert_pfx_base64` e `nfse_config.cert_password` são colunas `text` sem cifragem.
O `.pfx` é a **identidade jurídica de assinatura** da empresa. Hoje ele é legível por:
- qualquer edge function (todas usam `service_role`);
- qualquer membro da empresa (RLS `is_company_member` libera `SELECT` de todas as colunas);
- e há **GRANT de `SELECT/INSERT/UPDATE` para `anon`** em todas as colunas (inclusive as duas
  sensíveis) — mitigado só pela RLS (`is_company_member` → false para `anon`), mas é superfície
  desnecessária.

A `ARCHITECTURE-FISCAL.md` já anota a regra ("nunca armazenar a senha em claro sem cifragem") —
ela está sendo violada. **Ação:** mover PFX+senha para Supabase Vault (`vault.secrets`) ou cifrar
com `pgsodium`, e a edge decifra sob service_role no momento do uso; `REVOKE ... FROM anon` nas
colunas de `nfse_config`.

### 2. `optanteSimplesNacional: false` cravado no `nfse-proxy`
`supabase/functions/nfse-proxy/index.ts` monta o `workerBody` com `optanteSimplesNacional: false`
fixo. O worker traduz isso em `regTrib.opSimpNac` (`3` se Simples, `1` se não) — então **toda DPS
sai como "não optante" (opSimpNac=1)**, independentemente do regime real da empresa. Para o público
alvo (Simples Nacional, que é justamente quem a obrigatoriedade de 09/2026 empurra), isso emite a
nota com tributação de ISS errada. **Ação:** derivar `optanteSimplesNacional` do cadastro da empresa
(`companies`/regime tributário) e propagar de verdade.

### 3. XML fiscal autorizado não é persistido
No sucesso, o `nfse-proxy` grava `invoices.xml_content = JSON.stringify(workerData)` — ou seja, a
**resposta JSON** do worker (`idDPS`, `chaveAcesso`), não o XML. Nem o DPS assinado nem o XML da
NFS-e autorizada ficam guardados (o worker também não devolve o XML completo). A guarda do documento
fiscal autorizado é obrigação legal (5 anos). **Ação:** o worker deve devolver o XML da NFS-e (e/ou
o DPS assinado), e a edge deve persisti-lo (coluna dedicada ou storage), não a resposta de status.

---

## P2 — MÉDIO

### 4. Sem idempotência no caminho de produção
`nfse-proxy` reserva número e chama o worker sem chave de idempotência. Se a resposta de um `/emit`
bem-sucedido se perder (timeout de rede após o SEFIN autorizar), o retry reserva **outro** número e
**emite nota duplicada**. O `nfse-nacional-mcp` tem `idempotency-cache`, mas o caminho real (proxy→worker)
não. **Ação:** aceitar/gerar `Idempotency-Key` (ex.: hash de company+competência+sales_order_id) e
deduplicar na edge antes de reservar número.

### 5. Número de DPS queimado a cada falha, sem compensação
`reserve_next_dps_number` incrementa o contador **antes** da chamada ao worker; se o worker falha
(estado atual = sempre), o número vira lacuna sem rollback. Lacuna não é fatal na NFS-e Nacional
(diferente da NF-e, que exige inutilização), mas acumula e complica conciliação. **Ação:** reservar
número só após resposta positiva do SEFIN, ou registrar as lacunas e tratá-las na conciliação.

### 6. Caminho de emissão duplicado e podre em `nfse-operations`
O handler `emitir` de `nfse-operations`: (a) **nunca emite** — retorna `{ emitida:false, pendente:true }`;
e (b) incrementa `proximo_numero_dps` com um **read-modify-write não atômico** (`update({ proximo_numero_dps:
config.proximo_numero_dps + 1 })` sobre um valor lido no início), em vez da RPC atômica usada no proxy —
condição de corrida clássica (dois `emit` simultâneos leem o mesmo número). Hoje a UI só chama `parse_cert`,
então esse handler é código morto — mas perigoso se alguém religar. **Ação:** remover o `emitir` de
`nfse-operations` (ou redirecioná-lo ao mesmo fluxo do `nfse-proxy`), deixando uma única via de emissão.

### 7. Cancelamento não implementado
`nfse-worker` `/cancel` → `501 Não implementado`; `nfse-operations` devolve mensagem de stub. Não há
como cancelar uma NFS-e emitida. **Ação:** implementar o evento de cancelamento via ADN (`POST /DFe`)
antes de considerar a via "completa" para um cliente pagante.

---

## P3 — BAIXO / condicional

### 8. RTC (IBS/CBS) não destacado no DPS
`buildDpsXml` não inclui o grupo IBS/CBS da Reforma Tributária. Tudo bem **enquanto os clientes forem
Simples** (destaque obrigatório só em 2027). Empresa de regime regular emitindo por aqui seria rejeitada
a partir de ~03/08/2026. **Ação:** gate por regime — bloquear/avisar regime regular até implementar o RTC
no leiaute nacional, ou cair no PlugNotas (que já suporta IBS/CBS em NFe/NFCe).

### 9. Leiaute `<valores>`/`<trib>` minimalista — validar contra o XSD em homologação
O bloco `valores.trib.tribMun.tribISSQN` é montado de forma reduzida (`tribISSQN` como escalar,
`tpRetISSQN`/`totTrib` fixos). Como **há 0 notas autorizadas reais no banco**, não há evidência de que a
DPS passa na validação do Ambiente Nacional. **Ação:** rodar uma emissão em homologação
(`sefin.producaorestrita.nfse.gov.br`) com nota autorizada de verdade e ajustar o XML ao XSD do leiaute
nacional antes de ligar produção.

---

## O que está correto (não mexer)

- **Auth**: `nfse-proxy` e `nfse-operations` validam o JWT com a chave `anon` antes de usar `service_role`;
  a membresia é provada ao carregar `nfse_config` sob RLS. Coerente com o padrão `_shared/auth.ts` do projeto.
- **Reserva atômica** de número no caminho de produção via RPC `reserve_next_dps_number` (SECURITY DEFINER),
  com `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` — só `service_role` chama. Falha na reserva
  **aborta** a emissão (correto: sem número não pode emitir).
- **Worker fail-closed**: rejeita tudo (500) se `NFSE_WORKER_API_KEY` não estiver setado; exige `X-API-Key`.
- **Assinatura XMLDSig**: SHA-256 + RSA-SHA256 + C14N, `KeyInfo` com `X509Certificate`, `Id` de DPS com os
  45 caracteres corretos (`DPS`+cMun7+tpInsc1+CNPJ14+serie5+nDPS15), `dhEmi` com offset `-03:00` resolvendo
  o instante correto. Assinatura inserida como irmã, após `infDPS`.
- **mTLS** com `rejectUnauthorized: true` e `minVersion: TLSv1.2`.
- **Separação de vias** documentada (NFS-e Nacional própria = primária; PlugNotas = fallback pago e única
  via de NFe/NFCe/CTe/MDFe).

## Estado vivo do banco (2026-08-11)

| Métrica | Valor |
|---|---|
| `companies` | 3 |
| `nfse_config` (total / ativas / com cert) | 0 / 0 / 0 |
| `invoices` type=nfse | 15 (todas `authorized`, `xml_content` nulo, mesma `created_at`) → **seed do template** |
| Emissões reais pela cadeia | **0** |
| Worker Railway | **inexistente** (404) |

## Plano de ação recomendado (ordem)

1. **P0** — Re-deploy do `nfse-worker` na Railway + re-setar `NFSE_WORKER_URL`/`NFSE_WORKER_API_KEY` no Supabase.
2. **P1.1** — Tirar PFX+senha do texto claro (Vault/pgsodium) e `REVOKE` de `anon` em `nfse_config`.
3. **P3.9** — Emitir em **homologação** e validar a DPS contra o XSD (fecha a dúvida do leiaute).
4. **P1.2 / P1.3** — Propagar `optanteSimplesNacional` real; persistir o XML autorizado.
5. **P2.4 / P2.5 / P2.6** — Idempotência; reserva de número pós-autorização; matar o `emitir` duplicado.
6. **P2.7 / P3.8** — Cancelamento via ADN; gate de RTC por regime.

Só depois de (1)→(3) a "integração" pode ser considerada validada de ponta a ponta.
