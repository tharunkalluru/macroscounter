import type { ReactNode } from 'react'
import { normalizeCoachReply } from '../../lib/ai/coachReply'

type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'ordered' | 'unordered'; items: string[]; start: number }

// The coach uses a small Markdown vocabulary. Build React elements directly:
// model output is never interpreted as HTML, executable code, or a URL.
function inlineText(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`)/g)
    .map((part, index) => {
      if (
        (part.startsWith('**') && part.endsWith('**')) ||
        (part.startsWith('__') && part.endsWith('__'))
      ) {
        return (
          <strong key={index} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        )
      }
      if (
        (part.startsWith('*') && part.endsWith('*')) ||
        (part.startsWith('_') && part.endsWith('_'))
      ) {
        return <em key={index}>{part.slice(1, -1)}</em>
      }
      if (part.startsWith('`') && part.endsWith('`'))
        return <code key={index}>{part.slice(1, -1)}</code>
      return part
    })
}

function replyBlocks(text: string): Block[] {
  const blocks: Block[] = []
  let current: Block | undefined
  for (const rawLine of normalizeCoachReply(text).split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      current = undefined
      continue
    }
    const heading = /^#{1,6}\s+(.+?)(?:\s+#+)?$/.exec(line)
    if (heading) {
      blocks.push({ type: 'heading', text: heading[1] })
      current = undefined
      continue
    }
    const item = /^(?:[-*+•]\s+|(\d+)[.)]\s+)(.*)$/.exec(line)
    if (item) {
      const type = item[1] ? 'ordered' : 'unordered'
      if (!current || current.type !== type) {
        current = { type, items: [], start: item[1] ? Number(item[1]) : 1 }
        blocks.push(current)
      }
      if ('items' in current) current.items.push(item[2])
      continue
    }
    if (current && 'items' in current && /^\s+/.test(rawLine)) {
      current.items[current.items.length - 1] += `\n${line}`
    } else if (current?.type === 'paragraph') {
      current.text += `\n${line}`
    } else {
      current = { type: 'paragraph', text: line }
      blocks.push(current)
    }
  }
  return blocks
}

export default function CoachReply({ text }: { text: string }) {
  return (
    <div className="space-y-3 break-words [overflow-wrap:anywhere]">
      {replyBlocks(text).map((block, index) => {
        if (block.type === 'heading')
          return (
            <h2 key={index} className="text-sm font-semibold">
              {inlineText(block.text)}
            </h2>
          )
        if (block.type === 'paragraph')
          return (
            <p key={index} className="whitespace-pre-line">
              {inlineText(block.text)}
            </p>
          )
        const items = block.items.map((item, itemIndex) => (
          <li key={itemIndex} className="pl-1 whitespace-pre-line">
            {inlineText(item)}
          </li>
        ))
        return block.type === 'ordered' ? (
          <ol key={index} start={block.start} className="list-decimal space-y-2 pl-5">
            {items}
          </ol>
        ) : (
          <ul key={index} className="list-disc space-y-2 pl-5">
            {items}
          </ul>
        )
      })}
    </div>
  )
}
