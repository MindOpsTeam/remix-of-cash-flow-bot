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

/**
 * Diz ao banco em que ambiente o app está rodando.
 *
 * Os agendamentos do pg_cron precisam chamar as edge functions DESTA instalação.
 * A URL não pode ser constante no SQL: função viaja no remix, e uma URL fixa
 * faria todo cliente chamar as funções do projeto de origem. Quem sabe o
 * endereço certo é o app, então é ele quem informa.
 */
export async function registrarAmbiente(): Promise<void> {
  try {
    const base = import.meta.env.VITE_SUPABASE_URL;
    if (!base) return;
    await (supabase.rpc as unknown as (fn: string, args: Record<string, string>) => PromiseLike<unknown>)(
      "registrar_ambiente",
      { p_functions_url: `${String(base).replace(/\/+$/, "")}/functions/v1` },
    );
  } catch {
    /* higiene silenciosa: sem isto os agendamentos apenas não rodam */
  }
}

/**
 * Consagra quem está logado como dono, se ainda não houver um.
 *
 * Existe porque gatilho em auth.users NÃO sobrevive ao remix do Lovable: as
 * funções vêm, os gatilhos não. Sem esta chamada, o primeiro usuário de um remix
 * nunca virava dono — e sem dono a trava de convite nunca engatava.
 */
export const consagrarDonoSePrimeiro = () => rpcBooleana("consagrar_dono_se_primeiro");

/** Sou o primeiro usuário cadastrado, o dono da instalação? */
export const souDonoDaPlataforma = () => rpcBooleana("sou_dono_da_plataforma");

/**
 * A instalação ainda aceita cadastro por autosserviço?
 *
 * Verdadeiro enquanto não houver dono (o primeiro cadastro é sempre livre e vira
 * o administrador) ou se o dono tiver reaberto o autosserviço de propósito. Nos
 * demais casos entra-se só por convite.
 */
export async function cadastroEstaAberto(): Promise<boolean> {
  try {
    const { data, error } = await (supabase.rpc as unknown as RpcSemTipo)("cadastro_esta_aberto");
    // Falha para ABERTO de propósito, ao contrário das outras. Base sem esta
    // migration responderia "fechado" e o formulário de criar conta sumiria —
    // travando a instalação inteira antes mesmo de existir um administrador.
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

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
