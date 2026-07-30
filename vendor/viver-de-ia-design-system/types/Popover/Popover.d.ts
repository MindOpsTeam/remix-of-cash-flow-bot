import { type ReactNode } from 'react';
import './Popover.css';
type Side = 'top' | 'bottom' | 'left' | 'right';
type Align = 'start' | 'center' | 'end';
export interface PopoverProps {
    /** Open state · controlled */
    open: boolean;
    /** Called when the popover should close (outside click, ESC, etc.) */
    onOpenChange: (open: boolean) => void;
    /** Trigger element · rendered inline; clicking toggles `open` */
    trigger: ReactNode;
    /** Floating content */
    children: ReactNode;
    /** Preferred side relative to trigger (default `bottom`) */
    side?: Side;
    /** Alignment along the side axis (default `center`) */
    align?: Align;
    /** Close on outside click (default true) */
    closeOnOutsideClick?: boolean;
    /** Close on ESC key (default true) */
    closeOnEscape?: boolean;
    /** Accessible label for the popover region */
    label?: string;
}
/**
 * Popover · floating panel anchored to a trigger.
 * Controlled. Closes on outside click + ESC. Editorial atmosphere.
 *
 * @example
 * const [open, setOpen] = useState(false);
 * <Popover
 *   open={open}
 *   onOpenChange={setOpen}
 *   trigger={<Button onClick={() => setOpen(o => !o)}>Filtros</Button>}
 *   side="bottom"
 *   align="end"
 * >
 *   <h4>Filtrar por</h4>
 *   <Checkbox label="Concluídos" />
 *   <Checkbox label="Em andamento" />
 * </Popover>
 */
export declare function Popover({ open, onOpenChange, trigger, children, side, align, closeOnOutsideClick, closeOnEscape, label, }: PopoverProps): import("react/jsx-runtime").JSX.Element;
export {};
