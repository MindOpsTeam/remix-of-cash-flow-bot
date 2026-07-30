import { type ReactNode } from 'react';
import './Breadcrumb.css';
export interface BreadcrumbItem {
    label: ReactNode;
    href?: string;
    onClick?: () => void;
}
export interface BreadcrumbProps {
    items: BreadcrumbItem[];
    separator?: ReactNode;
    ariaLabel?: string;
    className?: string;
}
/**
 * Breadcrumb · navegação hierárquica · ARIA nav + ordered list
 *
 * @example
 * <Breadcrumb
 *   items={[
 *     { label: 'Plataforma', href: '/' },
 *     { label: 'Mentorias', href: '/mentorias' },
 *     { label: 'Sessão 12' }, // sem href = current page
 *   ]}
 * />
 */
export declare function Breadcrumb({ items, separator, ariaLabel, className, }: BreadcrumbProps): import("react/jsx-runtime").JSX.Element;
