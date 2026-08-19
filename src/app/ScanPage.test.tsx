import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ScanPage from './ScanPage'

/**
 * jsdom has no real camera/video decoding, so these tests fake just enough
 * of the browser surface for ScanPage's own logic to run for real: a
 * minimal `BarcodeDetector` (forcing the native-detector branch, where torch
 * control lives) and a `getUserMedia` stub returning a fake track whose
 * capabilities/constraints we control directly — no real video frames
 * needed, since nothing here calls `.detect()` deliberately.
 */
function installFakeCamera({ torch }: { torch: boolean }) {
  class FakeBarcodeDetector {
    detect() {
      return Promise.resolve([])
    }
  }
  vi.stubGlobal('BarcodeDetector', FakeBarcodeDetector)

  const applyConstraints = vi.fn().mockResolvedValue(undefined)
  const track = {
    stop: vi.fn(),
    getCapabilities: () => (torch ? { torch: true } : {}),
    applyConstraints,
  } as unknown as MediaStreamTrack

  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream

  vi.stubGlobal('navigator', {
    ...navigator,
    mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) },
  })

  return { applyConstraints }
}

beforeEach(() => {
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function renderScanPage() {
  return render(
    <MemoryRouter initialEntries={['/scan?meal=breakfast']}>
      <ScanPage />
    </MemoryRouter>
  )
}

describe('ScanPage failure UX (Phase 10.5)', () => {
  it('shows a torch toggle once the camera reports torch support', async () => {
    installFakeCamera({ torch: true })
    renderScanPage()

    await waitFor(() => expect(screen.getByTestId('torch-toggle')).toBeInTheDocument())
  })

  it('omits the torch toggle when the camera does not report torch support', async () => {
    installFakeCamera({ torch: false })
    renderScanPage()

    // Give the async getUserMedia/play chain a tick to settle either way.
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled())
    expect(screen.queryByTestId('torch-toggle')).not.toBeInTheDocument()
  })

  it('reveals the manual-entry fallback after 5s of an active camera not decoding anything', async () => {
    vi.useFakeTimers()
    installFakeCamera({ torch: false })
    renderScanPage()

    // Flush the getUserMedia()/video.play() microtask chain so cameraStatus
    // settles to 'active' before the 5s no-decode timer is even started.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.queryByTestId('manual-entry-fallback')).not.toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(screen.getByTestId('manual-entry-fallback')).toBeInTheDocument()
  })
})
