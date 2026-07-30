import { type ReactNode } from 'react';
import './Modal.css';
type Size = 'sm' | 'md' | 'lg';
export interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    size?: Size;
    children?: ReactNode;
    footer?: ReactNode;
    hideClose?: boolean;
    scrim?: boolean;
}
/**
 * Modal · acessível · ESC fecha · scrim opcional · focus trap básico
 *
 * @example
 * const [open, setOpen] = useState(false);
 * <Modal open={open} onClose={() => setOpen(false)} title="Renovar plano"
 *        footer={<Button onClick={handleConfirm}>Confirmar</Button>}>
 *   <p>Suas próximas 3 cobranças serão de R$ 6.000.</p>
 * </Modal>
 */
export declare function Modal({ open, onClose, title, description, size, children, footer, hideClose, scrim, }: ModalProps): import("react/jsx-runtime").JSX.Element | null;
export {};
