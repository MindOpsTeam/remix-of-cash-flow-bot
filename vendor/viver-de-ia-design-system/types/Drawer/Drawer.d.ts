import { type ReactNode } from 'react';
import './Drawer.css';
type Side = 'right' | 'left' | 'bottom';
type Size = 'sm' | 'md' | 'lg';
export interface DrawerProps {
    open: boolean;
    onClose: () => void;
    side?: Side;
    size?: Size;
    title?: string;
    description?: string;
    children?: ReactNode;
    footer?: ReactNode;
    hideClose?: boolean;
}
export declare function Drawer({ open, onClose, side, size, title, description, children, footer, hideClose, }: DrawerProps): import("react/jsx-runtime").JSX.Element | null;
export {};
