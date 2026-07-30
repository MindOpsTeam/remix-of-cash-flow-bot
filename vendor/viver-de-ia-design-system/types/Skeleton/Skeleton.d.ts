import { type CSSProperties } from 'react';
import './Skeleton.css';
type Variant = 'text' | 'rect' | 'circle';
export interface SkeletonProps {
    variant?: Variant;
    width?: number | string;
    height?: number | string;
    lines?: number;
    ariaLabel?: string;
    className?: string;
    style?: CSSProperties;
}
/**
 * Skeleton · placeholder de carga com shimmer editorial
 *
 * @example
 * <Skeleton variant="text" lines={3} />
 * <Skeleton variant="circle" width={48} height={48} />
 * <Skeleton variant="rect" width="100%" height={200} />
 */
export declare function Skeleton({ variant, width, height, lines, ariaLabel, className, style, }: SkeletonProps): import("react/jsx-runtime").JSX.Element;
export {};
