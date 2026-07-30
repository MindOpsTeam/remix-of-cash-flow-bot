import { type ReactNode } from 'react';
import './EmptyState.css';
type Variant = 'default' | 'soft' | 'navy';
export interface EmptyStateProps {
    icon?: ReactNode;
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    secondary?: ReactNode;
    variant?: Variant;
    className?: string;
}
/**
 * EmptyState · placeholder editorial pra listas/queries vazias
 *
 * @example
 * <EmptyState
 *   icon={<Inbox size={20} strokeWidth={1.8} />}
 *   title="Nenhuma mentoria agendada"
 *   description="Sua próxima sessão aparece aqui assim que o mentor confirmar."
 *   action={<Button variant="primary">Agendar agora</Button>}
 *   secondary={<Button variant="ghost">Ver disponibilidades</Button>}
 * />
 */
export declare function EmptyState({ icon, title, description, action, secondary, variant, className, }: EmptyStateProps): import("react/jsx-runtime").JSX.Element;
export {};
