import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { INTEGRACAO_POR_ID } from "@/lib/integracoes-catalogo";
import { DialogIntegracao } from "@/components/integracoes/ConfiguracaoIntegracao";

/**
 * O que o catálogo declara precisa APARECER na tela.
 *
 * Já aconteceu de o guia mandar "clique no botão no assistente" e o botão só
 * existir noutra tela, e de o passo a passo mandar montar a URL do webhook à
 * mão porque a tela não a mostrava. Declarar não é entregar: estes testes
 * renderizam o modal de verdade.
 */

function montar(id: string) {
  const integracao = INTEGRACAO_POR_ID[id];
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <DialogIntegracao
          integracao={integracao}
          aberto
          companyId="11111111-1111-1111-1111-111111111111"
          onFechar={() => {}}
          onSalvou={() => {}}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.stubEnv("VITE_SUPABASE_URL", "https://exemplo.supabase.co"));
afterEach(() => vi.unstubAllEnvs());

describe("webhook: a URL aparece pronta, com botão copiar", () => {
  it("Asaas mostra o endereço desta instalação", () => {
    montar("asaas");
    expect(screen.getByText("https://exemplo.supabase.co/functions/v1/company-asaas-webhook")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copiar/i })).toBeInTheDocument();
  });

  it("Stripe mostra o endereço dele", () => {
    montar("stripe");
    expect(screen.getByText("https://exemplo.supabase.co/functions/v1/stripe-webhook")).toBeInTheDocument();
  });

  it("diz o que quebra sem o webhook, em vez de só mostrar a URL", () => {
    montar("asaas");
    // sem consequência escrita, o passo vira opcional na cabeça de quem lê
    expect(screen.getByText(/nunca avisa que recebeu/i)).toBeInTheDocument();
  });

  it("integração sem webhook não inventa bloco nenhum", () => {
    montar("gcp");
    expect(screen.queryByText(/URL do webhook desta instalação/i)).not.toBeInTheDocument();
  });
});

describe("credencial que nasce aqui tem botão de gerar", () => {
  it("o token do webhook do Asaas é gerável", () => {
    montar("asaas");
    expect(screen.getByRole("button", { name: /^gerar$/i })).toBeInTheDocument();
  });

  it("a chave do worker de NFS-e é gerável", () => {
    montar("nfse");
    expect(screen.getByRole("button", { name: /^gerar$/i })).toBeInTheDocument();
  });

  it("chave que vem do provedor NÃO oferece gerar", () => {
    // gerar uma chave do Stripe do nosso lado não faria sentido nenhum
    montar("stripe");
    expect(screen.queryByRole("button", { name: /^gerar$/i })).not.toBeInTheDocument();
  });
});

describe("o botão prometido pelo guia existe onde o guia diz", () => {
  it("NFS-e traz o botão de criar o worker dentro do próprio modal", () => {
    montar("nfse");
    const botao = screen.getByRole("link", { name: /criar meu worker no railway/i });
    expect(botao).toHaveAttribute("href", expect.stringContaining("railway.com/deploy"));
  });

  it("o destino é o deploy, não a página do repositório", () => {
    montar("nfse");
    const botao = screen.getByRole("link", { name: /criar meu worker no railway/i });
    expect(botao.getAttribute("href")).not.toMatch(/^https:\/\/github\.com/);
  });
});

describe("certificado digital A1", () => {
  it("pede arquivo e senha, e promete o cofre", () => {
    montar("certificado");
    // getAllBy: o rótulo aparece no campo e também no passo a passo do guia
    expect(screen.getAllByText(/Arquivo do certificado/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Senha do certificado/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/cofre cifrado do servidor/i)).toBeInTheDocument();
  });

  it("oferece testar, porque agora existe teste de verdade", () => {
    montar("certificado");
    expect(screen.getByRole("button", { name: /testar conexão/i })).toBeInTheDocument();
  });
});

describe("guia do WhatsApp ensina só os caminhos suportados", () => {
  it("cita Hostinger e Cloudfy", () => {
    const guia = INTEGRACAO_POR_ID.whatsapp.guia.passos.join(" ");
    expect(guia).toMatch(/Hostinger/);
    expect(guia).toMatch(/Cloudfy/);
  });

  it("não manda mais o dono de PME subir Docker nem editar variável de ambiente", () => {
    const texto = [
      ...INTEGRACAO_POR_ID.whatsapp.guia.passos,
      ...(INTEGRACAO_POR_ID.whatsapp.guia.preRequisitos ?? []),
    ].join(" ");
    expect(texto).not.toMatch(/docker/i);
    expect(texto).not.toMatch(/AUTHENTICATION_API_KEY/);
  });
});
