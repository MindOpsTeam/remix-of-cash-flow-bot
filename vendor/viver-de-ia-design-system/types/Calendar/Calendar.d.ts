import './Calendar.css';
export interface CalendarProps {
    /** Data selecionada (controlado) */
    value?: Date | null;
    /** Callback ao selecionar dia */
    onChange?: (date: Date) => void;
    /** Mês inicial (default: hoje) */
    defaultMonth?: Date;
    /** Data mínima selecionável */
    min?: Date;
    /** Data máxima selecionável */
    max?: Date;
    /** Locale (default: pt-BR) */
    locale?: string;
    /** Mostra dias da semana antes */
    showWeekdays?: boolean;
    /** Markers · dots em datas específicas (eventos, deadlines, etc.) */
    markers?: {
        date: Date;
        tone?: 'navy' | 'coral' | 'success';
        label?: string;
    }[];
}
/**
 * `<Calendar>` · calendário standalone navegável
 *
 * Diferente do `<DatePicker>` (campo input + popup), este renderiza inline.
 * Use em painéis de agenda, dashboards, eventos. Mês a mês · header pt-BR.
 *
 * Navegação por teclado na grade (roving tabindex): setas movem ±1 dia
 * (horizontal) / ±7 dias (vertical), Home/End vão pro início/fim da semana,
 * PageUp/PageDown trocam de mês, Enter/Espaço selecionam. Dias desabilitados
 * são pulados.
 *
 * @example
 * <Calendar
 *   value={selected}
 *   onChange={setSelected}
 *   markers={[{ date: liveDay, tone: 'coral', label: 'Live ao vivo' }]}
 * />
 */
export declare function Calendar({ value, onChange, defaultMonth, min, max, locale, showWeekdays, markers, }: CalendarProps): import("react/jsx-runtime").JSX.Element;
