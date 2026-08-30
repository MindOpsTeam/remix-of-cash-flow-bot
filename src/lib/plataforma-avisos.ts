/**
 * A frase do projeto original, num lugar só.
 *
 * Ela aparece na faixa do preview, no `AGENTS.md` e no `LEIA-ANTES-DE-EDITAR.md`.
 * Cópias soltas divergem com o tempo, e quem lê duas versões diferentes conclui
 * que nenhuma vale. Mudou aqui, mudou em todos — e o teste
 * `trava-projeto-original.test.tsx` trava isso.
 *
 * Todo texto daqui só é EXIBIDO quando `plataforma_bloqueada()` é verdadeiro, o
 * que só acontece no banco original. Num remix a função devolve falso e nada
 * disto renderiza: o cliente não vê aviso nenhum.
 */

/** Frase forte, para os arquivos de instrução e a base de conhecimento. */
export const AVISO_TITULO = "PARE. ESTE É O PROJETO ORIGINAL. NÃO EDITE AQUI.";

/** Uma linha, para a faixa e para a descrição do modal. */
export const AVISO_LINHA =
  "Este projeto é o modelo distribuído para ser remixado: o banco recusa escrita e o cadastro está bloqueado. Na sua cópia tudo destrava sozinho.";

/** Título do modal. Convida em vez de gritar: quem abre já quer remixar. */
export const MODAL_TITULO = "Faça o seu remix em 3 passos";

/** O texto inteiro, para a base de conhecimento e os arquivos do repositório. */
export const AVISO_COMPLETO = `${AVISO_TITULO}

Este projeto é o MODELO distribuído para ser remixado. Ele é somente leitura: o
banco recusa toda escrita, o cadastro está bloqueado e qualquer alteração feita
aqui será revertida sem aviso.

FAÇA O REMIX. Clique em Remix no topo do Lovable. Na sua cópia tudo destrava
sozinho — cadastro liberado, primeira conta vira administradora, e você edita à
vontade, como em qualquer projeto seu.

Sem o remix você não consegue mexer, nem criar conta, nem publicar. Insistir
aqui só gasta o seu crédito e o seu tempo.`;

export interface PassoDoRemix {
  titulo: string;
  detalhe: string;
  /** Caminho em `public/remix/`. Sem imagem quando o passo é só espera. */
  imagem?: string;
  largura?: number;
  altura?: number;
}

/**
 * O caminho real do remix, com print de cada tela.
 *
 * A primeira versão mandava para `docs.lovable.dev/features/remix`, que responde
 * 404. Instrução que aponta para página morta é pior que instrução nenhuma:
 * a pessoa conclui que o processo é complicado e desiste. Os prints são do
 * próprio editor, então não há como a tela não bater com o que está escrito.
 */
export const PASSOS_DO_REMIX: PassoDoRemix[] = [
  {
    titulo: "Clique no nome do projeto",
    detalhe:
      "No topo do editor do Lovable, à esquerda, em “FinanceAI - Projeto Original”. Abre o menu do projeto.",
    imagem: "/remix/passo-1-titulo.png",
    largura: 600,
    altura: 116,
  },
  {
    titulo: "Escolha Remix no menu",
    detalhe:
      "É a opção com o ícone de duas setas, logo abaixo de “Move to folder”, já destacada no print.",
    imagem: "/remix/passo-2-menu.png",
    largura: 520,
    altura: 267,
  },
  {
    titulo: "Troque o workspace para o SEU e confirme",
    detalhe:
      "O campo “Target workspace” vem preenchido com o VIVER DE IA Team Workspace — troque para o seu, senão a cópia nasce fora do seu espaço. Deixe “Include custom knowledge” LIGADO e clique em Remix. Em alguns minutos a sua cópia fica pronta, já com cadastro liberado e a primeira conta virando administradora.",
    imagem: "/remix/passo-3-modal.png",
    largura: 560,
    altura: 549,
  },
];
