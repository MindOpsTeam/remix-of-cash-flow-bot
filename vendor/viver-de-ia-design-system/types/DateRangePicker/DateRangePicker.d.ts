import './DateRangePicker.css';
export interface DateRange {
    start: Date | null;
    end: Date | null;
}
export interface DateRangePickerProps {
    value?: DateRange;
    onChange?: (range: DateRange) => void;
    /** Mês inicial · default mês atual */
    defaultMonth?: Date;
    min?: Date;
    max?: Date;
    locale?: string;
    /** Atalhos (presets) · default false */
    showPresets?: boolean;
}
/**
 * `<DateRangePicker>` · intervalo de datas (start + end)
 *
 * 2 cliques: primeiro define start, segundo define end. Highlight visual no
 * intervalo. Atalhos opcionais (últimos 7/30/90 dias).
 *
 * @example
 * <DateRangePicker
 *   showPresets
 *   onChange={(r) => filter(r)}
 * />
 */
export declare function DateRangePicker({ value: controlledValue, onChange, defaultMonth, min, max, locale, showPresets, }: DateRangePickerProps): import("react/jsx-runtime").JSX.Element;
