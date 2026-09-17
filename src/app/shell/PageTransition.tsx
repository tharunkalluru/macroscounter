import { useLayoutEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

/** Frequent navigation is instant; feedback belongs to the action that changed data.
 * Keying the route still synchronously removes the previous screen and its controls.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation()
  useLayoutEffect(() => {
    if (window.scrollX || window.scrollY) window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.pathname])
  return <div key={location.pathname}>{children}</div>
}
