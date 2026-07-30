import { type ReactNode } from 'react';
import './DropdownMenu.css';
export interface DropdownMenuItem {
    id: string;
    label: ReactNode;
    icon?: ReactNode;
    shortcut?: ReactNode;
    onSelect?: () => void;
    destructive?: boolean;
    disabled?: boolean;
}
export interface DropdownMenuGroup {
    id: string;
    label?: ReactNode;
    items: DropdownMenuItem[];
}
export interface DropdownMenuProps {
    /** Botão/elemento que dispara o menu · será envolto em wrapper */
    trigger: ReactNode;
    /** Items planos (sem grupos) ou groups (com separator entre cada) */
    items?: DropdownMenuItem[];
    groups?: DropdownMenuGroup[];
    align?: 'start' | 'end';
    ariaLabel?: string;
    className?: string;
}
/**
 * DropdownMenu · context/overflow menu · ARIA menu/menuitem
 *
 * Navegação por teclado (WAI-ARIA menu): ao abrir foca o primeiro item;
 * ArrowDown/Up movem o foco (roving tabindex) pulando disabled, Home/End vão
 * pro primeiro/último, Enter/Space ativam, Escape fecha e devolve foco ao trigger.
 *
 * @example
 * <DropdownMenu
 *   trigger={<Button iconLeft={<MoreHorizontal />} aria-label="Mais opções" />}
 *   items={[
 *     { id: 'edit',   label: 'Editar perfil', icon: <Edit /> },
 *     { id: 'share',  label: 'Compartilhar',  icon: <Share /> },
 *     { id: 'delete', label: 'Excluir',       icon: <Trash />, destructive: true },
 *   ]}
 * />
 */
export declare function DropdownMenu({ trigger, items, groups, align, ariaLabel, className, }: DropdownMenuProps): import("react/jsx-runtime").JSX.Element;
