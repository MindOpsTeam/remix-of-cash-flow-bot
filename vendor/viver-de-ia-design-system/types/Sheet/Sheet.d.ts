import { type ReactNode } from 'react';
import './Sheet.css';
export interface SheetProps {
    /** Aberto / fechado */
    open: boolean;
    /** Callback ao fechar (esc, scrim, X) */
    onClose: () => void;
    /** Título */
    title?: ReactNode;
    /** Descrição opcional sob o título */
    description?: ReactNode;
    /** Conteúdo do corpo */
    children: ReactNode;
    /** Ações no rodapé (botões) */
    footer?: ReactNode;
    /** Altura máxima · default 85vh */
    maxHeight?: string;
    /** Mostra grip handle no topo · default true (sinal de "arrasta pra fechar" mobile) */
    showHandle?: boolean;
}
/**
 * `<Sheet>` · bottom sheet (mobile-first) semântico
 *
 * Igual a `<Drawer side="bottom">` mas semanticamente "Sheet" pra mobile UX
 * (configurações rápidas, filtros, contextual actions). Vem com handle grip
 * no topo · gesture-hint visual.
 *
 * @example
 * <Sheet open={open} onClose={close} title="Filtros">
 *   <FilterContent />
 * </Sheet>
 */
export declare function Sheet({ open, onClose, title, description, children, footer, maxHeight, showHandle, }: SheetProps): import("react/jsx-runtime").JSX.Element | null;
