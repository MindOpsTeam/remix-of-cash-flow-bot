import './Lightbox.css';
export interface LightboxImage {
    src: string;
    alt: string;
    caption?: string;
    /** Link de download · default = src */
    downloadHref?: string;
}
export interface LightboxProps {
    open: boolean;
    onClose: () => void;
    images: LightboxImage[];
    /** Index inicial */
    index?: number;
    /** Mostra botão de download · default false */
    showDownload?: boolean;
}
/**
 * `<Lightbox>` · foto em tela cheia editorial
 *
 * Múltiplas imagens · setas keyboard/touch · escape close · download opcional.
 *
 * @example
 * <Lightbox
 *   open={lightboxOpen}
 *   onClose={close}
 *   images={[{ src: '/foto.jpg', alt: 'Caio na live', caption: '14 mai 2026' }]}
 * />
 */
export declare function Lightbox({ open, onClose, images, index, showDownload }: LightboxProps): import("react/jsx-runtime").JSX.Element | null;
