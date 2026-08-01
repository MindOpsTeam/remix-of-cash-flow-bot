import { supabase } from "@/integrations/supabase/client";

/**
 * RPCs do modo template (`plataforma_bloqueada`, `sou_dono_da_plataforma`).
 *
 * Elas nascem numa migration nova, então ainda não constam nos tipos gerados do
 * Supabase — o cast fica isolado aqui em vez de espalhar `any` pelos hooks.
 * Quando os tipos forem regenerados, basta apagar este arquivo e chamar direto.
 */
type RpcSemTipo = (nome: string) => Promise<{ data: unknown; error: unknown }>;

async function rpcBooleana(nome: string): Promise<boolean> {
  try {
    const { data } = await (supabase.rpc as unknown as RpcSemTipo)(nome);
    return data === true;
  } catch {
    // Base antiga (sem a migration) responde como "não travado / não sou dono":
    // falhar para o lado seguro nunca bloqueia o usuário.
    return false;
  }
}

/** Estamos no banco original do template (escrita bloqueada)? */
export const plataformaBloqueada = () => rpcBooleana("plataforma_bloqueada");

/** Sou o primeiro usuário cadastrado, o dono da instalação? */
export const souDonoDaPlataforma = () => rpcBooleana("sou_dono_da_plataforma");

/**
 * A demonstração pertence a ESTE banco?
 *
 * Num remix a vitrine veio junto por clonagem, mas não é dali: o botão de entrar
 * na demonstração não pode ser oferecido, porque aquela conta está prestes a
 * deixar de existir — e oferecer login que vai falhar é pior que não oferecer.
 */
export const demonstracaoDisponivel = () => rpcBooleana("demonstracao_disponivel");

/**
 * Remove a vitrine herdada por clonagem. No banco original é no-op.
 *
 * Chamada sem sessão de propósito: num remix recém-criado ninguém está logado
 * ainda, e a limpeza precisa acontecer antes de a primeira pessoa ver empresas
 * fictícias como se fossem dela. Falha em silêncio porque é higiene, não fluxo:
 * se a base for antiga e não tiver a função, nada quebra para o usuário.
 */
export async function limparDemonstracaoSeRemixado(): Promise<void> {
  try {
    await (supabase.rpc as unknown as RpcSemTipo)("limpar_demonstracao_se_remixado");
  } catch {
    /* higiene silenciosa */
  }
}
