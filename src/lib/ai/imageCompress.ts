// Claude's vision input has no quality benefit past ~1568px on the longest
// edge -- larger images just cost more input tokens. Downscaling client-side
// also keeps the request well under Vercel's function body-size limit.
const MAX_EDGE_PX = 1568
const JPEG_QUALITY = 0.85

/** Pure sizing math, unit-testable without a real image/canvas. */
export function computeTargetDimensions(
  width: number,
  height: number,
  maxEdge: number = MAX_EDGE_PX
): { width: number; height: number } {
  const longestEdge = Math.max(width, height)
  if (longestEdge <= maxEdge) return { width, height }
  const scale = maxEdge / longestEdge
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** Strips the `data:image/jpeg;base64,` prefix a canvas data URL carries. */
export function stripDataUrlPrefix(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',')
  return commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1)
}

/**
 * Downscales and re-encodes a picked photo as JPEG, ready to send to
 * `/api/ai/analyze`. Runs entirely client-side via an offscreen canvas.
 */
export async function compressImageFile(file: Blob): Promise<{ data: string; mediaType: string }> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(objectUrl)
    const { width, height } = computeTargetDimensions(image.naturalWidth, image.naturalHeight)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    ctx.drawImage(image, 0, 0, width, height)

    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    return { data: stripDataUrlPrefix(dataUrl), mediaType: 'image/jpeg' }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load the selected photo'))
    img.src = src
  })
}
