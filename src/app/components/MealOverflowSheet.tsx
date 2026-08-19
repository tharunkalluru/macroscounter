import { useEffect, useState } from 'react'
import type { MealTemplate } from '../../data/models'
import { MealTemplateRepo } from '../../data/repos/MealTemplateRepo'
import BottomSheet from '../shell/BottomSheet'

interface Props {
  open: boolean
  onClose: () => void
  mealLabel: string
  hasEntries: boolean
  onSaveTemplate: () => void
  onLogTemplate: (template: MealTemplate) => void
  onCopyFromYesterday: () => void
}

export default function MealOverflowSheet({
  open,
  onClose,
  mealLabel,
  hasEntries,
  onSaveTemplate,
  onLogTemplate,
  onCopyFromYesterday,
}: Props) {
  const [view, setView] = useState<'menu' | 'templates'>('menu')
  const [templates, setTemplates] = useState<MealTemplate[]>([])

  useEffect(() => {
    if (open) setView('menu')
  }, [open])

  useEffect(() => {
    if (view !== 'templates') return
    new MealTemplateRepo().listAll().then(setTemplates)
  }, [view])

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={view === 'menu' ? mealLabel : `Log a template to ${mealLabel}`}
    >
      {view === 'menu' && (
        <ul className="flex flex-col" data-testid="meal-overflow-menu">
          <li>
            <button
              type="button"
              disabled={!hasEntries}
              onClick={onSaveTemplate}
              data-testid="overflow-save-template"
              className="min-h-touch w-full px-1 py-3 text-left text-slate-900 disabled:text-slate-400 dark:text-slate-100 dark:disabled:text-slate-500"
            >
              Save as template
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => setView('templates')}
              data-testid="overflow-log-template"
              className="min-h-touch w-full px-1 py-3 text-left text-slate-900 dark:text-slate-100"
            >
              Log template
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={onCopyFromYesterday}
              data-testid="overflow-copy-yesterday"
              className="min-h-touch w-full px-1 py-3 text-left text-slate-900 dark:text-slate-100"
            >
              Copy from yesterday
            </button>
          </li>
        </ul>
      )}

      {view === 'templates' && (
        <ul
          className="flex flex-col divide-y divide-slate-100 dark:divide-slate-700"
          data-testid="overflow-template-list"
        >
          {templates.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onLogTemplate(t)}
                className="min-h-touch w-full px-1 py-3 text-left text-slate-900 dark:text-slate-100"
              >
                {t.name}{' '}
                <span className="text-caption text-slate-500 dark:text-slate-400">
                  · {t.entries.length} items
                </span>
              </button>
            </li>
          ))}
          {templates.length === 0 && (
            <li className="px-1 py-3 text-caption text-slate-500 dark:text-slate-400">
              No templates saved yet.
            </li>
          )}
        </ul>
      )}
    </BottomSheet>
  )
}
