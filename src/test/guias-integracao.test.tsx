import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { CATALOGO_INTEGRACOES } from "@/lib/integracoes-catalogo";
import { DialogIntegracao } from "@/components/integracoes/ConfiguracaoIntegracao";

/**
 * O guia de cada integração é o que evita o chamado.
 *
 * A Solução é entregue por remix e não tem suporte: se o admin não descobre
 * sozinho onde nasce a chave, ele abandona a integração. Estes testes garantem
 * que o conteúdo existe no catálogo E chega à tela, porque já aconteceu de um
 * campo novo ser escrito no catálogo e nunca ser renderizado.
 */

describe("catálogo: todo guia é acionável", () => {
  for (const integ of CATALOGO_INTEGRACOES) {
    describe(integ.nome, () => {
      it("tem passo a passo com pelo menos 3 passos", () => {
        expect(integ.guia.passos.length).toBeGreaterThanOrEqual(3);
      });

      it("os passos são instruções, não rótulos soltos", () => {
        // passo curto demais costuma ser "Acesse o painel", que não ajuda ninguém
        for (const passo of integ.guia.passos) {
          expect(passo.length, `passo curto demais: "${passo}"`).toBeGreaterThan(25);
        }
      });

      it("diz o custo real", () => {
        expect(integ.guia.custo.length).toBeGreaterThan(30);
      });

      it("responde se dá para testar de graça", () => {
        // a primeira pergunta de quem recebe o template é essa
        expect(integ.guia.trial, `${integ.id} precisa dizer se há teste gratuito`).toBeTruthy();
        expect(integ.guia.trial!.length).toBeGreaterThan(30);
      });

      it("avisa o que costuma dar errado", () => {
        expect(integ.guia.armadilhas?.length, `${integ.id} sem armadilhas`).toBeGreaterThan(0);
      });

      it("diz quanto tempo leva e o que ter em mãos", () => {
        expect(integ.guia.tempoEstimado, `${integ.id} sem tempo estimado`).toBeTruthy();
        expect(integ.guia.preRequisitos?.length, `${integ.id} sem pré-requisitos`).toBeGreaterThan(0);
      });
    });
  }

  it("integração que pede credencial aponta a documentação oficial", () => {
    // exceto a NFS-e por servidor próprio, cujo "provedor" é a própria instalação
    const semDoc = CATALOGO_INTEGRACOES.filter(
      (i) => i.id !== "nfse" && i.campos.some((c) => c.segredo) && !i.guia.documentacao,
    ).map((i) => i.id);
    expect(semDoc, `sem link de documentação: ${semDoc.join(", ")}`).toEqual([]);
  });
});

describe("o guia chega à tela", () => {
  const asaas = CATALOGO_INTEGRACOES.find((i) => i.id === "asaas")!;

  it("renderiza pré-requisitos, passos, armadilhas, trial e custo", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <DialogIntegracao
            integracao={asaas}
            aberto
            onFechar={() => {}}
            onSalvou={() => {}}
            companyId="00000000-0000-0000-0000-000000000000"
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // abre o painel de ajuda
    fireEvent.click(screen.getByRole("button", { name: /Como obter esta chave/i }));

    // os blocos que valem: cada um responde uma pergunta do admin
    expect(screen.getByText(/Tenha em mãos antes de começar/i)).toBeTruthy();
    expect(screen.getByText(/O que costuma dar errado/i)).toBeTruthy();
    expect(screen.getByText(/Dá para testar de graça/i)).toBeTruthy();
    expect(screen.getByText(/Custo estimado/i)).toBeTruthy();
    expect(screen.getByText(/Documentação oficial/i)).toBeTruthy();
  });
});
