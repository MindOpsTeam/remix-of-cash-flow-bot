import { type ReactNode } from 'react';
import './Select.css';
export interface SelectOption {
    value: string;
    label: ReactNode;
    disabled?: boolean;
}
export interface SelectProps {
    options: SelectOption[];
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    error?: string;
    label?: string;
    hint?: string;
    ariaLabel?: string;
    className?: string;
    size?: 'sm' | 'md';
}
/**
 * Select · combobox editorial · keyboard nav · ARIA listbox
 *
 * @example
 * <Select
 *   label="Plano"
 *   placeholder="Selecione um plano"
 *   options={[
 *     { value: 'free',  label: 'Free' },
 *     { value: 'pro',   label: 'Pro · R$ 290/mês' },
 *     { value: 'team',  label: 'Team · R$ 890/mês' },
 *   ]}
 *   onValueChange={(v) => console.log(v)}
 * />
 */
export declare function Select({ options, value, defaultValue, onValueChange, placeholder, disabled, error, label, hint, ariaLabel, className, size, }: SelectProps): import("react/jsx-runtime").JSX.Element;
