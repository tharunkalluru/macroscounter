import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CoachChatPage from '../../app/CoachChatPage'
import { todayISO } from '../date'

const session = vi.hoisted(() => ({ id: 'account-a' }))
vi.mock('../auth/authClient', () => ({
  useSession: () => ({ data: { user: { id: session.id } }, isPending: false }),
  signIn: { social: vi.fn() },
}))
vi.mock('../../app/hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: () => ({
    isSupported: false,
    isListening: false,
    start: vi.fn(),
    stop: vi.fn(),
  }),
}))
const fetchMock = vi.fn()
const view = (path = '/coach/chat') => (
  <MemoryRouter initialEntries={[path]}>
    <CoachChatPage />
  </MemoryRouter>
)
const apiResponse = (body: unknown, ok = true) => ({ ok, json: async () => body })

beforeEach(() => {
  session.id = 'account-a'
  sessionStorage.clear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('coach user journey', () => {
  it('prefills an intent without calling AI until the user sends it', async () => {
    fetchMock.mockResolvedValue(apiResponse({ reply: 'Here are two meal ideas.' }))
    render(view('/coach/chat?intent=next-meal'))
    expect((screen.getByLabelText('Ask your coach') as HTMLTextAreaElement).value).toContain(
      'What could I eat next?'
    )
    expect(fetchMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('coach-chat-send-button'))
    await screen.findByText('Here are two meal ideas.')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.localDate).toBe(todayISO())
    expect(body.history).toEqual([])
    expect(screen.getByRole('log')).toHaveAttribute('aria-label', 'Conversation with your AI coach')
  })

  it('keeps a failed question and retries it without duplicating the user message', async () => {
    fetchMock
      .mockResolvedValueOnce(apiResponse({ code: 'daily_limit' }, false))
      .mockResolvedValueOnce(apiResponse({ reply: 'A useful next step.' }))
    render(view())
    fireEvent.change(screen.getByTestId('coach-chat-input'), {
      target: { value: 'Help me with dinner' },
    })
    fireEvent.click(screen.getByTestId('coach-chat-send-button'))
    await screen.findByText(/reached today’s AI limit/)
    fireEvent.click(screen.getByTestId('coach-chat-retry'))
    await screen.findByText('A useful next step.')
    expect(screen.getAllByText('Help me with dinner')).toHaveLength(1)
    const retry = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(retry.message).toBe('Help me with dinner')
    expect(retry.history).toEqual([])
    expect(screen.queryByTestId('coach-chat-retry')).not.toBeInTheDocument()
  })

  it('retains the transcript after leaving and returning, and clears it on request', async () => {
    fetchMock.mockResolvedValue(apiResponse({ reply: 'Your recent meals have variety.' }))
    const first = render(view())
    fireEvent.change(screen.getByTestId('coach-chat-input'), {
      target: { value: 'Review my week' },
    })
    fireEvent.click(screen.getByTestId('coach-chat-send-button'))
    await screen.findByText('Your recent meals have variety.')
    first.unmount()
    render(view())
    expect(screen.getByText('Your recent meals have variety.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('coach-chat-clear'))
    expect(screen.queryByText('Your recent meals have variety.')).not.toBeInTheDocument()
    expect(screen.getByTestId('coach-chat-intro')).toBeInTheDocument()
  })

  it('cancels a pending request on account change without leaking a transcript', async () => {
    let resolveReply: (value: ReturnType<typeof apiResponse>) => void = () => {}
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveReply = resolve
      })
    )
    const screenView = render(view())
    fireEvent.change(screen.getByTestId('coach-chat-input'), {
      target: { value: 'Account A private question' },
    })
    fireEvent.click(screen.getByTestId('coach-chat-send-button'))
    const signal: AbortSignal = fetchMock.mock.calls[0][1].signal
    session.id = 'account-b'
    screenView.rerender(view())
    expect(signal.aborted).toBe(true)
    expect(screen.queryByText('Account A private question')).not.toBeInTheDocument()
    await act(async () => {
      resolveReply(apiResponse({ reply: 'Account A private answer' }))
    })
    await waitFor(() =>
      expect(screen.queryByText('Account A private answer')).not.toBeInTheDocument()
    )
    expect(screen.getByTestId('coach-chat-intro')).toBeInTheDocument()
  })
})
