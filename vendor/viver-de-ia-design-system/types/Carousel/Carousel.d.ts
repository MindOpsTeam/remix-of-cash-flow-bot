import { type ReactNode } from 'react';
import './Carousel.css';
export interface CarouselProps {
    /** Slides (cada child vira um slide) */
    children: ReactNode[];
    /** Slide ativo controlado */
    index?: number;
    /** Callback ao mudar slide */
    onIndexChange?: (index: number) => void;
    /** Mostra setas de navegação · default true */
    showArrows?: boolean;
    /** Mostra dots de paginação · default true */
    showDots?: boolean;
    /** Auto-play em ms · 0 = desabilita · default 0 */
    autoPlay?: number;
    /** Loop infinito · default true */
    loop?: boolean;
    /** Label acessível */
    label?: string;
}
/**
 * `<Carousel>` · gallery slider com touch swipe + keyboard nav + auto-play
 *
 * Use pra: depoimentos, galerias de fotos, onboarding slides, casos de uso.
 * Suporta touch swipe (mobile), setas de teclado, auto-play opcional.
 *
 * @example
 * <Carousel autoPlay={5000} loop>
 *   <div>Slide 1</div>
 *   <div>Slide 2</div>
 *   <div>Slide 3</div>
 * </Carousel>
 */
export declare function Carousel({ children, index: controlledIndex, onIndexChange, showArrows, showDots, autoPlay, loop, label, }: CarouselProps): import("react/jsx-runtime").JSX.Element;
