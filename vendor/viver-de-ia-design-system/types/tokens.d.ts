/**
 * Design tokens. Auto-generated from src/styles/tokens.css.
 * DO NOT EDIT by hand. Regenerate via `bun run build:tokens`.
 *
 * @example
 *   import { tokens, type TokenName } from '@viverdeia/design-system/tokens';
 *   const navy = tokens['via-navy']; // => '#0A1F3B'
 *   tokens['via-radius-lg'];          // => '20px'
 */
export interface Token {
    /** Token name without the leading '--' (e.g. 'via-navy') */
    name: string;
    /** Full CSS variable name (e.g. '--via-navy') */
    css: string;
    /** Raw literal value as written in tokens.css */
    value: string;
    /** Coarse category for tooling and docs */
    category: 'color' | 'spacing' | 'radius' | 'shadow' | 'font' | 'motion' | 'surface' | 'other';
}
export declare const tokensList: readonly Token[];
export declare const tokens: Readonly<Record<TokenName, string>>;
export type TokenName = 'via-accent' | 'via-accent-deep' | 'via-accent-light' | 'via-accent-soft' | 'via-accent-warm' | 'via-bg' | 'via-black' | 'via-blue' | 'via-blue-soft' | 'via-border' | 'via-border-hairline' | 'via-border-soft' | 'via-chart-1' | 'via-chart-2' | 'via-chart-3' | 'via-chart-4' | 'via-chart-5' | 'via-chart-ink' | 'via-chart-ink-2' | 'via-coral' | 'via-coral-dark' | 'via-coral-deep' | 'via-danger' | 'via-data-1' | 'via-data-1-dark' | 'via-data-2' | 'via-data-2-dark' | 'via-data-axis' | 'via-data-grid' | 'via-data-ink' | 'via-edge-hi' | 'via-edge-lo' | 'via-glass-bar' | 'via-gray-100' | 'via-gray-200' | 'via-gray-300' | 'via-gray-400' | 'via-gray-50' | 'via-gray-500' | 'via-gray-600' | 'via-gray-700' | 'via-gray-800' | 'via-gray-900' | 'via-ink-2' | 'via-ink-3' | 'via-navy' | 'via-navy-02' | 'via-navy-03' | 'via-navy-04' | 'via-navy-05' | 'via-navy-06' | 'via-navy-08' | 'via-navy-10' | 'via-navy-12' | 'via-navy-14' | 'via-navy-16' | 'via-navy-18' | 'via-navy-20' | 'via-navy-22' | 'via-navy-25' | 'via-navy-30' | 'via-navy-40' | 'via-navy-60' | 'via-navy-80' | 'via-navy-darker' | 'via-navy-deep' | 'via-stage-1' | 'via-stage-2' | 'via-stage-soft' | 'via-success' | 'via-surface' | 'via-surface-elev' | 'via-text' | 'via-text-body' | 'via-text-faint' | 'via-text-inverse' | 'via-text-muted' | 'via-text-primary' | 'via-text-soft' | 'via-warning' | 'via-white' | 'via-display' | 'via-font' | 'via-font-display' | 'via-font-mono' | 'via-fs-display' | 'via-mono' | 'via-ease' | 'via-ease-out' | 'via-ease-snap' | 'via-ease-spring' | 'via-t' | 'via-blur-lg' | 'via-blur-md' | 'via-blur-sm' | 'via-blur-xl' | 'via-border-1' | 'via-border-fine' | 'via-border-strong' | 'via-container' | 'via-content' | 'via-dur' | 'via-fs-body' | 'via-fs-caption' | 'via-fs-h1' | 'via-fs-h2' | 'via-fs-h3' | 'via-fs-h4' | 'via-fs-hero' | 'via-fs-label' | 'via-fs-micro' | 'via-fs-sm' | 'via-fs-xs' | 'via-fw-black' | 'via-fw-bold' | 'via-fw-light' | 'via-fw-medium' | 'via-fw-regular' | 'via-fw-semibold' | 'via-glass-blur' | 'via-glass-blur-bar' | 'via-glass-card' | 'via-glass-card-2' | 'via-glass-ring' | 'via-glass-sheen' | 'via-glow-navy' | 'via-glow-navy-strong' | 'via-lh-loose' | 'via-lh-normal' | 'via-lh-snug' | 'via-lh-tight' | 'via-ls-brand' | 'via-ls-label' | 'via-ls-mark' | 'via-ls-tight' | 'via-ls-tighter' | 'via-ls-wide' | 'via-narrow' | 'via-surface-onnavy' | 'via-t-fast' | 'via-t-slow' | 'via-radius-2xl' | 'via-radius-lg' | 'via-radius-md' | 'via-radius-pill' | 'via-radius-sm' | 'via-radius-xl' | 'via-radius-xs' | 'via-glass-shadow' | 'via-glass-shadow-lift' | 'via-shadow-focus' | 'via-shadow-glass-dark' | 'via-shadow-glass-light' | 'via-shadow-ink-03' | 'via-shadow-ink-06' | 'via-shadow-ink-10' | 'via-shadow-ink-14' | 'via-shadow-ink-20' | 'via-shadow-ink-30' | 'via-shadow-ink-40' | 'via-shadow-ink-60' | 'via-shadow-lg' | 'via-shadow-md' | 'via-shadow-sm' | 'via-shadow-xl' | 'via-shadow-xs' | 'via-space-1' | 'via-space-10' | 'via-space-12' | 'via-space-14' | 'via-space-16' | 'via-space-2' | 'via-space-20' | 'via-space-24' | 'via-space-3' | 'via-space-32' | 'via-space-4' | 'via-space-5' | 'via-space-6' | 'via-space-7' | 'via-space-8' | 'via-space-9' | 'via-bg-2' | 'via-bg-3' | 'via-bg-soft' | 'via-mesh-light' | 'via-mesh-navy' | 'via-noise';
/** CSS var() reference for a token. Returns 'var(--via-navy)' for 'via-navy'. */
export declare function cssVar(name: TokenName): string;
