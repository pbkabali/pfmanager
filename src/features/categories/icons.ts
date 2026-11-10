/**
 * Emoji for plan items: a curated set to pick from, and a guess from the name.
 *
 * Emoji rather than an icon font or SVG set because a category's icon is
 * stored as a plain string and rendered raw in six places (the category
 * picker, transaction rows, the dashboard breakdown, budget items, the daily
 * card, the funding form). Anything else would need a renderer component at
 * every one of those and a migration for every category already saved.
 */

export type IconGroup = { label: string; icons: string[] }

/**
 * The picker's contents. Grouped so the grid can be scanned rather than
 * read, and kept short on purpose -- a wall of every emoji is harder to
 * choose from than forty good ones.
 */
export const ICON_GROUPS: IconGroup[] = [
  { label: 'Food', icons: ['🍲', '🛒', '🍞', '☕', '🥘', '🍎', '🍗', '🥤'] },
  { label: 'Transport', icons: ['🚕', '⛽', '🚌', '🏍️', '🚗', '✈️', '🚲', '🅿️'] },
  { label: 'Home & bills', icons: ['🏠', '💡', '💧', '📶', '🔥', '🧹', '🛋️', '🔧'] },
  { label: 'Health', icons: ['🩺', '💊', '🏥', '🦷', '🧴', '🏋️'] },
  { label: 'Learning', icons: ['🎓', '📚', '✏️', '💻', '🧮'] },
  { label: 'People & giving', icons: ['🤝', '👪', '👶', '🎁', '⛪', '🤲', '💍'] },
  { label: 'Leisure', icons: ['🎬', '🎧', '⚽', '🎮', '🏖️', '🍿', '🛍️', '🐕'] },
  { label: 'Money', icons: ['🏦', '💰', '📈', '🪙', '🧾', '💳', '🛡️'] },
  { label: 'Work & other', icons: ['💼', '🏪', '🛠️', '🌾', '📦', '•'] },
]

/** Fallback when nothing matches and nothing was chosen. */
export const DEFAULT_ICON = '•'

/*
 * Name fragments mapped to an icon, matched case-insensitively anywhere in
 * the item's name.
 *
 * Weighted towards how money is actually described here -- airtime, boda,
 * umeme, school fees, tithe -- rather than a generic English list, because
 * the guess is only useful if it fires on what somebody really types.
 */
const KEYWORDS: Record<string, string> = {
  // Food
  food: '🍲', groceries: '🛒', grocery: '🛒', market: '🛒', meal: '🍲', meals: '🍲',
  lunch: '🍲', breakfast: '🍞', supper: '🍲', dinner: '🍲', restaurant: '🍽️', eating: '🍲',
  snacks: '🍿', coffee: '☕', tea: '☕', drinks: '🥤',

  // Transport
  transport: '🚕', taxi: '🚕', boda: '🏍️', fare: '🚕', fuel: '⛽', petrol: '⛽',
  diesel: '⛽', bus: '🚌', travel: '✈️', flight: '✈️', car: '🚗', vehicle: '🚗',
  parking: '🅿️', bicycle: '🚲',

  // Home and bills
  rent: '🏠', house: '🏠', housing: '🏠', home: '🏠', accommodation: '🏠',
  electricity: '💡', umeme: '💡', power: '💡', light: '💡', water: '💧', nwsc: '💧',
  airtime: '📶', data: '📶', internet: '📶', wifi: '📶', bundles: '📶',
  gas: '🔥', charcoal: '🔥', firewood: '🔥', cooking: '🔥',
  cleaning: '🧹', laundry: '🧹', soap: '🧹', furniture: '🛋️',
  maintenance: '🔧', repairs: '🔧', repair: '🔧',

  // Health
  health: '🩺', medical: '🩺', hospital: '🏥', clinic: '🏥', doctor: '🩺',
  medicine: '💊', drugs: '💊', pharmacy: '💊', dental: '🦷', dentist: '🦷',
  gym: '🏋️', fitness: '🏋️', grooming: '🧴', salon: '🧴',

  // Learning
  school: '🎓', 'school fees': '🎓', fees: '🎓', tuition: '🎓', education: '🎓',
  university: '🎓', college: '🎓', books: '📚', stationery: '✏️', laptop: '💻',

  // People and giving
  family: '👪', parents: '🤝', support: '🤝', children: '👶', kids: '👶', baby: '👶',
  tithe: '⛪', church: '⛪', offering: '🤲', giving: '🤲', charity: '🤲',
  donation: '🤲', mosque: '🤲', zakat: '🤲',
  gift: '🎁', gifts: '🎁', birthday: '🎁', wedding: '💍', contribution: '🤝',

  // Leisure
  leisure: '🎬', entertainment: '🎬', movies: '🎬', outing: '🏖️', holiday: '🏖️',
  music: '🎧', subscriptions: '🎧', netflix: '🎬', sports: '⚽', games: '🎮',
  shopping: '🛍️', clothes: '🛍️', clothing: '🛍️', shoes: '🛍️', pet: '🐕', pets: '🐕',

  // Money
  savings: '🏦', saving: '🏦', sacco: '🏦', investment: '📈', investments: '📈',
  shares: '📈', emergency: '🛡️', insurance: '🛡️', loan: '💳', debt: '💳',
  repayment: '💳', 'out of budget': '🧾', budget: '🧾',

  // Work
  salary: '💼', work: '💼', business: '🏪', farm: '🌾', garden: '🌾', tools: '🛠️',
}

/**
 * A fitting icon for an item name, or null when nothing matches.
 *
 * Null rather than the fallback so a caller can tell "no opinion" from "use a
 * dot", and leave an icon the person chose alone.
 *
 * When several keywords match, the EARLIEST wins, and length only breaks a
 * tie at the same position. Picking the longest match outright looked
 * reasonable and read badly: "Food & groceries" took the cart from
 * "groceries" over the pot from "food", and "Family support" took the
 * handshake from "support" over the family. People put the subject first, so
 * position carries the meaning; length settles "school fees" against "school".
 */
export function suggestIcon(name: string): string | null {
  const haystack = name.trim().toLowerCase()
  if (!haystack) return null

  let best: { at: number; length: number; icon: string } | null = null
  for (const [key, icon] of Object.entries(KEYWORDS)) {
    const at = haystack.indexOf(key)
    if (at === -1) continue
    if (!best || at < best.at || (at === best.at && key.length > best.length)) {
      best = { at, length: key.length, icon }
    }
  }
  return best?.icon ?? null
}
