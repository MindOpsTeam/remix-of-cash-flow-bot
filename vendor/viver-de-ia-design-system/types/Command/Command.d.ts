import { type ReactNode } from 'react';
import './Command.css';
export interface CommandItem {
    /** Stable id passed back to `onSelect` */
    id: string;
    /** Visible label */
    label: string;
    /** Optional smaller hint shown next to label */
    hint?: string;
    /** Optional leading icon */
    icon?: ReactNode;
    /** Optional keyboard shortcut tag (e.g. "G N") */
    shortcut?: string;
    /** Additional searchable text (label is searched by default) */
    keywords?: string;
}
export interface CommandGroup {
    /** Group label (rendered as small caps eyebrow) */
    heading?: string;
    items: CommandItem[];
}
export interface CommandProps {
    /** Controlled open */
    open: boolean;
    /** Close handler · called on ESC, scrim click, or after select */
    onClose: () => void;
    /** Selection callback · receives the item id */
    onSelect: (id: string) => void;
    /** Flat items OR grouped */
    groups?: CommandGroup[];
    /** Convenience: flat items become a single unlabeled group */
    items?: CommandItem[];
    /** Search input placeholder */
    placeholder?: string;
    /** Caption shown when no results match */
    emptyLabel?: string;
}
/**
 * Command · keyboard-first action palette (Cmd+K style).
 *
 * - Input filters items live (label + keywords)
 * - ↑↓ moves selection · Enter triggers · ESC closes
 * - Closes after select (caller dispatches navigation)
 *
 * @example
 * const [open, setOpen] = useState(false);
 * useKbd('cmd+k', () => setOpen(true));
 * <Command
 *   open={open}
 *   onClose={() => setOpen(false)}
 *   onSelect={(id) => navigate(id)}
 *   groups={[
 *     { heading: 'Navegação', items: [{ id: '/aluno', label: 'Aluno · jornada' }] },
 *     { heading: 'Ações',     items: [{ id: 'new-note', label: 'Nova nota', shortcut: 'N' }] },
 *   ]}
 * />
 */
export declare function Command({ open, onClose, onSelect, groups, items, placeholder, emptyLabel, }: CommandProps): import("react/jsx-runtime").JSX.Element | null;
