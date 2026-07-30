import './TimePicker.css';
export interface TimePickerProps {
    /** Valor controlado · formato "HH:MM" (24h) */
    value?: string;
    /** Callback ao mudar */
    onChange?: (value: string) => void;
    /** Label */
    label?: string;
    /** Hint abaixo */
    hint?: string;
    /** Step em minutos · default 15 */
    step?: 5 | 10 | 15 | 30 | 60;
    /** Min · "HH:MM" */
    min?: string;
    /** Max · "HH:MM" */
    max?: string;
    /** Erro */
    error?: boolean;
    /** Disabled */
    disabled?: boolean;
    /** Variant */
    size?: 'sm' | 'md';
}
/**
 * `<TimePicker>` · seletor de horário (HH:MM 24h) editorial
 *
 * Campo separado com 2 inputs (hora · minuto) navegáveis. Validação de range.
 *
 * @example
 * <TimePicker label="Horário da live" step={30} onChange={setTime} />
 */
export declare function TimePicker({ value: controlledValue, onChange, label, hint, step, min, max, error, disabled, size, }: TimePickerProps): import("react/jsx-runtime").JSX.Element;
