/**
 * useDialogFocus · foco acessível de diálogo modal (WCAG 2.4.3 + dialog pattern)
 *
 * Ao abrir: guarda quem tinha o foco e move o foco pro primeiro focável do
 * diálogo. Enquanto aberto: Tab/Shift+Tab ciclam SÓ dentro do diálogo (trap).
 * Ao fechar: devolve o foco pro elemento que abriu.
 *
 * Uso: aplique `tabIndex={-1}` e `onKeyDown` (retornado) no elemento role="dialog".
 */
export declare function useDialogFocus(open: boolean, dialogRef: React.RefObject<HTMLElement | null>): {
    onKeyDown: (e: React.KeyboardEvent) => void;
};
