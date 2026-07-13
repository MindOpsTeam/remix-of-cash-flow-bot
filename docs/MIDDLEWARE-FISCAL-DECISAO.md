# Existe um middleware que faz "tudo isso"? — decisão de motor fiscal (2026-07-13)

Pergunta do dono: existe um middleware que resolva **alíquotas sincronizadas (ISS/ICMS/ST/DIFAL) +
CBS/IBS da Reforma + cálculo + emissão** numa integração só, para não montarmos "tabela por tabela"?
Complementa `INTEGRADOR-NACIONAL-ALIQUOTAS.md` (as fontes de dado) com o mercado de **motores fiscais**.

## Resposta em 3 linhas
1. **Sim, um faz literalmente tudo numa API só: Avalara Brasil (AvaTax + Oobj)** — determinação (ISS por município + ICMS-ST/DIFAL) + CBS/IBS + cálculo + emissão, com REST e sandbox. **Mas é enterprise, preço sob consulta, onboarding via parceiro.**
2. **A rota barata que já resolve muito: ativar o que o PlugNotas (que já pagamos) tem** — auto-preenchimento de ISS no cadastro do serviço + "Calculadora da Reforma" (que embrulha o motor **gratuito e oficial da Receita**). "Digitar ISS na mão" é recurso não-ligado, não limitação.
3. **O que vale construir in-house: NÃO** a base de ICMS-ST (poço sem fundo — comprar); **SIM** a classificação fiscal por SKU (NCM/CEST/CFOP/CST/cClassTrib, que nenhum fornecedor automatiza 100%) + um wrapper fino sobre o motor CBS/IBS grátis da RFB.

## O mercado são DUAS categorias (não uma prateleira de "faz-tudo")

**A. Tax engines completos** (determinação + cálculo + ST + Reforma) — enterprise, consultivo (SAP/Protheus), preço sob consulta, emissão às vezes à parte:
- **Avalara Brasil** (comprou a Oobj em dez/24) — o único com **REST público + sandbox + SKU PME**. A referência exata do que foi pedido.
- **Systax** (entrou no grupo **Vertex**, 2025; ~20M regras, melhor classificação NCM/CEST) — venda consultiva, mas a **parceria com a Omie (jan/26)** está empacotando a determinação por API dentro de ERP de PME. Ficar de olho.
- **Sovos** (comprou a Taxweb/TaxRules) e **Thomson Reuters/ONESOURCE-Mastersaf** — robustos, mas enterprise puro (docs gated). Overkill para PME.
- **Guepardo (NTT DATA)** — só dentro do SAP. Irrelevante para React/Supabase.
- **Roit** — calcula CBS/IBS e marca forte na Reforma, **mas não emite** e a API é gated. START self-serve (R$499–1.897/mês) é simulação/compliance, não rate/calc API.

**B. Emissores** (o "de-para", mais barato) — a maioria só emite (você manda a alíquota). Exceções que TAMBÉM calculam:
- **nfe.io** e **WebmaniaBR** — self-serve (~R$180–350/mês) com **motor de cálculo real** (ICMS/ST/DIFAL/IPI/PIS/COFINS por NCM+CFOP+origem/destino) + campos CBS/IBS prontos. O mais perto de "alíquota+cálculo+emissão" na faixa PME. WebmaniaBR emite CT-e/MDF-e; nfe.io não.
- **PlugNotas/TecnoSpeed (nosso incumbente)** — **o mais forte na Reforma entre emissores**: ISS auto no cadastro (de-para municipal) + Calculadora da Reforma (motor oficial RFB, item-a-item). **Não** determina ICMS-ST/DIFAL (aí a alíquota é nossa).
- **Focus NFe** — o mais barato/amplo (CT-e/MDF-e, Solo R$89,90/mês), mas **pass-through puro**.
- **Bling** — motor completo em produção desde 01/01/2026, mas vem como **ERP de lojista** (por CNPJ).
- ⚠️ **Nuvem Fiscal encerra 31/07/2026** — não adotar.

## A camada que muda o custo: a Reforma tem infra pública e GRÁTIS
A Receita liberou (18/07/2025, beta) a **"Calculadora de Tributos" CBS/IBS/IS — aberta, gratuita, open-source**: simulador web + **motor baixável** + **API REST** + APIs de dados abertos (NBS, cClassTrib, reduções). **Ninguém precisa "inventar" o cálculo de CBS/IBS** — PlugNotas/nfe.io/Webmania já embrulham isso, e nós podemos chamar direto. CBS/IBS **não é diferencial de fornecedor** — é commodity. Não pagar caro por ela.

## Tabela — cobertura (a=alíquota · b=CBS/IBS · c=cálculo · d=emissão)

| Player | Cat | a | b | c | d | API self-serve | Pricing | Alvo |
|---|---|---|---|---|---|---|---|---|
| **Avalara (AvaTax+Oobj)** | A | ✅ (ISS+ST/DIFAL) | ✅ | ✅ | ✅ | ✅ sandbox (partner) | sob consulta | PME→ent |
| Systax (Vertex) | A | ✅ +NCM/CEST | ✅ | ✅ | 🟡 | 🟡 consultiva | sob consulta | méd/SAP; Omie p/ PME |
| Sovos / TR-Mastersaf | A | ✅ | ✅ | ✅ | ❌ gated | sob consulta | enterprise |
| Roit | A- | 🟡 | ✅ | ✅ | 🟡 gated / START | R$499–1.897 | ent + PME |
| **nfe.io** | B+ | ✅ motor | ✅ | ✅ | ✅ trial | R$179–349/mês | PME/dev |
| **WebmaniaBR** | B+ | ✅ motor (+CT-e/MDF-e) | ✅ | ✅ | ✅ trial 30d | R$199,90/mês +R$0,99/nota | PME/dev |
| **PlugNotas** *(nosso)* | B | 🟡 ISS auto | ✅ Calc. Reforma | 🟡 | ✅ (+NFSe Nacional) | ✅ sandbox (vendas) | sob consulta | software houses |
| Focus NFe | B | ❌ | 🟡 pass | ❌ | ✅ | R$89,90/mês +R$0,10 | PME multi-CNPJ |
| Bling | B+ | ✅ motor | ✅ prod | ✅ | 🟡 ERP | R$55–650/CNPJ | lojista |

## Veredito para o NOSSO caso (ERP PME React/Supabase, já no PlugNotas)

**A pergunta de escopo que decide tudo:** os clientes emitem majoritariamente **serviço (NFS-e/ISS)** ou também **mercadoria (NF-e com ICMS-ST/DIFAL)**?

- **Se é quase tudo serviço → já estamos com o fornecedor certo.** Ficar no PlugNotas, **ligar o ISS automático** (mata o "digitar na mão") + a **Calculadora da Reforma** (CBS/IBS de graça). Custo marginal ~zero. Construir só a camada de classificação por SKU.
- **Se há mercadoria com ST →** decisão real = *engine leve self-serve ao lado do PlugNotas* vs *engine enterprise substituindo*. **Começar pelo leve** (nfe.io ou WebmaniaBR): resolve ~80% a ~R$200/mês, prototipável hoje. Subir para **Avalara** só se a complexidade de ST/DIFAL/regimes especiais justificar o custo enterprise.

**O que NÃO fazer:** montar a base de regras de ICMS-ST/MVA/DIFAL por UF na mão (20M+ regras mutáveis — comprar de um engine). Lembrar: ICMS/ISS são **ativos depreciáveis** (viram IBS até 2033).

**O que já está encaminhado in-house (ver INTEGRADOR-NACIONAL-ALIQUOTAS.md):** rate store `tax_rates` + municípios IBGE + ICMS interestadual/DIFAL (regra fixa). Falta: (1) classificação por SKU (NCM/CEST/CFOP/CST/cClassTrib) — o real diferencial; (2) wrapper do motor CBS/IBS grátis da RFB; (3) ligar o ISS auto do PlugNotas no NfseEmit.

## Ação imediata recomendada (custo ~zero)
Confirmar com o PlugNotas o **auto-preenchimento de ISS** por serviço/município e a **Calculadora da Reforma**, e ligar no fluxo de emissão — isso resolve ISS + CBS/IBS sem trocar de fornecedor nem montar tabela. Só avaliar Avalara/nfe.io/Webmania se e quando houver volume real de NF-e de mercadoria com ICMS-ST.

## Fontes
developer.avalara.com/api-reference/avatax-brazil · newsroom.avalara.com (Oobj) · systax.com.br · sovos.com (Taxweb) · gov.br/receitafederal (Calculadora de Tributos CBS/IBS, jul/2025) · nfe.io/docs/inteligencia-tributaria · webmania.com.br/docs · atendimento.tecnospeed.com.br (Calculadora RT) · focusnfe.com.br/precos · nuvemfiscal.com.br (encerramento) · IT 2025.002 v1.50.
