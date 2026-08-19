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

/** Not yet in TS's default DOM lib. Fired by Chromium browsers when a PWA is installable. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent
}
