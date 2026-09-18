import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SetupResponse } from '../domain/ai/setup'
import QuickOnboardingFlow from './QuickOnboardingFlow'

const auth = vi.hoisted(() => ({ userId: 'account-a' as string | null }))
const save = vi.hoisted(() => vi.fn())
vi.mock('../lib/auth/authClient', () => ({
  useSession: () => ({
    data: auth.userId ? { user: { id: auth.userId } } : null,
    isPending: false,
  }),
}))
vi.mock('../lib/onboarding/saveSetup', () => ({ saveSetup: save }))

const fetchMock = vi.fn()
const apiResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})
const draft: SetupResponse = {
  draft: {
    name: 'Taylor A',
    age: 32,
    sex: 'female',
    heightCm: 175,
    weightKg: 75,
    activityLevel: 'moderate',
    goal: 'maintain',
    dietStyle: null,
  },
  notes: ['A macro preference was not supplied.'],
}
const view = () => (
  <MemoryRouter initialEntries={['/onboarding']}>
    <QuickOnboardingFlow onDetailed={vi.fn()} />
  </MemoryRouter>
)

function startAI(description = '  I am Taylor A, 32, female, 175 cm and 75 kg.  ') {
  fireEvent.click(screen.getByRole('button', { name: /Draft with AI/i }))
  fireEvent.change(screen.getByLabelText('About you'), { target: { value: description } })
  fireEvent.click(screen.getByRole('button', { name: 'Fill my details' }))
}

beforeEach(() => {
  auth.userId = 'account-a'
  fetchMock.mockReset()
  save.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('AI setup failure boundaries', () => {
  it('aborts an account A request and never applies its late draft to account B', async () => {
    let resolveReply: (value: ReturnType<typeof apiResponse>) => void = () => {}
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveReply = resolve
      })
    )
    const result = render(view())
    fireEvent.change(screen.getByLabelText('What should we call you?'), {
      target: { value: 'Account A manual name' },
    })
    startAI()
    const [, options] = fetchMock.mock.calls[0]
    expect(options.signal.aborted).toBe(false)
    expect(JSON.parse(options.body)).toEqual({
      description: 'I am Taylor A, 32, female, 175 cm and 75 kg.',
    })
    expect(screen.getByLabelText('What should we call you?')).toBeDisabled()
    expect(screen.getByLabelText('About you')).toBeDisabled()

    auth.userId = 'account-b'
    result.rerender(view())
    expect(options.signal.aborted).toBe(true)
    expect(screen.getByLabelText('What should we call you?')).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: /Draft with AI/i }))
    expect(screen.getByLabelText('About you')).toHaveValue('')

    await act(async () => {
      resolveReply(apiResponse(draft))
    })
    expect(screen.getByLabelText('What should we call you?')).toHaveValue('')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText(draft.notes[0])).not.toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
  })

  it('clears already-applied personal details when the account changes', async () => {
    fetchMock.mockResolvedValue(apiResponse(draft))
    const result = render(view())
    startAI()
    await waitFor(() =>
      expect(screen.getByLabelText('What should we call you?')).toHaveValue('Taylor A')
    )
    fireEvent.click(screen.getByTestId('quick-setup-continue'))
    expect(screen.getByLabelText('Age')).toHaveValue(32)
    expect(screen.getByLabelText('Calculation sex')).toHaveValue('female')

    auth.userId = 'account-b'
    result.rerender(view())
    expect(screen.getByLabelText('What should we call you?')).toHaveValue('')
    fireEvent.change(screen.getByLabelText('What should we call you?'), {
      target: { value: 'Account B' },
    })
    fireEvent.click(screen.getByTestId('quick-setup-continue'))
    expect(screen.getByLabelText('Age')).toHaveValue(null)
    expect(screen.getByLabelText('Calculation sex')).toHaveValue('')
    expect(save).not.toHaveBeenCalled()
  })

  it('shows extraction notes and permits manual setup when every extracted field is null', async () => {
    const empty: SetupResponse = {
      draft: {
        name: null,
        age: null,
        sex: null,
        heightCm: null,
        weightKg: null,
        activityLevel: null,
        goal: null,
        dietStyle: null,
      },
      notes: ['Height and weight were not supplied.'],
    }
    fetchMock.mockResolvedValue(apiResponse(empty))
    render(view())
    fireEvent.change(screen.getByLabelText('What should we call you?'), {
      target: { value: 'Manual name' },
    })
    startAI('I would like to understand my meals.')
    expect(await screen.findByRole('alert')).toHaveTextContent(/No setup details were found/i)
    expect(screen.getByText(empty.notes[0])).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByLabelText('What should we call you?')).toHaveValue('Manual name')
    expect(screen.getByTestId('quick-setup-continue')).toBeEnabled()
    fireEvent.click(screen.getByTestId('quick-setup-continue'))
    expect(screen.getByLabelText('Age')).toHaveValue(null)
    expect(save).not.toHaveBeenCalled()
  })

  it.each([
    ['rate_limited', /busy right now/i, /daily limit/i],
    ['daily_limit', /daily limit/i, /busy right now/i],
  ])('distinguishes %s without blocking manual setup', async (code, expected, wrongMessage) => {
    fetchMock.mockResolvedValue(apiResponse({ code }, 429))
    render(view())
    startAI()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(expected)
    expect(alert).not.toHaveTextContent(wrongMessage)
    expect(screen.getByLabelText('What should we call you?')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Fill my details' })).toBeEnabled()
    expect(screen.getByTestId('quick-setup-continue')).toBeEnabled()
    expect(save).not.toHaveBeenCalled()
  })
})
