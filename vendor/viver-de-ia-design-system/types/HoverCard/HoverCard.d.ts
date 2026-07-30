import { type ReactNode } from 'react';
import './HoverCard.css';
export interface HoverCardProps {
    /** Element that triggers the card on hover */
    trigger: ReactNode;
    /** Content shown in the floating card */
    children: ReactNode;
    /** Side the card appears on */
    side?: 'top' | 'bottom' | 'left' | 'right';
    /** Alignment along the cross-axis */
    align?: 'start' | 'center' | 'end';
    /** Delay before showing (ms) · default 300 */
    openDelay?: number;
    /** Delay before hiding (ms) · default 200 */
    closeDelay?: number;
}
/**
 * `<HoverCard>` · floating card on hover/focus
 *
 * Use pra mostrar preview de usuário ao passar mouse no @nome, info adicional
 * em links, ou rich tooltip que precisa de conteúdo complexo. Diferente de
 * Tooltip (texto simples) e Popover (click-trigger).
 *
 * @example
 * <HoverCard trigger={<a>@caioribeiro</a>}>
 *   <Avatar alt="Caio Ribeiro" />
 *   <strong>Caio Ribeiro</strong>
 *   <em>Fundador · Viver de IA</em>
 *   <p>220 mentorados desde 2024</p>
 * </HoverCard>
 */
export declare function HoverCard({ trigger, children, side, align, openDelay, closeDelay, }: HoverCardProps): import("react/jsx-runtime").JSX.Element;
