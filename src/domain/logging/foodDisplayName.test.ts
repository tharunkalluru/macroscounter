import { describe, expect, it } from 'vitest'
import { getFoodDisplayName, getMealDisplayName } from './foodDisplayName'

describe('getFoodDisplayName', () => {
  it('separates a verbose scanned product into a category, flavor and untouched identity', () => {
    const name = 'Ultra Nutrition Complete Protein Shake, Chocolate, 30g protein, 325ml bottle'
    expect(getFoodDisplayName(name)).toEqual({
      title: 'Protein shake',
      variant: 'Chocolate',
      fullName: name,
      isCompact: true,
    })
  })

  it('keeps dietary distinctions visible with the flavor', () => {
    const name = 'Ultra Nutrition plant-based lactose-free Protein Shake, Vanilla, 30g protein'
    expect(getFoodDisplayName(name)).toEqual({
      title: 'Protein shake',
      variant: 'Vanilla · Plant-based · Lactose-free',
      fullName: name,
      isCompact: true,
    })
  })

  it('allows explicit nutrient claims without mistaking their conjunctions for a mixed dish', () => {
    const name = 'Ultra Performance Chocolate Protein Shake with 30g protein and added vitamins'
    expect(getFoodDisplayName(name)).toEqual({
      title: 'Protein shake',
      variant: 'Chocolate',
      fullName: name,
      isCompact: true,
    })
  })

  it('allows familiar nutrition suffixes and serving metadata', () => {
    expect(
      getFoodDisplayName(
        'Ultra Performance Protein Shake, Vanilla, high protein, low sugar, 30 g protein per serving'
      )
    ).toMatchObject({
      title: 'Protein shake',
      variant: 'Vanilla',
      isCompact: true,
    })
  })

  it('recognizes an explicitly named dish while keeping its complete source description', () => {
    const name = 'Homemade Traditional Chicken Biryani, 300g serving'
    expect(getFoodDisplayName(name)).toEqual({
      title: 'Chicken biryani',
      fullName: name,
      isCompact: true,
    })
  })

  it.each(['Eggs', 'Chocolate protein shake', 'Brand Greek yogurt', 'Grilled chicken breast'])(
    'preserves a short, already clear name: %s',
    (name) => {
      expect(getFoodDisplayName(name)).toEqual({ title: name, fullName: name, isCompact: false })
    }
  )

  it.each([
    'Ultra Nutrition Protein Shake + a whole banana',
    'Ultra Nutrition Protein Shake with rolled oats',
    'Ultra Nutrition Protein Shake with 30g protein and a banana',
    'Ultra Nutrition Protein Shake and a toasted bagel',
    'Ultra Nutrition Protein Shake, banana, apple',
    'Grilled chicken breast with brown rice and salad',
    'Ultra Nutrition Protein Shake / Cottage Cheese',
    'Protein shake; homemade sourdough toast',
    'Banana and toast, Ultra Nutrition Protein Shake',
    'Banana, Ultra Nutrition Complete Protein Shake',
  ])('does not hide another food in a mixed description: %s', (name) => {
    expect(getFoodDisplayName(name)).toEqual({ title: name, fullName: name, isCompact: false })
  })

  it.each([
    'Ultra Nutrition Complete Protein Shake Powder, Chocolate',
    'Ultra Nutrition Protein Shake Mix Vanilla',
    'Ultra Nutrition protein bar-flavored shake',
    'Ultra Nutrition not a protein shake, chocolate drink',
    'Ultra Nutrition Protein Shake plus Protein Bar',
    'Ultra Nutrition Peanut Butter Protein Shake',
    'Ultra Nutrition Brown Rice Crackers, 30g protein',
    'Ultra Nutrition Oat Milk Chocolate Bar, 100g',
  ])('preserves ambiguous category matches: %s', (name) => {
    expect(getFoodDisplayName(name).isCompact).toBe(false)
    expect(getFoodDisplayName(name).title).toBe(name)
  })

  it.each([
    'Breakfast cereal soaked in unsweetened almond milk',
    'Homemade pancakes made from brown rice',
    'Homemade smoothie made using chocolate protein shake',
    'Banana smoothie blended using a vanilla protein shake',
    'Homemade breakfast pancakes prepared with Greek yogurt',
    'Breakfast porridge containing unsweetened oat milk',
    'Homemade chocolate pudding featuring almond milk',
    'Breakfast cereal over unsweetened almond milk',
    'Chocolate baking mix for a homemade protein shake',
    'A large bowl of porridge using brown rice',
  ])('does not turn an ingredient into the identity of its containing dish: %s', (name) => {
    expect(getFoodDisplayName(name)).toEqual({ title: name, fullName: name, isCompact: false })
  })

  it('recognizes conjunctions inside a named flavor without confusing them with a second food', () => {
    expect(
      getFoodDisplayName('Ultra Nutrition Complete Protein Shake, Cookies & Cream, 30g protein')
    ).toMatchObject({
      title: 'Protein shake',
      variant: 'Cookies & cream',
      isCompact: true,
    })
  })

  it('avoids duplicating a flavor nested in a more specific flavor', () => {
    expect(
      getFoodDisplayName('Ultra Nutrition Complete Protein Shake, Salted Caramel, 30g protein')
        .variant
    ).toBe('Salted caramel')
  })

  it('supports other explicit product categories without erasing dietary qualifiers', () => {
    expect(getFoodDisplayName('Organic Valley Barista Unsweetened Oat Milk, 1000ml')).toMatchObject(
      {
        title: 'Oat milk',
        variant: 'Unsweetened',
        isCompact: true,
      }
    )
  })

  it.each([
    'మినపప్పు దోశ ఇంట్లో చేసినది, కొబ్బరి పచ్చడి మరియు సాంబార్',
    '豆腐と季節の野菜を使った特製の煮物と玄米のランチセット',
    'Homemade celebratory dal makhani prepared in the family style',
    'Superprotein shaker bottle with measurements',
    '',
  ])('never guesses unfamiliar names or breaks Unicode: %s', (name) => {
    expect(getFoodDisplayName(name)).toEqual({ title: name, fullName: name, isCompact: false })
  })

  it('retains the exact original spacing and spelling for details', () => {
    const name = '  ULTRA Nutrition  Protein Shake, CHOCOLATE, 30g protein  '
    const result = getFoodDisplayName(name)
    expect(result.title).toBe('Protein shake')
    expect(result.fullName).toBe(name)
  })
})

describe('getMealDisplayName', () => {
  it('delegates single foods to the same display naming rules', () => {
    const name = 'Ultra Nutrition Complete Protein Shake, Chocolate, 30g protein'
    expect(getMealDisplayName([{ name }])).toEqual(getFoodDisplayName(name))
  })

  it('shows a concise first food and count while retaining every raw name and untouched data', () => {
    const entries = Object.freeze([
      Object.freeze({
        name: 'Ultra Nutrition Complete Protein Shake, Chocolate, 30g protein',
        qty: 2,
      }),
      Object.freeze({ name: 'Banana', qty: 1 }),
      Object.freeze({ name: 'Sourdough toast', qty: 1 }),
    ])
    expect(getMealDisplayName(entries)).toEqual({
      title: 'Protein shake + 2 more',
      variant: 'Chocolate',
      fullName: entries.map((entry) => entry.name).join(' + '),
      isCompact: true,
    })
    expect(entries[0].qty).toBe(2)
    expect(entries).toHaveLength(3)
  })

  it('keeps a familiar two-food combination visible when it is already concise', () => {
    expect(getMealDisplayName([{ name: 'Idli' }, { name: 'Sambar' }])).toEqual({
      title: 'Idli + Sambar',
      fullName: 'Idli + Sambar',
      isCompact: false,
    })
  })

  it('uses a food count when an unfamiliar first name cannot be compacted safely', () => {
    const entries = [
      { name: 'A very special homemade dish using an unfamiliar traditional recipe' },
      { name: 'Tea' },
    ]
    expect(getMealDisplayName(entries)).toEqual({
      title: '2 foods',
      fullName: `${entries[0].name} + Tea`,
      isCompact: true,
    })
  })

  it('handles an empty meal without making up a food identity', () => {
    expect(getMealDisplayName([])).toEqual({ title: 'Meal', fullName: '', isCompact: false })
  })
})
