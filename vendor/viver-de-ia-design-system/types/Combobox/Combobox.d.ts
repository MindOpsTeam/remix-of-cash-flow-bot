import { type ReactNode } from 'react';
import './Combobox.css';
export interface ComboboxOption {
    value: string;
    label: ReactNode;
    /** Texto que vai ser usado pelo filtro de busca · default usa label se for string */
    searchText?: string;
    disabled?: boolean;
}
export interface ComboboxProps {
    options: ComboboxOption[];
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    placeholder?: string;
    emptyLabel?: string;
    label?: string;
    ariaLabel?: string;
    className?: string;
    size?: 'sm' | 'md';
    disabled?: boolean;
}
/**
 * Combobox · select com search interno · ARIA combobox/listbox
 *
 * @example
 * <Combobox
 *   label="Cidade do evento"
 *   placeholder="Buscar cidade…"
 *   options={[
 *     { value: 'sp',  label: 'São Paulo · SP' },
 *     { value: 'rj',  label: 'Rio de Janeiro · RJ' },
 *     { value: 'poa', label: 'Porto Alegre · RS' },
 *   ]}
 *   onValueChange={(v) => console.log(v)}
 * />
 */
export declare function Combobox({ options, value, defaultValue, onValueChange, placeholder, emptyLabel, label, ariaLabel, className, size, disabled, }: ComboboxProps): import("react/jsx-runtime").JSX.Element;
