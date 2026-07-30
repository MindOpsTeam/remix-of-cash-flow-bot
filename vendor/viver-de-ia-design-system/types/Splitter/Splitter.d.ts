import { type ReactNode } from 'react';
import './Splitter.css';
export interface SplitterProps {
    /** Painel da esquerda (ou topo) */
    start: ReactNode;
    /** Painel da direita (ou baixo) */
    end: ReactNode;
    /** Orientação · default 'horizontal' (start/end são esquerda/direita) */
    orientation?: 'horizontal' | 'vertical';
    /** Posição inicial em % (0-100) · default 50 */
    defaultSplit?: number;
    /** Posição controlada */
    split?: number;
    onSplitChange?: (pct: number) => void;
    /** Min do painel start em % · default 15 */
    min?: number;
    /** Max do painel start em % · default 85 */
    max?: number;
    /** Label ARIA do handle */
    handleLabel?: string;
}
/**
 * `<Splitter>` · divisor arrastável entre 2 painéis
 *
 * Use pra: editor + preview, sidebar + main, code + console. Drag no handle
 * redimensiona · keyboard arrow keys (esq/dir ou up/down) ajusta 1% por step.
 *
 * @example
 * <Splitter
 *   orientation="horizontal"
 *   defaultSplit={30}
 *   start={<Sidebar />}
 *   end={<MainContent />}
 * />
 */
export declare function Splitter({ start, end, orientation, defaultSplit, split: controlledSplit, onSplitChange, min, max, handleLabel, }: SplitterProps): import("react/jsx-runtime").JSX.Element;
