import { type ReactNode } from 'react';
import './VirtualList.css';
export interface VirtualListProps<T> {
    /** Array de items */
    items: T[];
    /** Altura fixa de cada item em px · default 48 */
    itemHeight?: number;
    /** Altura do container · default 400 */
    height?: number;
    /** Buffer de items renderizados além do visível · default 5 */
    overscan?: number;
    /** Render function de cada item */
    renderItem: (item: T, index: number) => ReactNode;
    /** Label ARIA */
    label?: string;
    /** Estado vazio */
    emptyState?: ReactNode;
}
/**
 * `<VirtualList>` · lista performática pra 10000+ items
 *
 * Renderiza apenas items visíveis + buffer (overscan). Suporta scroll suave,
 * acessibilidade via role="list" e per-item position absoluto. Use pra:
 * notifications, logs, mensagens, audit trails, busca em massa.
 *
 * @example
 * <VirtualList
 *   items={messages}
 *   itemHeight={64}
 *   height={500}
 *   renderItem={(msg) => <MessageRow message={msg} />}
 * />
 */
export declare function VirtualList<T>({ items, itemHeight, height, overscan, renderItem, label, emptyState, }: VirtualListProps<T>): import("react/jsx-runtime").JSX.Element;
