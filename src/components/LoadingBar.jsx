import { useEffect, useRef, useState } from 'react'

// Global request counter — incremented by the Axios interceptors in api/client.js.
let count = 0
const listeners = new Set()

export function incRequests() {
  count++
  listeners.forEach((cb) => cb(count))
}
export function decRequests() {
  count = Math.max(0, count - 1)
  listeners.forEach((cb) => cb(count))
}

/**
 * Slim top-of-screen progress bar that appears whenever any Axios request is
 * in flight. Styled to match Tishe's gold accent so it's visible in both themes.
 */
export default function LoadingBar() {
  const [active, setActive] = useState(false)
  const [width, setWidth] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    const cb = (n) => {
      if (n > 0) {
        setActive(true)
        // Animate to a "waiting" width; jump to 100 % when done.
        setWidth(70)
      } else {
        setWidth(100)
        timerRef.current = setTimeout(() => {
          setActive(false)
          setWidth(0)
        }, 300)
      }
    }
    listeners.add(cb)
    return () => {
      listeners.delete(cb)
      clearTimeout(timerRef.current)
    }
  }, [])

  if (!active && width === 0) return null
  return (
    <div className="loading-bar-track" aria-hidden="true">
      <div
        className="loading-bar-fill"
        style={{ width: `${width}%`, transition: width === 100 ? 'width 0.2s ease' : 'width 1.8s ease-out' }}
      />
    </div>
  )
}
