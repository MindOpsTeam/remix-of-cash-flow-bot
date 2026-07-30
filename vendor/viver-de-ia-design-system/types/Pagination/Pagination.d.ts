import './Pagination.css';
export interface PaginationProps {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    ariaLabel?: string;
    className?: string;
    /** Número máximo de páginas numeradas visíveis (default 7 · ímpar recomendado) */
    maxVisible?: number;
}
/**
 * Pagination · numerada editorial · prev/next + elipses
 *
 * @example
 * <Pagination page={current} totalPages={42} onPageChange={setCurrent} />
 */
export declare function Pagination({ page, totalPages, onPageChange, ariaLabel, className, maxVisible, }: PaginationProps): import("react/jsx-runtime").JSX.Element | null;
