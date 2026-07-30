import { type ReactNode } from 'react';
import './TreeView.css';
export interface TreeNode {
    id: string;
    label: ReactNode;
    /** Ícone à esquerda do label */
    icon?: ReactNode;
    /** Filhos · pode estar vazio · undefined = leaf */
    children?: TreeNode[];
    /** Marca o nó como destacado */
    highlighted?: boolean;
    /** Contador (badge à direita) */
    count?: number;
}
export interface TreeViewProps {
    nodes: TreeNode[];
    /** IDs inicialmente expandidos */
    defaultExpanded?: string[];
    /** Modo controlado · IDs expandidos */
    expanded?: string[];
    onExpandedChange?: (ids: string[]) => void;
    /** ID selecionado */
    selected?: string;
    onSelect?: (id: string) => void;
    /** Label ARIA da árvore */
    label?: string;
}
/**
 * `<TreeView>` · árvore hierárquica filesystem-style
 *
 * Use pra: navegação de arquivos, taxonomias de categoria, sumários, sitemap.
 * Expand/collapse com chevron · keyboard arrow nav (WAI-ARIA tree) · ARIA tree.
 *
 * Teclado (roving tabindex · só a linha ativa tem tabIndex 0):
 * - ↓/↑ movem entre linhas VISÍVEIS · Home/End primeira/última visível
 * - → expande (ou foca o primeiro filho se já expandido) · ← colapsa (ou foca o pai)
 * - Enter/Space ativa/seleciona (e alterna expansão num nó-pai)
 *
 * @example
 * <TreeView
 *   nodes={[
 *     { id: 'a', label: 'Curso A', children: [
 *       { id: 'a1', label: 'Aula 1' },
 *       { id: 'a2', label: 'Aula 2' },
 *     ]},
 *   ]}
 *   onSelect={(id) => navigate(id)}
 * />
 */
export declare function TreeView({ nodes, defaultExpanded, expanded: controlledExpanded, onExpandedChange, selected, onSelect, label, }: TreeViewProps): import("react/jsx-runtime").JSX.Element;
