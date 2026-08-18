/// <reference types="vite/client" />

interface DetectedBarcode {
  rawValue: string
}

/** Experimental Shape Detection API — not yet in TS's default DOM lib. */
declare class BarcodeDetector {
  constructor(options?: { formats: string[] })
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}

interface Window {
  BarcodeDetector?: typeof BarcodeDetector
}
