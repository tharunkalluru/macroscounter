import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library'

const SUPPORTED_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
]

/**
 * Decodes a product barcode from raw luminance pixel data. This is the
 * headless-testable core used by both the `BarcodeDetector` fallback path
 * and the ZXing video-scan path (which feed it frames from a `<video>` /
 * `<canvas>` element in the browser — not exercised here, since a camera
 * can't run in a test environment).
 */
export function decodeBarcodeFromLuminance(
  luminances: Uint8ClampedArray,
  width: number,
  height: number
): string | null {
  const reader = new MultiFormatReader()
  const hints = new Map()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, SUPPORTED_FORMATS)
  reader.setHints(hints)

  const source = new RGBLuminanceSource(luminances, width, height)
  const bitmap = new BinaryBitmap(new HybridBinarizer(source))

  try {
    return reader.decode(bitmap).getText()
  } catch {
    return null
  } finally {
    reader.reset()
  }
}
