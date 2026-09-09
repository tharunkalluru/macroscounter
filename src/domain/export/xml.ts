import type { LogEntry, MealTemplate, Profile, Recipe, ScannedProduct, Targets, WeighIn } from '../../data/models'

function escapeXmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeXmlAttr(value: string): string {
  return escapeXmlText(value).replace(/"/g, '&quot;')
}

/** Every field name in this codebase is already a safe XML tag name (camelCase, no digits leading); this is only a defensive fallback. */
function xmlTag(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(name) ? name : 'field'
}

/**
 * Recursively serializes any JSON-shaped value into XML elements — one
 * generic serializer rather than a hand-written mapping per table, so the
 * export is genuinely "complete data": every field that exists on a record
 * (including nested objects like `customSnapshot`/`per100g` and arrays like
 * `ingredients`/`portions`) round-trips into the output automatically,
 * including fields added by future features, without this file needing an
 * update every time a model gains one.
 */
export function serializeXmlValue(tag: string, value: unknown): string {
  const safeTag = xmlTag(tag)
  if (value === null || value === undefined) return `<${safeTag}/>`
  if (Array.isArray(value)) {
    if (value.length === 0) return `<${safeTag}/>`
    return `<${safeTag}>${value.map((item) => serializeXmlValue('item', item)).join('')}</${safeTag}>`
  }
  if (typeof value === 'object') {
    const inner = Object.entries(value as Record<string, unknown>)
      .map(([key, v]) => serializeXmlValue(key, v))
      .join('')
    return `<${safeTag}>${inner}</${safeTag}>`
  }
  if (typeof value === 'string') return `<${safeTag}>${escapeXmlText(value)}</${safeTag}>`
  if (typeof value === 'boolean') return `<${safeTag}>${value}</${safeTag}>`
  return `<${safeTag}>${String(value)}</${safeTag}>`
}

export interface FullExportData {
  profile: Profile | undefined
  targets: Targets[]
  logEntries: LogEntry[]
  weighIns: WeighIn[]
  recipes: Recipe[]
  mealTemplates: MealTemplate[]
  scannedProducts: ScannedProduct[]
  /** Injectable for deterministic tests; defaults to the real clock. */
  now?: Date
}

/**
 * Everything the account has ever logged, in one self-contained XML
 * document — the full-fidelity counterpart to the per-table CSV exports
 * (those are spreadsheet-friendly slices; this is meant for backup/
 * portability, so nothing is summarized or dropped).
 */
export function buildFullExportXML(data: FullExportData): string {
  const generatedAt = (data.now ?? new Date()).toISOString()
  const sections = [
    data.profile ? serializeXmlValue('profile', data.profile) : '<profile/>',
    `<targets>${data.targets.map((t) => serializeXmlValue('target', t)).join('')}</targets>`,
    `<logEntries>${data.logEntries.map((e) => serializeXmlValue('entry', e)).join('')}</logEntries>`,
    `<weighIns>${data.weighIns.map((w) => serializeXmlValue('weighIn', w)).join('')}</weighIns>`,
    `<recipes>${data.recipes.map((r) => serializeXmlValue('recipe', r)).join('')}</recipes>`,
    `<mealTemplates>${data.mealTemplates.map((m) => serializeXmlValue('mealTemplate', m)).join('')}</mealTemplates>`,
    `<scannedProducts>${data.scannedProducts.map((p) => serializeXmlValue('scannedProduct', p)).join('')}</scannedProducts>`,
  ]
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<bitewiseExport version="1" generatedAt="${escapeXmlAttr(generatedAt)}">\n` +
    sections.join('\n') +
    '\n</bitewiseExport>'
  )
}
