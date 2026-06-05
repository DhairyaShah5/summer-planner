'use client'

import * as React from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * Card-like wrapper that fades + slides in on mount, with an optional
 * stagger delay, and gently lifts on hover. Pairs with the dashboard
 * tile grid. Children supply their own visual chrome (Card body).
 */
export function MotionTile({
  index = 0,
  className,
  children,
  ...rest
}: HTMLMotionProps<'div'> & { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.45, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      className={cn('group', className)}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
