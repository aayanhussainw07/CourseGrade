"use client"

import { useEffect, useRef } from "react"
import { motion, useMotionValue, useTransform, animate } from "framer-motion"

interface RollingNumberProps {
  value: number
  decimals?: number
  className?: string
}

export function RollingNumber({ value, decimals = 0, className = "" }: RollingNumberProps) {
  const motionValue = useMotionValue(value)
  const display = useTransform(motionValue, (current) => current.toFixed(decimals))
  const prevValue = useRef(value)

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 0.4, // Fixed fast duration
      ease: "easeOut",
    })

    prevValue.current = value

    return controls.stop
  }, [motionValue, value])

  return <motion.span className={className}>{display}</motion.span>
}
