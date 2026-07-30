import { type ReactNode } from 'react';
import './Tooltip.css';
type Side = 'top' | 'bottom' | 'left' | 'right';
export interface TooltipProps {
    content: ReactNode;
    children: ReactNode;
    side?: Side;
    delay?: number;
}
/**
 * Tooltip · editorial wrapper · hover + focus aware · ARIA-described
 *
 * Follows the WAI-ARIA tooltip pattern: `aria-describedby` lands on the focusable
 * trigger (so screen readers announce the description on focus), and Escape
 * dismisses the tooltip while keeping focus on the trigger.
 *
 * @example
 * <Tooltip content="Adicionar ao calendário" side="top">
 *   <Button iconLeft={<Calendar />} />
 * </Tooltip>
 */
export declare function Tooltip({ content, children, side, delay }: TooltipProps): import("react/jsx-runtime").JSX.Element;
export {};
