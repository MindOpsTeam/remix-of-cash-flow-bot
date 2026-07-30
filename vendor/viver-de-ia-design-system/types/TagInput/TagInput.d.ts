import './TagInput.css';
export interface TagInputProps {
    /** Tags atuais */
    value?: string[];
    /** Callback ao adicionar/remover */
    onChange?: (tags: string[]) => void;
    /** Label visível */
    label?: string;
    /** Placeholder do input */
    placeholder?: string;
    /** Hint abaixo */
    hint?: string;
    /** Limite máximo de tags · 0 = ilimitado */
    max?: number;
    /** Tags sugeridas mostradas como suggestions */
    suggestions?: string[];
    /** Permite duplicatas · default false */
    allowDuplicates?: boolean;
    /** Estado de erro */
    error?: boolean;
    /** Disabled */
    disabled?: boolean;
    /** Variant de tamanho */
    size?: 'sm' | 'md';
}
/**
 * `<TagInput>` · campo de chips/tags com input livre + sugestões
 *
 * Use pra: tags em artigos, skills no perfil, filtros multi-keyword, etc.
 * Enter ou vírgula adiciona · Backspace no campo vazio remove última.
 *
 * @example
 * <TagInput
 *   label="Skills"
 *   suggestions={['React', 'TypeScript', 'IA']}
 *   max={5}
 *   onChange={(tags) => setSkills(tags)}
 * />
 */
export declare function TagInput({ value: controlledValue, onChange, label, placeholder, hint, max, suggestions, allowDuplicates, error, disabled, size, }: TagInputProps): import("react/jsx-runtime").JSX.Element;
