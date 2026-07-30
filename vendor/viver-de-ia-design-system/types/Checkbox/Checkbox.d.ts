import { type InputHTMLAttributes, type ReactNode } from 'react';
import './Checkbox.css';
export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label?: ReactNode;
    description?: ReactNode;
    indeterminate?: boolean;
}
/**
 * Checkbox · editorial · suporta estado indeterminate
 *
 * @example
 * <Checkbox label="Aceito os termos" />
 * <Checkbox label="Selecionar todos" indeterminate />
 */
export declare const Checkbox: import("react").ForwardRefExoticComponent<CheckboxProps & import("react").RefAttributes<HTMLInputElement>>;
