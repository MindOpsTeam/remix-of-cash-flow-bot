import { type ReactNode } from 'react';
import './Tabs.css';
export interface TabItem {
    id: string;
    label: string;
    badge?: ReactNode;
    content: ReactNode;
}
type Variant = 'underline' | 'pills';
export interface TabsProps {
    items: TabItem[];
    defaultActiveId?: string;
    activeId?: string;
    onChange?: (id: string) => void;
    variant?: Variant;
    className?: string;
}
/**
 * Tabs · controlled ou uncontrolled · ARIA tablist · keyboard arrow nav
 *
 * @example
 * <Tabs
 *   items={[
 *     { id: 'overview',  label: 'Visão geral', content: <Overview /> },
 *     { id: 'history',   label: 'Histórico', badge: <Pill>12</Pill>, content: <History /> },
 *   ]}
 * />
 */
export declare function Tabs({ items, defaultActiveId, activeId, onChange, variant, className, }: TabsProps): import("react/jsx-runtime").JSX.Element;
export {};
