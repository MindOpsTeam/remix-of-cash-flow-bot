# NFS-e Nacional MCP Server — Especificação Técnica

> Documentação viva do MCP server `nfse-nacional`.
> Última atualização: 2026-03-15

---

## Visão Geral

MCP Server para integração com a API NFS-e Nacional do governo federal
(ADN — Ambiente de Dados Nacional da Receita Federal). Usado por agentes de IA
para emitir, cancelar, consultar e gerenciar Notas Fiscais de Serviço eletrônicas
no padrão nacional.

**Runtime:** Node.js 20+ com TypeScript strict
**Transporte:** stdio (padrão MCP)
**Autenticação com ADN:** mTLS com certificado digital ICP-Brasil A1 (.pfx)

---

## Stack

| Camada | Tecnologia | Motivo |
|---|---|---|
| MCP SDK | `@modelcontextprotocol/sdk` ^1.12 | Protocolo padrão para agents |
| HTTP | `node:https` nativo | mTLS via `https.Agent` sem deps extras |
| XML build | `fast-xml-parser` XMLBuilder | Leve, sem DOM, JSON→XML direto |
| XML parse | `fast-xml-parser` XMLParser | Mesmo pacote, bidirecional |
| Assinatura | `node-forge` | PKCS#12 load, RSA-SHA256, X509 |
| Validação | `zod` (inline no index.ts) | Schemas das 14 tools no registro MCP |
| Cache | Implementação própria (Map + TTL) | Zero deps, TTL 24h padrão |
| Build | `tsc` direto | Sem bundler — ESM puro |

---

## URLs do ADN

| Ambiente | Base URL |
|---|---|
| Produção | `https://adn.nfse.gov.br` |
| Homologação | `https://adn.producaorestrita.nfse.gov.br` |

**APIs disponíveis no ADN:**

| API | Path | Uso |
|---|---|---|
| SEFIN | `/sefin/v1` | Emissão DPS, eventos, consulta por chave |
| DFe | `/DFe` | Distribuição de documentos por NSU |
| Contribuintes | `/contribuintes` | Parâmetros fiscais do contribuinte |
| CNC | `/cnc` | Cadastro Nacional de Contribuintes |
| Parametrização | `/parametrizacao` | Parâmetros municipais |
| DANFSE | `/danfse` | Geração de PDF |

Documentação oficial: https://www.gov.br/nfse/pt-br

---

## Estrutura de Arquivos

```
nfse-nacional-mcp/
├── src/
│   ├── index.ts                 ← Entry point: registra 14 tools no McpServer
│   ├── config.ts                ← URLs, constantes (CHAVE_ACESSO_LENGTH=50, etc.)
│   ├── auth/
│   │   ├── cert-manager.ts      ← Carrega .pfx (node-forge), extrai key+cert+chain
│   │   └── http-client.ts       ← HTTPS client com mTLS (node:https nativo)
│   ├── tools/
│   │   ├── emissao.ts           ← nfse_emitir + nfse_emitir_lote
│   │   ├── eventos.ts           ← nfse_cancelar + nfse_substituir
│   │   ├── consultas.ts         ← nfse_consultar_chave + _dfe + _lote
│   │   ├── documentos.ts        ← nfse_gerar_danfse
│   │   ├── parametros.ts        ← nfse_parametros_municipio + _contribuinte + cnc + codigos
│   │   └── utils.ts             ← nfse_validar_dps + nfse_status_ambiente
│   ├── xml/
│   │   ├── dps-builder.ts       ← Monta XML da DPS + assina (enveloped RSA-SHA256)
│   │   └── nfse-parser.ts       ← Parseia respostas XML do ADN
│   ├── cache/
│   │   └── parametros-cache.ts  ← Cache in-memory com TTL (Map-based)
│   └── errors/
│       └── nfse-errors.ts       ← NfseError, NfseValidationError, NfseRejeicaoError
├── dist/                        ← Output do tsc
├── package.json
├── tsconfig.json
└── mcp.json                     ← Manifesto MCP (14 tools listadas)
```

---

## As 14 Tools

### Emissão

#### `nfse_emitir`
Emite uma NFS-e individual (síncrono). Constrói a DPS, assina com certificado
digital e envia ao ADN via POST `/sefin/v1/DPS`.

**Input:** DpsInput (cnpjPrestador, codigoMunicipio, competencia, serieDps,
numeroDps, servico, tomador?, valores, observacoes?)

**Output:** { chaveAcesso, numero, serie, dataEmissao, valorServicos, valorIss, xmlAutorizado }

**Validações aplicadas:**
- CNPJ 14 dígitos + dígitos verificadores
- Competência formato YYYY-MM
- Série numérica (obrigatório >= jan/2026)
- CNPJ do certificado deve bater com cnpjPrestador
- valorServicos > 0

#### `nfse_emitir_lote`
Envia até 50 DPS em lote assíncrono. Retorna protocolo para consulta posterior.

**Input:** { cnpjPrestador, lote: DpsInput[] }
**Output:** { protocolo, totalEnviado, ambiente }

---

### Eventos

#### `nfse_cancelar`
Cancela NFS-e autorizada (prazo: 35 dias). Gera evento de cancelamento
assinado digitalmente.

**Input:** { chaveAcesso (50 chars), motivo: ERRO_EMISSAO | SERVICO_NAO_PRESTADO | OUTRO, descricaoMotivo? }
**Output:** { chaveAcesso, situacao, dataEvento, motivo }

#### `nfse_substituir`
Substitui NFS-e por outra (cancela original + emite nova em operação única).

**Input:** { chaveAcessoOriginal, motivoSubstituicao?, novaDps: DpsInput }
**Output:** { chaveAcessoOriginal, chaveAcessoNova, numero, situacao, dataEvento }

---

### Consultas

#### `nfse_consultar_chave`
Consulta NFS-e pela chave de acesso (50 caracteres).

**Input:** { chaveAcesso, formato?: "xml" | "json" }
**Output:** Dados completos: prestador, tomador, servico, valores, status

#### `nfse_consultar_dfe`
Distribuição de DFe por NSU. Retorna NFS-e emitidas/recebidas.

**Input:** { cnpj (14 dígitos), ultimoNsu (iniciar com "0"), tipo?: emitidas|recebidas|todas }
**Output:** { ultimoNsu, maxNsu, totalDocumentos, documentos[] }

#### `nfse_consultar_lote`
Consulta resultado de lote assíncrono enviado via `nfse_emitir_lote`.

**Input:** { protocolo, cnpjPrestador }
**Output:** { protocolo, situacao, totalNotas, notas[] }

---

### Documentos

#### `nfse_gerar_danfse`
Gera o DANFSE (PDF) de NFS-e autorizada. Pode retornar em base64 e/ou salvar em disco.

**Input:** { chaveAcesso, retornarBase64?: boolean (default true), salvarPath?: string }
**Output:** { chaveAcesso, pdfBase64?, salvoEm?, tamanhoBytes }

---

### Parâmetros

#### `nfse_parametros_municipio`
Consulta parâmetros fiscais de um município (cache 24h).

**Input:** { codigoMunicipio (IBGE 7 dígitos), cpfCnpj? }
**Output:** { aderenteAdn, aliquotaMinima, aliquotaMaxima, regimesEspeciais[], beneficiosFiscais[] }

#### `nfse_parametros_contribuinte`
Parâmetros de um contribuinte em um município (cache 12h).

**Input:** { codigoMunicipio, cpfCnpj }
**Output:** { inscricaoMunicipal, optanteSimplesNacional, regimeEspecial, aliquotaIss }

#### `nfse_cnc_consultar`
Consulta o Cadastro Nacional de Contribuintes.

**Input:** { cpfCnpj, codigoMunicipio? }
**Output:** { razaoSocial, nomeFantasia, situacaoCadastral, inscricoesMunicipais[] }

#### `nfse_codigos_servico`
Pesquisa códigos de tributação nacional da LC 116/2003. Busca local (subset)
com fallback para API.

**Input:** { busca?: string, codigo?: string }
**Output:** { total, codigos: { codigo, descricao, grupo }[] }

---

### Utilitários

#### `nfse_validar_dps`
Valida DPS localmente sem enviar ao ADN. Verifica campos, formatos, CNPJ/CPF
e certificado.

**Input:** Mesmo schema do nfse_emitir
**Output:** { valida: boolean, erros[], avisos[] }

**Não depende de internet** — validação 100% local.

#### `nfse_status_ambiente`
Verifica saúde do ambiente ADN e validade do certificado.

**Input:** (nenhum)
**Output:** { ambiente, baseUrl, adnDisponivel, latenciaMs, certificado: { valido, diasRestantes, expiraEm, cnpj, avisos[] } }

---

## Autenticação mTLS

### Fluxo
1. `CertManager` carrega o `.pfx` via `node-forge` (PKCS#12)
2. Extrai: chave privada (PEM), certificado X.509 (PEM), cadeia de CAs
3. Parseia o CN do certificado ICP-Brasil para extrair CNPJ e razão social
4. Cria `https.Agent` com `{ cert, key, ca }` para mTLS
5. `AdnHttpClient` usa esse agent em todas as requisições

### Assinatura Digital
- Algoritmo: **RSA-SHA256** (enveloped signature no nó `<infDPS>`)
- Digest: SHA-256 do conteúdo de `<infDPS>`
- Certificado incluído no XML como `<X509Certificate>` (DER em base64)
- Canonicalização: C14N 1.0

### Certificado
- Formato: ICP-Brasil A1 (.pfx / PKCS#12)
- Warnings automáticos: 30 dias, 15 dias, 7 dias antes de expirar
- Verificação no startup: se expirado, loga erro mas não impede inicialização

---

## Multi-tenant via Supabase

### Modelo atual (MCP Server)
O MCP server lê o certificado de **arquivo local** via variável de ambiente:
```
NFSE_CERT_PATH=/caminho/para/certificado.pfx
NFSE_CERT_PASSWORD=senha
```
Isso funciona para **single-tenant** (uma empresa por instância do MCP).

### Modelo ERP (nfse_config no Supabase)
Para multi-tenant, cada empresa tem sua config na tabela `nfse_config`:

```sql
nfse_config (
  company_id     UUID UNIQUE  -- 1 config por empresa
  cert_pfx_base64 TEXT        -- certificado .pfx em base64
  cert_password   TEXT        -- senha do .pfx
  cert_cnpj       TEXT        -- CNPJ extraído do cert (preenchido no test)
  cert_razao_social TEXT      -- razão social extraída
  cert_expires_at TIMESTAMPTZ -- validade do certificado
  ambiente        TEXT        -- 'producao' | 'homologacao'
  serie_dps       TEXT        -- série da DPS (default '1')
  proximo_numero_dps BIGINT   -- auto-incrementado a cada emissão
  codigo_municipio TEXT       -- código IBGE (7 dígitos)
  inscricao_municipal TEXT    -- IM no município
  active          BOOLEAN     -- integração ativa/inativa
  last_test_at    TIMESTAMPTZ -- último teste de conexão
  last_emission_at TIMESTAMPTZ -- última emissão bem-sucedida
)
```

RLS: `is_company_member(company_id)` — qualquer membro da empresa pode ler,
qualquer membro pode alterar (mesmo padrão das tabelas ERP).

### Integração pendente
Para multi-tenant funcionar end-to-end, falta criar uma **edge function**
`nfse-operations` que:
1. Recebe `{ company_id, operation, params }` do frontend/agent
2. Busca `nfse_config` no Supabase pelo `company_id`
3. Decodifica `cert_pfx_base64` → Buffer
4. Instancia `CertManager` com o buffer + password
5. Instancia `AdnHttpClient` com o ambiente da config
6. Executa a operação (emitir, cancelar, etc.)
7. Atualiza `proximo_numero_dps` e `last_emission_at`

---

## Variáveis de Ambiente

```env
NFSE_AMBIENTE=homologacao          # "producao" ou "homologacao"
NFSE_CERT_PATH=/certs/empresa.pfx  # caminho para o .pfx (single-tenant)
NFSE_CERT_PASSWORD=senha-do-pfx    # senha do certificado
NFSE_CERT_STORAGE=file             # "file" | "vault" | "supabase"
```

---

## Configuração para Claude Desktop

```json
{
  "mcpServers": {
    "nfse-nacional": {
      "command": "node",
      "args": ["nfse-nacional-mcp/dist/index.js"],
      "env": {
        "NFSE_AMBIENTE": "homologacao",
        "NFSE_CERT_PATH": "/caminho/para/certificado.pfx",
        "NFSE_CERT_PASSWORD": "sua-senha-aqui"
      }
    }
  }
}
```

---

## Erros Comuns do ADN

| Código | Significado | Ação |
|---|---|---|
| E001 | CNPJ não encontrado no CNC | Verificar cadastro do prestador |
| E110 | Série da DPS não numérica | Usar série numérica (obrigatório >= jan/2026) |
| E200 | Certificado inválido/expirado | Renovar certificado A1 |
| E300 | Município não aderido ao ADN | Verificar com a prefeitura |
| E410 | Prazo de cancelamento expirado | Prazo máximo: 35 dias |
| E500 | DPS duplicada (idDps já processado) | Consultar nota existente |

---

## Constantes

| Constante | Valor | Origem |
|---|---|---|
| CHAVE_ACESSO_LENGTH | 50 | Layout NFS-e Nacional |
| PRAZO_CANCELAMENTO_DIAS | 35 | Legislação federal |
| MAX_LOTE_SIZE | 50 | Limite do ADN |
| DPS_VERSAO | "1.00" | Layout atual |
| XML_NAMESPACE | `http://www.sped.fazenda.gov.br/nfse` | Spec oficial |

---

## Gaps para Produção

| Item | Status | Prioridade |
|---|---|---|
| Testes automatizados | Não implementado | Alta |
| Retry com backoff (5xx) | Não implementado | Alta |
| Idempotência (cache de idDps) | Não implementado | Alta |
| Edge function multi-tenant | Não implementado | Média |
| Série numérica condicional (>= 2026-01) | Não implementado | Média |
| Logging estruturado | Apenas console.error | Baixa |
| Métricas/observabilidade | Não implementado | Baixa |
