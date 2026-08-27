# STAY — Sistema financeiro para locação por temporada

Transformar o FinanceAI no sistema financeiro da STAY: marca própria, cadastro dos empreendimentos e unidades, reservas com todas as taxas do curta temporada, e fechamento mensal com repasse ao proprietário.

## 1. Marca

- Renomear FinanceAI para STAY em `index.html` (title, meta description, og), `public/manifest.webmanifest`, tela de login e sidebar.
- Aplicar a logo enviada (aguardando o arquivo) em sidebar, login e favicon/ícones do PWA.
- Ajustar a paleta para a identidade do site oficialstay.com, mantendo os tokens semânticos do design system (sem cor hardcoded).

## 2. Cadastro de imóveis

Duas camadas, porque o dinheiro se organiza assim:

- **Empreendimento** (prédio/hotel): nome, cidade, bairro, destino.
- **Unidade** (apartamento): número, empreendimento, tipologia, proprietário (usa `contacts`), regime de repasse, status (ativa/manutenção/fora do pool).

Os 16 empreendimentos do site já entram cadastrados:

Goiânia: STAY Haut Compact Life, STAY Hub Compact Life (Setor Bueno); STAY Lounge 22, STAY ID Vida Urbana, STAY Sun Square (Setor Oeste); STAY Studio All, STAY Metropolitan Barcelona, STAY Metropolitan Sidney (Jardim Goiás); STAY Live Tower Lozandes (Park Lozandes); STAY Liv Urban Marista (St. Marista).
Palmas: STAY You by Fama (Praia da Graciosa); STAY Vivence Suítes, STAY Cosmopolitan, STAY Premium, STAY Yvy Home (Plano Diretor Sul); STAY Executive Residence (Plano Diretor Norte).

As unidades de cada empreendimento você cadastra depois (ou importa por planilha) — o site não expõe essa lista.

## 3. Reservas e taxas

Cada reserva registra hóspede, unidade, canal (Airbnb, Booking, direto, corporativo), check-in/check-out, noites, e a composição financeira:

Receitas
- Diárias (valor × noites)
- Taxa de limpeza
- Taxa de serviço / conveniência
- Enxoval e amenities extras
- Early check-in / late check-out
- Pet, hóspede extra, estacionamento
- Serviços à la carte (limpeza extra, lavanderia, equipamentos)
- Multa por cancelamento / no-show
- Caução e danos

Deduções
- Comissão do canal (% por canal, configurável)
- Taxa de meio de pagamento (cartão/Pix/antecipação)
- Impostos sobre a receita
- Custo da equipe de limpeza (por faxina)
- Repasse ao proprietário

Cada reserva confirmada gera lançamentos em `transactions` (respeitando a régua contábil já existente: receita grupo 3, custo 4, despesa 5) e um recebível quando o pagamento é futuro.

## 4. Fluxo de caixa e indicadores do segmento

Dashboard STAY com:
- Receita por empreendimento, por unidade e por canal
- **RevPAR**, **ADR** (diária média) e **taxa de ocupação** por período
- Receita de taxas separada da receita de diárias (limpeza é linha própria)
- Custo por faxina e margem líquida por unidade
- Calendário de ocupação e projeção de caixa a partir das reservas futuras
- Fechamento mensal por unidade: receita bruta, deduções, repasse devido, resultado STAY

## 5. Repasse ao proprietário

Regime configurável por unidade (comissão % sobre a receita líquida é o padrão, com alternativa de valor fixo/garantido). O fechamento mensal gera o extrato do proprietário e a conta a pagar do repasse. Preciso confirmar com você a regra exata antes de codar essa parte — quem fica com a taxa de limpeza, se condomínio e IPTU entram no acerto, e qual o percentual padrão.

## 6. Integração com PMS

Você escolheu integrar com canal/PMS. Isso entra em uma segunda etapa: preciso saber qual sistema você usa (Stays.net, Hostaway, Seazone, Guesty, Beds24, outro) e ter as credenciais de API. Enquanto isso, a entrada de reservas funciona por cadastro manual e importação de planilha, para o sistema já ficar utilizável desde o primeiro dia.

## Detalhes técnicos

- Novas tabelas em `public`: `stay_properties`, `stay_units`, `stay_fee_types`, `stay_channels`, `stay_reservations`, `stay_reservation_items`, `stay_owner_statements`. Migration versionada, RLS por `is_company_member(company_id)` e GRANTs explícitos para `authenticated`/`service_role`, seguindo o padrão das 171 migrations existentes.
- Hooks TanStack Query em `src/hooks/` (`useStayProperties`, `useStayUnits`, `useStayReservations`, `useStayIndicadores`), escopados por `company.id`.
- Páginas novas em `src/pages/stay/` e rotas em `App.tsx`, com bloco "Hospedagem" no `AppSidebar`.
- Cálculo de ADR/RevPAR/ocupação em módulo puro (`src/lib/stay-metrics.ts`) com testes Vitest — regra de negócio fora de componente.
- Trigger que projeta reserva confirmada em `transactions`, mantendo a integração com DRE, forecast e conciliação já existentes.
- Módulos atuais (fiscal, estoque, vendas, agentes) continuam intactos.

## Pendências suas

1. Arquivo da logo STAY (PNG/SVG).
2. Regra de repasse ao proprietário.
3. Nome do PMS/canal para a integração.
