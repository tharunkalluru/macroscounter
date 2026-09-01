import type { FoodRecord } from '../../data/models'
import { HeartIcon } from '../shell/icons'
import FoodGlyph from './FoodGlyph'

interface Props {
  title: string
  foods: FoodRecord[]
  onSelect: (food: FoodRecord) => void
  isFavorite: (food: FoodRecord) => boolean
  onToggleFavorite: (food: FoodRecord) => void
}

/** Favorites/Recents chip row shared by AddFoodSheetContent and AddFoodPage — each chip doubles as a favorite-toggle so marking a food no longer needs a separate screen. */
export default function FoodChipList({ title, foods, onSelect, isFavorite, onToggleFavorite }: Props) {
  return (
    <div>
      <p className="mb-1 text-caption font-medium uppercase text-slate-500 dark:text-slate-400">{title}</p>
      <div className="flex flex-wrap gap-1">
        {foods.map((food) => {
          const fav = isFavorite(food)
          return (
            <div
              key={food.id}
              className="flex items-center rounded-full bg-white pl-1 pr-1 shadow-sm dark:bg-surface-dark-card"
            >
              <button
                type="button"
                className="flex min-h-touch items-center gap-1.5 py-1 pl-0 pr-1 text-sm"
                onClick={() => onSelect(food)}
              >
                <FoodGlyph name={food.name} size="small" />
                {food.name}
              </button>
              <button
                type="button"
                onClick={() => onToggleFavorite(food)}
                aria-label={fav ? `Remove ${food.name} from favorites` : `Add ${food.name} to favorites`}
                data-testid={`favorite-toggle-${food.id}`}
                className="flex min-h-touch min-w-touch items-center justify-center"
              >
                <HeartIcon active={fav} className={fav ? 'text-brand-600 dark:text-brand-400' : 'text-slate-300 dark:text-slate-600'} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
