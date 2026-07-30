import './Spinner.css';
type Size = 'sm' | 'md' | 'lg';
type Tone = 'navy' | 'inverse' | 'soft';
export interface SpinnerProps {
    size?: Size;
    tone?: Tone;
    label?: string;
    className?: string;
}
/**
 * Spinner · loader inline determinístico · ARIA live region
 *
 * @example
 * <Spinner />
 * <Spinner size="lg" tone="inverse" label="Carregando dashboard…" />
 */
export declare function Spinner({ size, tone, label, className }: SpinnerProps): import("react/jsx-runtime").JSX.Element;
export {};
