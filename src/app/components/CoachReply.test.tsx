import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CoachReply from './CoachReply'
import { normalizeCoachReply } from '../../lib/ai/coachReply'

describe('coach reply presentation', () => {
  it('renders headings, paragraphs, lists and emphasis without exposing Markdown markers', () => {
    const { container } = render(
      <CoachReply
        text={
          '## Dinner ideas\n\nTry **one option**:\n- **Tofu:** about 150 g\n- Lentils with *rice*\n\n1. Pick what sounds good.\n2. Adjust to your appetite.'
        }
      />
    )
    expect(screen.getByRole('heading', { name: 'Dinner ideas' })).toBeInTheDocument()
    expect(screen.getAllByRole('list')).toHaveLength(2)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getByText('one option').tagName).toBe('STRONG')
    expect(screen.getByText('rice').tagName).toBe('EM')
    expect(container).not.toHaveTextContent('**')
    expect(container).not.toHaveTextContent('##')
  })

  it('cleans em dashes and encoded variants while preserving the full advice and bullet structure', () => {
    const reply =
      'Try tofu—about 150 g.\n\n— Add rice\n— Add vegetables\n\nThese are estimates &mdash; adjust to your appetite. Allergies matter &#8212; check ingredients.'
    const { container } = render(<CoachReply text={reply} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(container).toHaveTextContent('Try tofu, about 150 g.')
    expect(container).toHaveTextContent('These are estimates, adjust to your appetite.')
    expect(container).toHaveTextContent('Allergies matter, check ingredients.')
    expect(container.textContent).not.toMatch(/[\u2014\u2015]|&mdash;|&#8212;/)
    expect(normalizeCoachReply('A &#x2014; B')).toBe('A, B')
  })

  it('treats model-supplied HTML and scripts as text, never markup', () => {
    const { container } = render(
      <CoachReply
        text={
          '<img src="x" onerror="alert(1)">\n\n<script>alert(1)</script>\n\n**Keep eating regularly.**'
        }
      />
    )
    expect(container.querySelector('img, script')).toBeNull()
    expect(container).toHaveTextContent('<script>alert(1)</script>')
    expect(screen.getByText('Keep eating regularly.').tagName).toBe('STRONG')
  })
})
