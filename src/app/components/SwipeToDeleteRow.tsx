import { motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from 'framer-motion'
import { useRef, type MouseEvent, type PointerEvent, type ReactNode } from 'react'

const DELETE_THRESHOLD_PX = -80
const DRAG_CLICK_SUPPRESS_PX = 5

interface Props {
  onDelete: () => void
  deleteLabel: string
  children: ReactNode
}

/** Wraps a row with a left-swipe-to-delete gesture; reveals a red "Delete" affordance underneath as you drag. */
export default function SwipeToDeleteRow({ onDelete, deleteLabel, children }: Props) {
  const prefersReducedMotion = useReducedMotion()
  const x = useMotionValue(0)
  const deleteOpacity = useTransform(x, [DELETE_THRESHOLD_PX, 0], [1, 0])
  const didDragRef = useRef(false)

  // The browser's native click fires as soon as pointerup resolves — before
  // framer-motion's own onDragEnd callback runs — so the "did we actually
  // drag" flag has to be set live, during onDrag, not read back afterward.
  function handleDrag(_: unknown, info: PanInfo) {
    if (Math.abs(info.offset.x) > DRAG_CLICK_SUPPRESS_PX) didDragRef.current = true
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x <= DELETE_THRESHOLD_PX) onDelete()
  }

  // The row's own tap/edit handler lives on a plain <button> nested inside the
  // draggable layer, not on the motion.div itself — framer-motion only
  // suppresses its own synthetic tap gesture, so a real drag still lets the
  // browser's native click reach that nested button afterward. Swallow it here.
  function handleClickCapture(e: MouseEvent) {
    if (didDragRef.current) {
      e.stopPropagation()
      e.preventDefault()
      didDragRef.current = false
    }
  }

  if (prefersReducedMotion) {
    return <div className="relative bg-white dark:bg-surface-dark-card">{children}</div>
  }

  return (
    <div className="relative overflow-hidden bg-white dark:bg-surface-dark-card">
      <motion.div
        style={{ opacity: deleteOpacity }}
        className="pointer-events-none absolute inset-0 flex items-center justify-end bg-danger-600 pr-4 text-caption font-medium text-white"
        aria-hidden="true"
      >
        {deleteLabel}
      </motion.div>
      <motion.div
        drag="x"
        style={{ x }}
        dragConstraints={{ left: -120, right: 0 }}
        dragElastic={{ left: 0.3, right: 0 }}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onClickCapture={handleClickCapture}
        // The Today dashboard wraps its whole body in a horizontal drag="x"
        // (date-swipe navigation). Without this, a row-level drag here and the
        // page-level drag both start tracking the same pointerdown and race for
        // the shared 'x'-axis lock, so a swipe can be silently stolen by the
        // page instead of deleting the row. Stopping propagation here keeps the
        // row's own drag exclusive.
        onPointerDown={(e: PointerEvent) => e.stopPropagation()}
        className="relative z-10 bg-white dark:bg-surface-dark-card"
      >
        {children}
      </motion.div>
    </div>
  )
}
