import './MultiSelect.css';
export interface MultiSelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}
export interface MultiSelectProps {
    options: MultiSelectOption[];
    /** Valores selecionados */
    value?: string[];
    onChange?: (values: string[]) => void;
    label?: string;
    placeholder?: string;
    hint?: string;
    error?: boolean;
    disabled?: boolean;
    /** Limite máximo · 0 = ilimitado */
    max?: number;
    size?: 'sm' | 'md';
}
/**
 * `<MultiSelect>` · seletor de múltiplos valores com chips
 *
 * Dropdown com checkboxes · valores selecionados aparecem como chips no trigger.
 * Click em chip remove. Suporta limite máximo.
 *
 * @example
 * <MultiSelect
 *   options={skills}
 *   max={5}
 *   onChange={setSkills}
 * />
 */
export declare function MultiSelect({ options, value: controlledValue, onChange, label, placeholder, hint, error, disabled, max, size, }: MultiSelectProps): import("react/jsx-runtime").JSX.Element;
