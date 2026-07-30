import { type ReactNode } from 'react';
import './ContextMenu.css';
export interface ContextMenuOption {
    label: ReactNode;
    /** Callback ao clicar */
    onSelect?: () => void;
    /** Ícone opcional à esquerda */
    icon?: ReactNode;
    /** Atalho keyboard exibido à direita (display only) */
    shortcut?: string;
    /** Tone destrutivo (coral) */
    destructive?: boolean;
    /** Desabilitado */
    disabled?: boolean;
    /** Separador antes deste item */
    separatorBefore?: boolean;
}
export interface ContextMenuProps {
    /** Elemento que recebe right-click pra abrir o menu */
    children: ReactNode;
    /** Opções do menu */
    items: ContextMenuOption[];
    /** Label ARIA */
    label?: string;
}
/**
 * `<ContextMenu>` · menu de clique direito editorial
 *
 * Usa contextmenu event nativo · posiciona no cursor · keyboard arrow nav.
 * Ao abrir, foca o primeiro item habilitado. ArrowDown/Up navegam entre os
 * itens (pulando os desabilitados, com wrap), Home/End vão pro primeiro/último,
 * Enter/Espaço ativam e fecham. Fecha em click fora, Escape, ou seleção.
 *
 * @example
 * <ContextMenu items={[
 *   { label: 'Editar', icon: <Edit size={13} />, onSelect: () => {} },
 *   { label: 'Duplicar', shortcut: '⌘D' },
 *   { label: 'Excluir', destructive: true, separatorBefore: true },
 * ]}>
 *   <div>Click direito aqui</div>
 * </ContextMenu>
 */
export declare function ContextMenu({ children, items, label }: ContextMenuProps): import("react/jsx-runtime").JSX.Element;
