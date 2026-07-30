import { type ReactNode } from 'react';
import './Accordion.css';
export interface AccordionItem {
    id: string;
    title: ReactNode;
    content: ReactNode;
    disabled?: boolean;
}
export interface AccordionProps {
    items: AccordionItem[];
    defaultOpen?: string | string[];
    /** Se true, vários painéis abertos ao mesmo tempo. Default false (FAQ-style). */
    multiple?: boolean;
    /** Variante visual */
    variant?: 'default' | 'separated';
    className?: string;
}
/**
 * Accordion · expandir/colapsar com keyboard nav
 *
 * @example
 * <Accordion
 *   items={[
 *     { id: 'q1', title: 'Como funciona a mentoria?', content: <p>...</p> },
 *     { id: 'q2', title: 'Posso cancelar?', content: <p>...</p> },
 *   ]}
 * />
 */
export declare function Accordion({ items, defaultOpen, multiple, variant, className, }: AccordionProps): import("react/jsx-runtime").JSX.Element;
