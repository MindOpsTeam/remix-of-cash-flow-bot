import { type ReactNode } from 'react';
import './Stepper.css';
export interface StepItem {
    id: string;
    label: ReactNode;
    description?: ReactNode;
}
type Orientation = 'horizontal' | 'vertical';
export interface StepperProps {
    steps: StepItem[];
    /** Índice 0-based do passo atual (em progresso) */
    current: number;
    orientation?: Orientation;
    /** Permite clicar em passos anteriores pra voltar */
    onStepClick?: (index: number) => void;
    ariaLabel?: string;
    className?: string;
}
/**
 * Stepper · wizard editorial · horizontal ou vertical · ARIA nav
 *
 * @example
 * <Stepper
 *   ariaLabel="Onboarding"
 *   current={2}
 *   steps={[
 *     { id: 'profile', label: 'Perfil', description: 'Quem é você' },
 *     { id: 'role',    label: 'Função', description: 'Onde atua' },
 *     { id: 'plan',    label: 'Plano',  description: 'Como vamos te apoiar' },
 *   ]}
 * />
 */
export declare function Stepper({ steps, current, orientation, onStepClick, ariaLabel, className, }: StepperProps): import("react/jsx-runtime").JSX.Element;
export {};
