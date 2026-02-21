import { HTMLAttributes, forwardRef } from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface CardProps extends Omit<HTMLMotionProps<"div">, "ref"> { }

export const Card = forwardRef<HTMLDivElement, CardProps>(
    ({ className, ...props }, ref) => {
        return (
            <motion.div
                ref={ref}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className={cn(
                    "rounded-2xl border border-white/5 bg-mantle-darker/60 backdrop-blur-xl p-6 shadow-xl",
                    className
                )}
                {...props}
            />
        )
    }
)
Card.displayName = "Card"
