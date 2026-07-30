import { type ReactNode } from 'react';
import './RadioGroup.css';
export interface RadioOption {
    value: string;
    label: ReactNode;
    description?: ReactNode;
    disabled?: boolean;
}
export interface RadioGroupProps {
    options: RadioOption[];
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    name?: string;
    ariaLabel?: string;
    className?: string;
}
/**
 * RadioGroup · escolha única entre N opções · ARIA radiogroup
 *
 * @example
 * <RadioGroup
 *   ariaLabel="Plano"
 *   options={[
 *     { value: 'mensal', label: 'Mensal', description: 'R$ 290/mês' },
 *     { value: 'anual',  label: 'Anual · 2 meses grátis', description: 'R$ 2.900/ano' },
 *   ]}
 *   defaultValue="anual"
 *   onValueChange={(v) => console.log(v)}
 * />
 */
export declare function RadioGroup({ options, value, defaultValue, onValueChange, name, ariaLabel, className, }: RadioGroupProps): import("react/jsx-runtime").JSX.Element;
