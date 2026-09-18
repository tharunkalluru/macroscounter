/** Presentation cleanup for assistant text only. User messages stay verbatim. */
export function normalizeCoachReply(reply: string): string {
  return reply
    .replace(/\r\n?/g, '\n')
    .replace(/&mdash;|&#0*8212;|&#x0*2014;/gi, '\u2014')
    .replace(/^[\t ]*[\u2014\u2015][\t ]*/gm, '- ')
    .replace(/[\t ]*[\u2014\u2015][\t ]*/g, ', ')
    .replace(/[\t ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
