export type Theme = 'light' | 'dark';
export type ThemeMode = Theme | 'system';
export interface ThemeContextValue {
    theme: Theme;
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => void;
    toggle: () => void;
}
export declare const ThemeContext: import("react").Context<ThemeContextValue | null>;
export declare const STORAGE_KEY = "via-theme";
export declare function readPreferred(): ThemeMode;
export declare function resolveSystem(): Theme;
/** Aplica o tema no <html> via data-theme attribute. */
export declare function applyTheme(theme: Theme): void;
/**
 * useTheme · lê e controla o tema atual.
 *
 * Funciona com ou sem ThemeProvider:
 *  - com Provider: state React-aware, re-renderiza ao mudar
 *  - sem Provider: lê DOM (data-theme) e usa applyTheme imperativo
 */
export declare function useTheme(): ThemeContextValue;
export type ThemeOverrides = Partial<Record<string, string>>;
export interface CreateThemeOverrideOptions {
    /** Seletor onde aplicar · default ':root' */
    selector?: string;
    /** Aplica só num data-theme específico (light, dark) */
    scope?: Theme;
}
export declare function createThemeOverride(tokens: ThemeOverrides, options?: CreateThemeOverrideOptions): string;
