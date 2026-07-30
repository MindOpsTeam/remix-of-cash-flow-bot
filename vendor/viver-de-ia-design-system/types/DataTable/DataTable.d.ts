import { type ReactNode } from 'react';
import './DataTable.css';
export type SortDir = 'asc' | 'desc';
export interface DataTableColumn<T> {
    /** Unique key matching a property of `T` (or arbitrary for derived cells) */
    key: string;
    /** Header label */
    label: ReactNode;
    /** Optional accessor when `key` doesn't map directly · returns sortable primitive */
    accessor?: (row: T) => string | number | Date | null | undefined;
    /** Optional cell renderer · receives the row and returns ReactNode */
    render?: (row: T) => ReactNode;
    /** Whether the column is sortable (default true) */
    sortable?: boolean;
    /** Horizontal alignment (default 'left') */
    align?: 'left' | 'right' | 'center';
    /** Optional fixed width (CSS string) */
    width?: string;
    /** Header eyebrow / hint */
    meta?: string;
}
export interface DataTableProps<T extends Record<string, unknown>> {
    /** Column definitions */
    columns: DataTableColumn<T>[];
    /** Rows */
    data: T[];
    /** Optional caption (visible header above the table) */
    caption?: ReactNode;
    /** Empty-state content when data is empty */
    emptyState?: ReactNode;
    /** Initial sort */
    initialSort?: {
        key: string;
        dir: SortDir;
    };
    /** Controlled sort (overrides internal state when provided) */
    sortBy?: string;
    sortDir?: SortDir;
    /** Notified when the user changes sort */
    onSortChange?: (key: string, dir: SortDir) => void;
    /** Row click handler */
    onRowClick?: (row: T) => void;
    /** Visual density */
    density?: 'comfortable' | 'compact';
    /** Make rows zebra striped */
    zebra?: boolean;
}
/**
 * DataTable · sortable editorial table · light-first.
 *
 * - Click a sortable header to toggle asc/desc (third click clears).
 * - Provide `accessor` when sort needs a derived value.
 * - Provide `render` for ReactNode cells (icons, pills, etc.).
 *
 * @example
 * <DataTable
 *   caption="Mentorados ativos"
 *   columns={[
 *     { key: 'name', label: 'Mentorado' },
 *     { key: 'streak', label: 'Streak', align: 'right' },
 *     { key: 'last', label: 'Última sessão', accessor: r => new Date(r.last) },
 *   ]}
 *   data={rows}
 * />
 */
export declare function DataTable<T extends Record<string, unknown>>({ columns, data, caption, emptyState, initialSort, sortBy, sortDir, onSortChange, onRowClick, density, zebra, }: DataTableProps<T>): import("react/jsx-runtime").JSX.Element;
