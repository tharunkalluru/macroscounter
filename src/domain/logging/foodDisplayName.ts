export interface FoodDisplayName {
  title: string
  /** The original food identity, never rewritten or used as a replacement for saved data. */
  fullName: string
  isCompact: boolean
  variant?: string
}

// Deliberately bounded. An unfamiliar food is better shown in full than mislabeled.
const FOOD_PHRASES: readonly [RegExp, string][] = [
  [/\bprotein shake\b/i, 'Protein shake'],
  [/\bprotein drink\b/i, 'Protein drink'],
  [/\bprotein bar\b/i, 'Protein bar'],
  [/\bprotein powder\b/i, 'Protein powder'],
  [/\bgreek yog(?:h)?urt\b/i, 'Greek yogurt'],
  [/\bcottage cheese\b/i, 'Cottage cheese'],
  [/\boat milk\b/i, 'Oat milk'],
  [/\balmond milk\b/i, 'Almond milk'],
  [/\bsoy milk\b/i, 'Soy milk'],
  [/\bpeanut butter\b/i, 'Peanut butter'],
  [/\balmond butter\b/i, 'Almond butter'],
  [/\bgranola bar\b/i, 'Granola bar'],
  [/\bgrilled chicken breast\b/i, 'Grilled chicken breast'],
  [/\broasted chicken breast\b/i, 'Roasted chicken breast'],
  [/\bbrown rice\b/i, 'Brown rice'],
  [/\bwhite rice\b/i, 'White rice'],
  [/\bpaneer butter masala\b/i, 'Paneer butter masala'],
  [/\bchicken biryani\b/i, 'Chicken biryani'],
  [/\bvegetable biryani\b/i, 'Vegetable biryani'],
  [/\bdal makhani\b/i, 'Dal makhani'],
  [/\bmasala dosa\b/i, 'Masala dosa'],
]

const FLAVORS: readonly [RegExp, string][] = [
  [/\bcookies\s*(?:and|&|n['’]?)\s*cream\b/i, 'Cookies & cream'],
  [/\b(?:dark |milk )?chocolate\b/i, 'Chocolate'],
  [/\b(?:french |madagascar |[Bb]ourbon )?vanilla\b/i, 'Vanilla'],
  [/\bstrawberry\b/i, 'Strawberry'],
  [/\bsalted caramel\b/i, 'Salted caramel'],
  [/\bcaramel\b/i, 'Caramel'],
  [/\bmocha\b/i, 'Mocha'],
]

const DIET_QUALIFIERS: readonly [RegExp, string][] = [
  [/\bplant[ -]based\b/i, 'Plant-based'],
  [/\blactose[ -]free\b/i, 'Lactose-free'],
  [/\bdairy[ -]free\b/i, 'Dairy-free'],
  [/\bgluten[ -]free\b/i, 'Gluten-free'],
  [/\b(?:no added sugar|no sugar added)\b/i, 'No added sugar'],
  [/\bsugar[ -]free\b/i, 'Sugar-free'],
  [/\bunsweetened\b/i, 'Unsweetened'],
  [/\bvegan\b/i, 'Vegan'],
  [/\bdecaf(?:feinated)?\b/i, 'Decaf'],
]

function original(name: string): FoodDisplayName {
  return { title: name, fullName: name, isCompact: false }
}

function isShort(name: string): boolean {
  return name.length <= 36 && name.trim().split(/\s+/).length <= 6
}

function removeNutrientClaims(text: string): string {
  return text.replace(
    /\b(?:with|and)\s+(?:\d+(?:\.\d+)?\s*(?:g|mg|mcg)\s+(?:of\s+)?(?:protein|fiber|fibre|carb(?:ohydrate)?s?|fat|sugars?)|(?:added\s+)?(?:vitamins?|minerals?|electrolytes?))\b/gi,
    ' '
  )
}

function removeKnownDetails(text: string): string {
  let rest = removeNutrientClaims(text)
  for (const [pattern] of [...FLAVORS, ...DIET_QUALIFIERS]) {
    rest = rest.replace(new RegExp(pattern.source, 'gi'), ' ')
  }
  return rest
    .replace(/\b\d+(?:\.\d+)?\s*(?:g|mg|mcg|ml|l|oz|fl\s*oz|kcal|calories?|ct|pack)\b/gi, ' ')
    .replace(
      /\b(?:protein|carbs?|carbohydrates?|fat|fiber|fibre|sugars?|calories?|vitamins?|minerals?|electrolytes?|high|low|reduced|added|per|serving|bottle|bottles|pack|packs|of|ready[ -]to[ -]drink|flavou?r(?:ed)?|natural|artificial|naturally|artificially)\b/gi,
      ' '
    )
    .replace(/[\s.,:()\-–—]+/g, '')
}

/**
 * A presentation label, not a food parser. Only explicit, unambiguous known
 * phrases are compacted; unknown foods and mixed dishes keep their full identity.
 */
export function getFoodDisplayName(name: string): FoodDisplayName {
  if (isShort(name)) return original(name)

  // Do not classify negated categories, mixed foods, or ambiguous descriptions.
  if (/\b(?:not|without|instead of|free from)\b/i.test(name)) return original(name)

  const matches = FOOD_PHRASES.flatMap(([pattern, title]) => {
    const match = pattern.exec(name)
    return match ? [{ match, title }] : []
  })
  if (matches.length !== 1) return original(name)
  const [{ match, title }] = matches
  const beforeCategory = name.slice(0, match.index)
  if (/[,;:]/.test(beforeCategory)) return original(name)
  // A recognized phrase can be an ingredient in another dish. Preparation verbs
  // and contextual prepositions must not be mistaken for a product's brand name.
  if (
    /\b(?:in|into|from|using|made|soaked|soaking|blended|mixed|cooked|baked|fried|prepared|stuffed|filled|coated|dipped|contains?|containing|featuring|on|over|under|for|of|as)\b/i.test(
      beforeCategory
    )
  )
    return original(name)
  const afterCategory = name.slice(match.index + match[0].length)

  // "Protein shake powder" and "protein bar-flavored shake" are different foods.
  if (/^[\s-]*(?:powder|mix|flavou?r(?:ed)?|style)\b/i.test(afterCategory)) return original(name)

  let withoutFlavors = removeNutrientClaims(name)
  for (const [pattern] of FLAVORS) withoutFlavors = withoutFlavors.replace(pattern, ' ')
  if (/[+&/;]|\b(?:and|with|plus|served|side of|topped|accompanied)\b/i.test(withoutFlavors)) {
    return original(name)
  }

  // A comma-separated second food must not disappear behind a product label.
  // Recognized flavor, nutrition and pack-size suffixes are safe to collapse.
  const suffixClauses = afterCategory.split(/[,:;]|\s[–—]\s/)
  if (suffixClauses.some((clause) => removeKnownDetails(clause) !== '')) return original(name)

  const variantParts: string[] = []
  let flavorText = name
  for (const [pattern, label] of FLAVORS) {
    if (pattern.test(flavorText)) {
      variantParts.push(label)
      flavorText = flavorText.replace(pattern, '')
    }
  }
  for (const [pattern, label] of DIET_QUALIFIERS) {
    if (pattern.test(name)) variantParts.push(label)
  }

  return {
    title,
    fullName: name,
    isCompact: true,
    ...(variantParts.length > 0 ? { variant: variantParts.join(' · ') } : {}),
  }
}

/** Keep repeat-meal labels scannable without discarding any entry's full name. */
export function getMealDisplayName(entries: readonly { name: string }[]): FoodDisplayName {
  if (entries.length === 0) return { title: 'Meal', fullName: '', isCompact: false }
  if (entries.length === 1) return getFoodDisplayName(entries[0].name)

  const labels = entries.map((entry) => getFoodDisplayName(entry.name))
  const first = labels[0]
  const combined = labels.map((label) => label.title).join(' + ')
  const showFirst = isShort(first.title)
  const title =
    combined.length <= 36
      ? combined
      : showFirst
        ? `${first.title} + ${entries.length - 1} more`
        : `${entries.length} foods`
  const fullName = entries.map((entry) => entry.name).join(' + ')
  return {
    title,
    fullName,
    isCompact: title !== fullName,
    ...(showFirst && first.variant ? { variant: first.variant } : {}),
  }
}
