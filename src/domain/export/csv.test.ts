import { describe, expect, it } from 'vitest'
import type { LogEntry, WeighIn } from '../../data/models'
import { buildLogsCSV, buildWeighInsCSV, escapeCsvField, rowsToCSV } from './csv'

describe('escapeCsvField', () => {
  it('leaves plain fields untouched', () => {
    expect(escapeCsvField('Idli')).toBe('Idli')
    expect(escapeCsvField(42)).toBe('42')
  })

  it('quotes and escapes fields containing a comma', () => {
    expect(escapeCsvField('Rice, Steamed')).toBe('"Rice, Steamed"')
  })

  it('quotes and doubles internal quotes', () => {
    expect(escapeCsvField('12" Pizza')).toBe('"12"" Pizza"')
  })

  it('quotes fields containing newlines', () => {
    expect(escapeCsvField('Line1\nLine2')).toBe('"Line1\nLine2"')
  })
})

describe('rowsToCSV', () => {
  it('joins headers and rows with CRLF, escaping as needed', () => {
    const csv = rowsToCSV(
      ['name', 'note'],
      [
        ['Idli', 'plain'],
        ['Rice, Steamed', 'has "quotes" too'],
      ]
    )
    expect(csv).toBe('name,note\r\nIdli,plain\r\n"Rice, Steamed","has ""quotes"" too"')
  })
})

describe('buildLogsCSV', () => {
  it('produces one header row plus one row per entry, with a comma-containing name escaped', () => {
    const entries: LogEntry[] = [
      {
        id: 1,
        date: '2026-08-18',
        meal: 'breakfast',
        foodId: 'idli',
        name: 'Idli',
        portionSummary: '2 x 1 idli',
        qty: 2,
        unit: 'portion',
        grams: 80,
        kcal: 82,
        p: 3.6,
        c: 16,
        f: 0.4,
      },
      {
        id: 2,
        date: '2026-08-18',
        meal: 'lunch',
        foodId: 'rice',
        name: 'Rice, Steamed',
        portionSummary: '1 katori',
        qty: 1,
        unit: 'portion',
        grams: 150,
        kcal: 195,
        p: 4,
        c: 42,
        f: 0.5,
      },
    ]
    const csv = buildLogsCSV(entries)
    const lines = csv.split('\r\n')
    expect(lines).toHaveLength(3) // header + 2 rows
    expect(lines[0]).toBe('date,meal,name,portionSummary,qty,unit,grams,kcal,p,c,f')
    expect(lines[2]).toContain('"Rice, Steamed"')
  })

  it('produces just a header row for no entries', () => {
    expect(buildLogsCSV([]).split('\r\n')).toHaveLength(1)
  })
})

describe('buildWeighInsCSV', () => {
  it('produces one header row plus one row per weigh-in', () => {
    const weighIns: WeighIn[] = [
      { id: 1, date: '2026-08-10', weightKg: 80 },
      { id: 2, date: '2026-08-18', weightKg: 79.1 },
    ]
    const csv = buildWeighInsCSV(weighIns)
    const lines = csv.split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('date,weightKg')
    expect(lines[1]).toBe('2026-08-10,80')
    expect(lines[2]).toBe('2026-08-18,79.1')
  })
})
