import { type HTMLAttributes } from 'react';
import './Avatar.css';
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type Status = 'online' | 'away' | 'busy' | 'offline';
export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
    src?: string;
    alt?: string;
    initials?: string;
    size?: Size;
    status?: Status;
}
/**
 * Avatar · com fallback de iniciais + status dot opcional
 *
 * @example
 * <Avatar src="..." alt="Bruno" size="md" status="online" />
 * <Avatar initials="BR" size="lg" />
 */
export declare const Avatar: import("react").ForwardRefExoticComponent<AvatarProps & import("react").RefAttributes<HTMLSpanElement>>;
export {};
