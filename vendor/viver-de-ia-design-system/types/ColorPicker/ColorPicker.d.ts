import './ColorPicker.css';
export interface ColorSwatch {
    hex: string;
    name: string;
}
export interface ColorPickerProps {
    /** Cor selecionada (controlado) · ex: '#0A1F3B' */
    value?: string;
    onChange?: (hex: string) => void;
    /** Paleta exibida · default = paleta restrita do Viver de IA */
    palette?: ColorSwatch[];
    label?: string;
    /** Permite digitar hex livre · default true */
    allowCustom?: boolean;
    /** Disabled */
    disabled?: boolean;
}
/**
 * `<ColorPicker>` · seletor de cor canônica + hex livre
 *
 * Default mostra paleta restrita Viver de IA · permite custom hex.
 * Use pra theming, edição de brand color, etc.
 *
 * @example
 * <ColorPicker
 *   value={brandColor}
 *   onChange={setBrandColor}
 *   palette={customPalette}
 * />
 */
export declare function ColorPicker({ value, onChange, palette, label, allowCustom, disabled, }: ColorPickerProps): import("react/jsx-runtime").JSX.Element;
