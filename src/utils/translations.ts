import type {
  Translations,
  FlatTranslations,
  TranslationChanges,
  TranslationChangesSummary,
} from "../types.ts"
import { logger } from "./logger.ts"
import { isPlainObject } from "./utils.ts"

export const flattenTranslations = (
  translations: Translations,
): FlatTranslations => {
  const flat: FlatTranslations = {}

  const flatten = (node: Translations, path: string[] = []) => {
    for (const [key, value] of Object.entries(node)) {
      const currentPath = [...path, key]
      if (typeof value === "string") {
        flat[currentPath.join(".")] = value
      } else if (isPlainObject(value)) {
        flatten(value as Translations, currentPath)
      }
    }
  }

  flatten(translations)
  return flat
}

export const unflattenTranslations = (
  flat: Record<string, string>,
): Translations => {
  const translations: Translations = {}

  for (const [path, value] of Object.entries(flat)) {
    const keys = path.split(".")
    let current = translations

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!(key in current)) {
        current[key] = {}
      }
      current = current[key] as Record<string, any>
    }

    const lastKey = keys[keys.length - 1]
    current[lastKey] = value
  }

  return translations
}

export const sortTranslations = <T extends Translations>(
  translations: T,
): T => {
  const sorted: Record<string, unknown> = {}

  Object.keys(translations)
    .sort()
    .forEach((key) => {
      const value = translations[key]
      if (isPlainObject(value)) {
        sorted[key] = sortTranslations(value as T)
      } else {
        sorted[key] = value
      }
    })

  return sorted as T
}

export const applyPatch = ({
  base,
  patch,
}: {
  base: Translations
  patch: Translations
}): Translations => {
  const flatBase = flattenTranslations(base)
  const flatPatch = flattenTranslations(patch)

  const flatPatched = { ...flatBase, ...flatPatch }
  const sortedFlatPatched = sortTranslations(flatPatched)
  return unflattenTranslations(sortedFlatPatched)
}

export const normalizeForTranslationComparison = (value: string) => {
  if (typeof value !== "string") {
    throw new Error(`Expected string but got ${typeof value}`)
  }

  let normalized = value.trim().toLowerCase()

  // Whitespace normalization
  normalized = normalized.replace(/\s+/g, " ")
  normalized = normalized.replace(/[\r\n]+/g, " ")

  // Normalize interpolation variables to stable placeholders
  // This way {name} and {firstName} are treated as the same
  let placeholderIndex = 0
  // ${var} style
  normalized = normalized.replace(
    /\$\{[\w.]+\}/g,
    () => `__VAR_${placeholderIndex++}__`,
  )
  // %{var} style
  normalized = normalized.replace(
    /%\{[\w.]+\}/g,
    () => `__VAR_${placeholderIndex++}__`,
  )
  // {{ var }} style (with optional spaces)
  normalized = normalized.replace(
    /{{\s*[\w.]+\s*}}/g,
    () => `__VAR_${placeholderIndex++}__`,
  )
  // {var} style (with optional spaces)
  normalized = normalized.replace(
    /\{\s*[\w.]+\s*\}/g,
    () => `__VAR_${placeholderIndex++}__`,
  )

  return normalized.trim()
}

export const areTranslationsEqual = (value1: string, value2: string) => {
  if (value1 === value2) return true

  try {
    const normalized1 = normalizeForTranslationComparison(value1)
    const normalized2 = normalizeForTranslationComparison(value2)
    return normalized1 === normalized2
  } catch (error) {
    logger.warn(
      `Translation comparison failed:  ${value1}, ${value2}, ${error} }}`,
    )
    return value1 === value2
  }
}

export const getTranslationChanges = (input: {
  base: Translations
  patch: Translations
}): TranslationChanges => {
  const flatBase = flattenTranslations(input.base)
  const flatPatch = flattenTranslations(input.patch)

  const uniqKeys = Array.from(
    new Set<string>([...Object.keys(flatBase), ...Object.keys(flatPatch)]),
  )
  const flatAdded: FlatTranslations = {}
  const flatRemoved: FlatTranslations = {}
  const flatModified: FlatTranslations = {}

  for (const key of uniqKeys) {
    const baseValue = flatBase[key]
    const patchValue = flatPatch[key]
    const isInBase = baseValue !== undefined
    const isInPatch = patchValue !== undefined

    if (!isInBase && isInPatch) {
      flatAdded[key] = patchValue
    } else if (isInBase && !isInPatch) {
      flatRemoved[key] = baseValue
    } else if (!areTranslationsEqual(baseValue, patchValue)) {
      flatModified[key] = patchValue
    }
  }

  return {
    added: unflattenTranslations(flatAdded),
    modified: unflattenTranslations(flatModified),
    removed: unflattenTranslations(flatRemoved),
    patch: createPatchFromChanges(flatAdded, flatModified),
  }
}

export const getChangesSummary = (
  changes: TranslationChanges,
): TranslationChangesSummary => {
  const addedKeys = Object.keys(flattenTranslations(changes.added))
  const modifiedKeys = Object.keys(flattenTranslations(changes.modified))
  const removedKeys = Object.keys(flattenTranslations(changes.removed))

  return {
    addedKeys,
    modifiedKeys,
    removedKeys,
  }
}

export const hasAnyTranslations = (translations: Translations): boolean => {
  return Object.keys(translations).length > 0
}

export const createPatchFromChanges = (
  flatAdded: FlatTranslations,
  flatModified: FlatTranslations,
): Translations => {
  const combinedFlat: FlatTranslations = { ...flatAdded, ...flatModified }
  return unflattenTranslations(combinedFlat)
}
