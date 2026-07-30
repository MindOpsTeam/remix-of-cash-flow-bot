import './DatePicker.css';
export interface DatePickerProps {
    /** Selected date (controlled) · null when empty */
    value: Date | null;
    /** Selection callback · null when cleared */
    onChange: (d: Date | null) => void;
    /** Minimum allowed date (inclusive) */
    min?: Date;
    /** Maximum allowed date (inclusive) */
    max?: Date;
    /** Placeholder when empty */
    placeholder?: string;
    /** Accessible label */
    label?: string;
    /** Visually-hidden text describing the field */
    ariaLabel?: string;
    /** Disable the field */
    disabled?: boolean;
    /** First day of week · 0 = Sunday, 1 = Monday (default 1) */
    weekStartsOn?: 0 | 1;
    /** Format used to display the selected value (default ISO short pt-BR) */
    formatLabel?: (d: Date) => string;
}
/**
 * DatePicker · single date selection · editorial month grid.
 *
 * @example
 * const [date, setDate] = useState<Date | null>(null);
 * <DatePicker value={date} onChange={setDate} label="Data da live" />
 */
export declare function DatePicker({ value, onChange, min, max, placeholder, label, ariaLabel, disabled, weekStartsOn, formatLabel, }: DatePickerProps): import("react/jsx-runtime").JSX.Element;
