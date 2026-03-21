"use client"

import { useEffect, useRef } from "react"
import { motion, useMotionValue, useTransform, useAnimationControls, animate } from "framer-motion"

interface RollingNumberProps {
  value: number
  decimals?: number
  className?: string
}

export function RollingNumber({ value, decimals = 0, className = "" }: RollingNumberProps) {
  const motionValue = useMotionValue(value)
  const display = useTransform(motionValue, (current) => current.toFixed(decimals))
  const pulseControls = useAnimationControls()
  const prevValue = useRef(value)

  useEffect(() => {
    const changed = prevValue.current !== value
    prevValue.current = value

    const controls = animate(motionValue, value, {
      duration: 0.4,
      ease: "easeOut",
    })

    if (changed) {
      pulseControls.start({
        scale: [1, 1.06, 1],
        transition: { duration: 0.3, ease: "easeOut" },
      })
    }

    return controls.stop
  }, [motionValue, value, pulseControls])

  return <motion.span animate={pulseControls} className={className}>{display}</motion.span>
}
