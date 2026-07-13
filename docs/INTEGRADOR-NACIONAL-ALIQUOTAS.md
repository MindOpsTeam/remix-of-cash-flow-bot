# Integrador Nacional de Dados — alíquotas de municípios e estados de forma sincronizada

Estudo de viabilidade (pesquisa em fontes oficiais, jul/2026): **dá para extrair alíquotas por
ente federativo de forma sincronizada?** Resposta curta: **parcialmente — e a parte que dá é
gratuita e oficial.** Este documento diz o que é sincronizável hoje, o que não é, e a
arquitetura do serviço que montamos (o "rate store" temporal).

## Veredito por fonte

| Dado | Fonte programática | Sincronizável | Custo | Cobertura |
|---|---|---|---|---|
| **Municípios (código IBGE = cMun)** | IBGE Localidades API (JSON, aberto) | ✅ estável `/v1` | grátis | 100% (5.571) |
| **Tabelas cClassTrib / CST / cCredPres** | SVRS (export CSV/JSON aberto; web service c/ cert) | ✅ versionado (v1.50) | grátis | nacional |
| **ISS por município (alíquota, item LC116, regime, retenção)** | ADN `GET /parametros_municipais/{codIBGE}/…` (JSON) | ⚠️ por vigência, polling por IBGE | grátis (**exige cert ICP-Brasil A1**) | **só ~1.900 de 5.570 municípios ativos** na NFS-e Nacional |
| **ICMS interestadual + DIFAL** | regra fixa (Res. Senado 22/89 + 13/12) | ✅ constante | grátis | 100% |
| **ICMS alíquotas internas (27 UF) + FCP** | sem fonte oficial machine-readable | ❌ só agregador/feed pago | pago | alta variação |
| **ICMS-ST + MVA/CEST** | 27 SEFAZ + PNST CONFAZ (~13 UF) | ❌ só comercial em cobertura plena | pago | muito fragmentado |
| **CBS/IBS (cálculo + alíquota por ente)** | Calculadora Nacional (RFB/Serpro) | ⚠️ **beta** (piloto até dez/26) | grátis (cert + gov.br) | nacional |
| **Carga aproximada Lei 12.741** | IBPT CSV/API (ou mirror) | ✅ mensal por vigência | grátis (token/CNPJ) | nacional — **não é alíquota real de ISS** |

### O que É sincronizável de graça hoje
IBGE (municípios) · SVRS (tabelas da Reforma) · ISS dos ~1.900 municípios já operacionais na
NFS-e Nacional (via certificado A1 — o **mesmo** que já usamos no `nfse-worker`) · regra fixa de
ICMS interestadual/DIFAL · CBS/IBS 2026 (na lei).

### O que NÃO é (ainda)
- Base oficial única das **5.570 alíquotas de ISS** — o ISS é legalmente fragmentado por município; os ~3.600 fora da NFS-e Nacional não têm API. Fallback = de-para comercial (PlugNotas/nfe.io/Systax) ou lei município a município.
- **Alíquotas internas de ICMS + FCP** — sem fonte oficial legível por máquina; mudam no meio do ano.
- **ICMS-ST/MVA** — só feed comercial em cobertura plena.
- ⚠️ A coluna `municipal` do IBPT **não é** a alíquota de ISS — é carga aproximada agregada (Lei da Transparência). Usar como ISS = erro fiscal.

### Descobertas importantes
- **O nosso `nfse_parametros_municipio` atual é um stub** — o ADN de *Recepção* (adn.nfse.gov.br onde emitimos) só faz `POST /DFe` e `GET /danfse`; os parâmetros ficam no ADN de *contribuintes*, endpoint diferente, gated por mTLS.
- **O certificado ICP-Brasil A1 é a chave-mestra**: destrava ADN (ISS), o web service JSON do SVRS **e** a Calculadora Nacional CBS/IBS. Provisionar uma vez habilita as três.
- **ICMS/ISS são ativos depreciáveis**: migram para o IBS entre 2029-2032 e somem em 2033. A Calculadora Nacional CBS/IBS torna a fragmentação obsoleta — vale investir mais nela do que em cobrir os 5.570 ISS.

## Arquitetura implementada — "rate store" temporal + adapters

Princípio: **o ERP nunca chama a fonte externa na hora de emitir** — lê sempre do store interno,
onde toda linha é datada por vigência. Query canônica: `alíquota(tax, ente, item, competência)`.
Isola o ERP da instabilidade e heterogeneidade das fontes.

### O que já está no código (esta entrega)
- **`municipalities`** (migração 20260713000000) — dimensão sincronizada do IBGE; o `code_ibge` de 7 dígitos **é** o `cMun` fiscal (sem de-para).
- **`tax_rates`** — store temporal (`tax`, `ente_code`, `item_code`, `rate`, `vigencia_inicio/fim`, `source`, `confidence`). Guarda ISS/CBS/IBS/ICMS por vigência.
- **Edge `tax-rates-sync`** (cron `X-Cron-Secret`) — puxa os 5.571 municípios do IBGE (grátis, aberto) e semeia CBS/IBS 2026 (autoritativo, na lei). Idempotente.
- **`src/lib/icms.ts`** (+ testes) — a camada hardcodável: matriz interestadual (Res. Senado) e DIFAL (base única/dupla por UF). Zero feed, 100% de cobertura.

### Camadas por cadência (cada uma com seu adapter)
1. **Fundação:** IBGE → `municipalities`. Refresh raro. ✅ **feito**
2. **Classificação nacional:** SVRS cClassTrib/CST a cada versão da IT 2025.002 → snapshot. ▶ próximo (headless/export ou web service c/ cert)
3. **ISS (híbrido):** primário = ADN `parametros_municipais` por IBGE (**requer cert A1** — reusar o do `nfse-worker`); fallback = de-para comercial ou override do cliente. **Nunca** o IBPT como ISS. ▶ gated no cert
4. **ICMS:** regra hardcoded p/ interestadual+DIFAL (✅ feito) + config versionada p/ internas+FCP (`confidence=revisar`) + ST/MVA só via feed pago se preciso.
5. **Transparência (Lei 12.741):** IBPT alimenta **só** o "valor aproximado dos tributos", trilha separada do cálculo real.
6. **Reforma (à prova de futuro):** integrar a **Calculadora Nacional** como *compute-as-a-service* de CBS/IBS/IS; store desenhado para IBS coexistir com ICMS/ISS decrescentes (2029-2032) e substituí-los em 2033.

### Build vs Buy
- **Build (grátis/oficial):** IBGE + interestadual/DIFAL + tabelas SVRS + ISS-ADN (via cert) + IBPT-transparência. → tudo nesta linha já iniciado.
- **Buy (cauda longa):** ISS dos ~3.600 municípios fora da NFS-e Nacional, manutenção das internas de ICMS, ST/MVA — só se completude de cobertura virar requisito comercial.

## Como usar / próximos passos
1. Agendar `tax-rates-sync` (cron pg_cron, como os outros jobs). → popular municípios semanalmente.
2. Ao emitir NFS-e, quando houver `tax_rates(tax='iss', ente_code=cMun)` vigente, **auto-sugerir** a alíquota no `NfseEmit` em vez de digitação manual.
3. Provisionar o adapter ADN de ISS reusando o certificado A1 do `nfse-worker` (Railway) — habilita ~1.900 municípios reais.
4. Adapter da Calculadora Nacional para CBS/IBS por ente/competência quando sair do piloto.

## Fontes
gov.br/nfse (Manual API SN NFS-e v1.2, out/2025; Monitoramento de Adesões) · adn.nfse.gov.br / sefin.nfse.gov.br (mTLS) · piloto-cbs.tributos.gov.br (Calculadora Nacional RFB/Serpro) · cgibs.gov.br (Res. CGIBS 6/2026) · dfe-portal.svrs.rs.gov.br/DFE/ClassificacaoTributaria (cClassTrib v1.50) · servicodados.ibge.gov.br/api/docs/localidades · deolhonoimposto.ibpt.org.br (Lei 12.741) · Res. Senado 22/1989 e 13/2012 · LC 116/2003, LC 214/2025.
