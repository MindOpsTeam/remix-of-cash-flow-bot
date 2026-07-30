import './OTPInput.css';
export interface OTPInputProps {
    /** Quantos dígitos (4 ou 6 são padrão) */
    length?: number;
    /** Valor controlado */
    value?: string;
    /** Callback ao mudar */
    onChange?: (value: string) => void;
    /** Callback quando todos os dígitos preenchidos */
    onComplete?: (value: string) => void;
    /** Label visível acima */
    label?: string;
    /** Hint / mensagem abaixo */
    hint?: string;
    /** Estado de erro */
    error?: boolean;
    /** Auto-focus no primeiro campo ao montar */
    autoFocus?: boolean;
    /** Tipo de input · text pra alfanumérico, numeric pra só números */
    inputType?: 'text' | 'numeric';
    /** Desabilita o componente */
    disabled?: boolean;
}
/**
 * `<OTPInput>` · campo de código de verificação (2FA, magic link)
 *
 * Cada dígito em campo separado · navegação automática · paste detecta código
 * completo · backspace navega pra trás.
 *
 * @example
 * <OTPInput length={6} onComplete={(code) => verify(code)} />
 */
export declare function OTPInput({ length, value: controlledValue, onChange, onComplete, label, hint, error, autoFocus, inputType, disabled, }: OTPInputProps): import("react/jsx-runtime").JSX.Element;
