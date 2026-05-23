import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface CardProps extends HTMLAttributes<HTMLDivElement> { }

export const Card = forwardRef<HTMLDivElement, CardProps>(
    ({ className, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "rounded-2xl border border-white/5 bg-mantle-darker/60 backdrop-blur-xl p-6 shadow-xl transition-all duration-500 opacity-0 translate-y-5 animate-fade-in",
                    className
                )}
                {...props}
            />
        )
    }
)
Card.displayName = "Card"