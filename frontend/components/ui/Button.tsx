import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'solid' | 'outline' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
}

type Ref = HTMLButtonElement

export const Button = forwardRef<Ref, ButtonProps>(
    ({ className, variant = 'solid', size = 'md', ...props }, ref) => {

        const baseStyles = "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-mantle-green disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] hover:scale-[1.02]"

        const variants = {
            solid: "bg-mantle-green text-black hover:bg-opacity-90 shadow-[0_0_15px_rgba(0,220,130,0.3)] hover:shadow-[0_0_20px_rgba(0,220,130,0.5)]",
            outline: "border border-mantle-green text-mantle-green hover:bg-mantle-green/10",
            ghost: "text-gray-300 hover:text-white hover:bg-white/5"
        }

        const sizes = {
            sm: "h-8 px-3 text-xs",
            md: "h-10 px-4 py-2 text-sm",
            lg: "h-12 px-8 text-base"
        }

        return (
            <button
                ref={ref}
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"