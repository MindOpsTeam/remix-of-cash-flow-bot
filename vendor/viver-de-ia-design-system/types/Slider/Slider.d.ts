import { type ReactNode } from 'react';
import './Slider.css';
type Tone = 'navy' | 'accent' | 'coral';
type Size = 'sm' | 'md' | 'lg';
export interface SliderProps {
    /** Controlled value (clamped to [min, max]) */
    value: number;
    /** Value change callback · fires on every drag step */
    onChange: (value: number) => void;
    /** Minimum value (default 0) */
    min?: number;
    /** Maximum value (default 100) */
    max?: number;
    /** Step granularity (default 1) */
    step?: number;
    /** Visible label */
    label?: ReactNode;
    /** Hint shown below the track */
    hint?: ReactNode;
    /** Show the current value at the end of the track (default true) */
    showValue?: boolean;
    /** Format the value tag (default `n => String(n)`) */
    formatValue?: (n: number) => string;
    /** Visual tone (default 'navy') */
    tone?: Tone;
    /** Track / thumb size (default 'md') */
    size?: Size;
    /** Disable interaction */
    disabled?: boolean;
    /** Accessible label when no visible label */
    ariaLabel?: string;
    /** Marks rendered along the track */
    marks?: Array<{
        value: number;
        label?: string;
    }>;
    /** Optional name for form serialization */
    name?: string;
    /** Optional id (auto if omitted) */
    id?: string;
}
/**
 * Slider · single-thumb range input · editorial.
 *
 * Wraps a native `<input type="range">` to keep keyboard/screen reader
 * behavior for free, then themes it with CSS variables.
 *
 * @example
 * const [vol, setVol] = useState(40);
 * <Slider value={vol} onChange={setVol} label="Volume da live" formatValue={n => `${n}%`} />
 */
export declare function Slider({ value, onChange, min, max, step, label, hint, showValue, formatValue, tone, size, disabled, ariaLabel, marks, name, id, }: SliderProps): import("react/jsx-runtime").JSX.Element;
export {};
