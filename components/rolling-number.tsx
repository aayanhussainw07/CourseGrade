"use client"

import { useEffect, useRef, useState } from "react"

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

interface RollingNumberProps {
  value: number
  decimals?: number
  className?: string
}

export function RollingNumber({ value, decimals = 0, className = "" }: RollingNumberProps) {
  const [display, setDisplay] = useState(value)
  const spanRef = useRef<HTMLSpanElement>(null)
  const rafRef = useRef<number | undefined>()
  const startTimeRef = useRef<number | undefined>()
  const fromRef = useRef(value)
  const prevValue = useRef(value)

  useEffect(() => {
    const changed = prevValue.current !== value
    prevValue.current = value

    if (changed) {
      const el = spanRef.current
      if (el) {
        el.classList.remove("animate-pulse-scale")
        void el.offsetHeight
        el.classList.add("animate-pulse-scale")
      }
    }

    const from = fromRef.current
    const to = value
    const duration = 400

    if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current)
    startTimeRef.current = undefined

    const tick = (timestamp: number) => {
      if (startTimeRef.current === undefined) startTimeRef.current = timestamp
      const elapsed = timestamp - startTimeRef.current
      const t = Math.min(elapsed / duration, 1)
      fromRef.current = from + (to - from) * easeOut(t)
      setDisplay(fromRef.current)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else rafRef.current = undefined
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current) }
  }, [value])

  return (
    <span ref={spanRef} className={className}>
      {display.toFixed(decimals)}
    </span>
  )
}
