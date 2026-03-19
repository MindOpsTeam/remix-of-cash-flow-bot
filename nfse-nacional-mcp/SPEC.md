# NFS-e Nacional MCP Server — Especificação Técnica

> Documentação viva do MCP server `nfse-nacional`.
> Última atualização: 2026-03-18

---

## Visão Geral

MCP Server para integração com o ecossistema NFS-e Nacional do governo federal.
A emissão de NFS-e vai pelo **SEFIN Nacional**, a distribuição/consulta pelo **ADN**.

**Runtime:** Node.js 20+ com TypeScript strict
**Transporte:** stdio (padrão MCP)
**Autenticação:** mTLS com certificado digital ICP-Brasil A1 (.pfx)

---

## Arquitetura de Endpoints

O ecossistema NFS-e Nacional tem **dois servidores distintos**:

| Servidor | Base URL (produção) | Base URL (homologação) | Função |
|---|---|---|---|
| **SEFIN Nacional** | `https://sefin.nfse.gov.br` | `https://sefin.producaorestrita.nfse.gov.br` | Recebe DPS para emissão de NFS-e |
| **ADN** | `https://adn.nfse.gov.br` | `https://adn.producaorestrita.nfse.gov.br` | Distribuição de NFS-e autorizadas, DANFSE |

### Endpoints validados em produção

| Endpoint | Método | Content-Type | Função |
|---|---|---|---|
| `sefin/SefinNacional/nfse` | POST | `application/json` | Emissão de NFS-e (DPS → NFS-e) |
| `adn/contribuintes/DFe/0` | GET | `application/xml` | Distribuição de NFS-e por NSU |
| `adn/danfse/v1?chave=XXX` | GET | `application/pdf` | Download do DANFSE (PDF) |
| `adn/DFe` | POST | `application/json` | Recepção de documentos (ADN interno) |

### Formato de envio ao SEFIN

```json
POST https://sefin.nfse.gov.br/SefinNacional/nfse
Content-Type: application/json

{
  "dpsXmlGZipB64": "<XML da DPS assinada, compactado com GZip, codificado em Base64>"
}
```

### Formato de resposta do SEFIN

```json
{
  "tipoAmbiente": 1,
  "versaoAplicativo": "SefinNacional_1.6.0",
  "dataHoraProcessamento": "2026-03-18T21:00:00-03:00",
  "idDPS": "DPS421660225514036500010300001000000000000001",
  "chaveAcesso": "42166021...",
  "erros": [{ "Codigo": "E0084", "Descricao": "..." }],
  "alertas": [{ "Codigo": "A001", "Descricao": "..." }]
}
```

> **Nota:** O `POST /DFe` no ADN é apenas para recepção de documentos (municipais → ADN),
> NÃO para emissão. A emissão é exclusivamente via SEFIN Nacional.

Documentação oficial: https://www.gov.br/nfse/pt-br
Swagger ADN: https://adn.nfse.gov.br/swagger/v1/swagger.json

---

## Stack

| Camada | Tecnologia | Motivo |
|---|---|---|
| MCP SDK | `@modelcontextprotocol/sdk` ^1.12 | Protocolo padrão para agents |
| HTTP | `node:https` nativo | mTLS via `https.Agent` sem deps extras |
| XML build | `fast-xml-parser` XMLBuilder | Leve, sem DOM, JSON→XML direto |
| XML parse | `fast-xml-parser` XMLParser | Mesmo pacote, bidirecional |
| Assinatura | `xml-crypto` | XML-DSig com C14N correto (enveloped) |
| Certificado | `node-forge` | PKCS#12 load, extração de chave/cert |
| Validação | `zod` (inline no index.ts) | Schemas das 14 tools no registro MCP |
| Cache | Implementação própria (Map + TTL) | Zero deps, TTL 24h padrão |
| Build | `tsc` direto | Sem bundler — ESM puro |

---

## Estrutura de Arquivos

```
nfse-nacional-mcp/
├── src/
│   ├── index.ts                 ← Entry point: registra 14 tools no McpServer
│   ├── config.ts                ← URLs SEFIN/ADN, constantes, loadConfig()
│   ├── auth/
│   │   ├── cert-manager.ts      ← Carrega .pfx (node-forge), extrai key+cert+chain
│   │   └── http-client.ts       ← HTTPS client: postSefin(), postDfe(), getPdf()
│   ├── tools/
│   │   ├── emissao.ts           ← nfse_emitir + nfse_emitir_lote (via SEFIN)
│   │   ├── eventos.ts           ← nfse_cancelar + nfse_substituir (via ADN /DFe)
│   │   ├── consultas.ts         ← nfse_consultar_chave + _dfe + _lote
│   │   ├── documentos.ts        ← nfse_gerar_danfse (via ADN /danfse/v1)
│   │   ├── parametros.ts        ← nfse_parametros_municipio + _contribuinte + cnc + codigos
│   │   └── utils.ts             ← nfse_validar_dps + nfse_status_ambiente
│   ├── xml/
│   │   ├── dps-builder.ts       ← Monta XML da DPS (XSD v1.01) + assina com xml-crypto
│   │   └── nfse-parser.ts       ← Parseia respostas XML do ADN
│   ├── data/
│   │   └── municipios-emissor-nacional.json ← 2.319 municípios com emissor nacional (por UF)
│   ├── cache/
│   │   └── parametros-cache.ts  ← Cache in-memory com TTL (Map-based)
│   └── errors/
│       └── nfse-errors.ts       ← NfseError, NfseValidationError, NfseRejeicaoError
├── dist/                        ← Output do tsc
├── package.json
├── tsconfig.json
└── SPEC.md                      ← Este arquivo
```

---

## XML da DPS (XSD v1.01)

### Formato do ID da DPS (TSIdDPS — 45 caracteres)

```
DPS + cMun(7) + tpInscFed(1) + CNPJ(14) + serie(5) + nDPS(15)
```

Exemplo: `DPS421660225514036500010300001000000000000001`

### Estrutura do XML (ordem obrigatória no schema)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">
  <infDPS Id="DPS...45chars...">
    <tpAmb>1</tpAmb>                          <!-- 1=Produção, 2=Homologação -->
    <dhEmi>2026-03-18T21:00:00-03:00</dhEmi>  <!-- TSDateTimeUTC com offset -->
    <verAplic>ERP-NFSE-MCP-1.0</verAplic>
    <serie>1</serie>                           <!-- Numérica obrigatória >= jan/2026 -->
    <nDPS>1</nDPS>
    <dCompet>2026-03-01</dCompet>              <!-- YYYY-MM-DD -->
    <tpEmit>1</tpEmit>                         <!-- 1=Prestador -->
    <cLocEmi>4216602</cLocEmi>                 <!-- Código IBGE 7 dígitos -->
    <prest>
      <CNPJ>55140365000103</CNPJ>
      <regTrib>
        <opSimpNac>1</opSimpNac>               <!-- 1=Não Optante, 3=ME/EPP -->
        <regEspTrib>0</regEspTrib>             <!-- 0=Nenhum -->
      </regTrib>
    </prest>
    <toma>
      <CNPJ>52246066000160</CNPJ>
      <xNome>VIVER DE IA LTDA</xNome>
    </toma>
    <serv>
      <locPrest>
        <cLocPrestacao>4216602</cLocPrestacao>
      </locPrest>
      <cServ>
        <cTribNac>010601</cTribNac>            <!-- 6 dígitos sem pontos -->
        <xDescServ>Descrição do serviço</xDescServ>
      </cServ>
    </serv>
    <valores>
      <vServPrest>
        <vServ>1350.00</vServ>
      </vServPrest>
      <trib>
        <tribMun>
          <tribISSQN>1</tribISSQN>             <!-- 1=Tributável -->
          <tpRetISSQN>1</tpRetISSQN>           <!-- 1=Não Retido -->
        </tribMun>
        <totTrib>
          <indTotTrib>0</indTotTrib>
        </totTrib>
      </trib>
    </valores>
  </infDPS>
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <!-- Assinatura digital RSA-SHA256 via xml-crypto -->
  </Signature>
</DPS>
```

### Posição da Assinatura

A `<Signature>` é filha de `<DPS>`, posicionada APÓS `</infDPS>`.
O `Reference URI` aponta para o `Id` de `<infDPS>`.

---

## Autenticação mTLS

### Fluxo
1. `CertManager` carrega o `.pfx` via `node-forge` (PKCS#12)
2. Extrai: chave privada (PEM), certificado X.509 (PEM)
3. Chain de CAs intermediários do .pfx é concatenada ao campo `cert` (para enviar ao servidor)
4. `https.Agent` criado com `{ cert, key, minVersion: "TLSv1.2" }` — SEM campo `ca`
   (confia nos CAs do sistema para verificar o certificado do servidor ADN/SEFIN)
5. `AdnHttpClient` usa esse agent para ADN e SEFIN

### Assinatura Digital (xml-crypto)
- Algoritmo: **RSA-SHA256** (enveloped signature)
- Canonicalização: C14N 1.0
- Transforms: enveloped-signature + C14N
- Digest: SHA-256 do conteúdo canonicalizado de `<infDPS>`
- Certificado incluído como `<X509Certificate>` (DER em base64)
- Biblioteca: `xml-crypto` (substitui implementação manual com node-forge)

### Certificado
- Formato: ICP-Brasil A1 (.pfx / PKCS#12)
- Warnings automáticos: 30, 15, 7 dias antes de expirar
- CNPJ extraído do CN do certificado (formato `RAZAO SOCIAL:CNPJ14`)

---

## Municípios e Emissor Nacional

### Requisitos para emissão via SEFIN Nacional

Para emitir NFS-e via API SEFIN Nacional, são necessários:

1. **Município com Emissor Nacional ativo** — o município precisa ter aderido ao
   emissor público nacional (2.319 municípios em fev/2026)
2. **Empresa cadastrada no município** — o CNPJ do prestador deve ter estabelecimento
   no município informado em `cLocEmi` (erro E0084)
3. **Código de serviço administrado** — o `cTribNac` deve estar parametrizado
   pelo município de incidência do ISSQN (erro E0312)

### Arquivo de referência

`src/data/municipios-emissor-nacional.json` contém a lista de municípios por UF
que aceitam emissão via SEFIN Nacional (fonte: gov.br/nfse, atualizado 2026-02-25).

### Municípios que NÃO usam SEFIN Nacional

Municípios grandes como São Paulo, São José-SC e outros mantêm sistemas próprios
(Nota Carioca, NFS-e SP, AtendeNet, etc.). Nesses casos, a emissão é feita pelo
sistema municipal, não pelo SEFIN Nacional.

---

## Erros Comuns do SEFIN/ADN

| Código | Significado | Ação |
|---|---|---|
| RNG6110 | Falha na validação do Schema XML | Verificar estrutura XML conforme XSD v1.01 |
| E0008 | Data de emissão posterior ao processamento | Usar horário BRT (-03:00) |
| E0039 | Município não parametrizado para emissores nacionais | Usar sistema municipal local |
| E0084 | CNPJ não tem estabelecimento no município | Usar município onde a empresa está cadastrada |
| E0310 | Código de tributação não existe | Verificar formato: 6 dígitos sem pontos |
| E0312 | Código não administrado pelo município | Consultar lista de serviços do município |
| E0714 | Erro na assinatura digital | Verificar C14N, posição da Signature, algoritmo |
| E1242 | Tipo DF-e não tratado pelo Sistema Nacional | Formato XML incorreto ou endpoint errado |

---

## Variáveis de Ambiente

```env
NFSE_AMBIENTE=producao             # "producao" ou "homologacao"
NFSE_CERT_PATH=/certs/empresa.pfx  # caminho para o .pfx (single-tenant)
NFSE_CERT_PASSWORD=senha-do-pfx    # senha do certificado
NFSE_CERT_STORAGE=file             # "file" | "vault" | "supabase"
```

---

## Constantes

| Constante | Valor | Origem |
|---|---|---|
| CHAVE_ACESSO_LENGTH | 50 | Layout NFS-e Nacional |
| PRAZO_CANCELAMENTO_DIAS | 35 | Legislação federal |
| MAX_LOTE_SIZE | 50 | Limite do ADN |
| DPS_VERSAO | "1.00" | Layout v1.01 |
| XML_NAMESPACE | `http://www.sped.fazenda.gov.br/nfse` | Spec oficial |
