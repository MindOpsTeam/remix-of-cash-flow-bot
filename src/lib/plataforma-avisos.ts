/**
 * A frase do projeto original, num lugar só.
 *
 * Ela aparece na faixa do preview, na tela de login, no `AGENTS.md` e na base de
 * conhecimento do Lovable. Quatro cópias soltas divergem com o tempo e a pessoa
 * que lê duas versões diferentes conclui que nenhuma vale. Mudou aqui, mudou em
 * todos — e o teste `trava-projeto-original.test.ts` trava isso.
 *
 * Todo texto daqui só é EXIBIDO quando `plataforma_bloqueada()` é verdadeiro, o
 * que só acontece no banco original. Num remix a função devolve falso e nada
 * disto renderiza: o cliente não vê aviso nenhum.
 */

/** Título curto, para barra e cabeçalho. */
export const AVISO_TITULO = "PARE. ESTE É O PROJETO ORIGINAL. NÃO EDITE AQUI.";

/** Uma linha, para caber numa barra fina. */
export const AVISO_LINHA =
  "Projeto original, somente leitura: o banco recusa escrita e o cadastro está bloqueado. Faça o Remix para liberar tudo na sua cópia.";

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

/** Onde a pessoa aprende a remixar. */
export const URL_COMO_REMIXAR = "https://docs.lovable.dev/features/remix";
