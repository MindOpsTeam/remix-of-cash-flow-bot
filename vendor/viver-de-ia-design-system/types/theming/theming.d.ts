import { type ReactNode } from 'react';
import { type ThemeMode } from './theming-core';
export interface ThemeProviderProps {
    /** Tema inicial · default 'light' (padrão da marca · white-first).
     *  Passe 'system' explicitamente se quiser seguir prefers-color-scheme. */
    defaultMode?: ThemeMode;
    /** Persistir em localStorage · default true */
    persist?: boolean;
    children: ReactNode;
}
/**
 * ThemeProvider · opcional.
 *
 * O DS funciona sem Provider — tokens são CSS-first via data-theme.
 * Use o Provider quando quiser:
 *  - state React-aware (useTheme em qualquer componente filho)
 *  - persistência localStorage automática
 *  - escutar prefers-color-scheme changes
 *
 * @example
 * <ThemeProvider>          // claro por padrão · marca white-first
 *   <App />
 * </ThemeProvider>
 */
export declare function ThemeProvider({ defaultMode, persist, children, }: ThemeProviderProps): import("react/jsx-runtime").JSX.Element;
