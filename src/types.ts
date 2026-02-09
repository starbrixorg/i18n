export type Translations = {
  [key: string]: string | Translations
}
export type FlatTranslations = Record<string, string>
export type ArgMap = Record<string, string | boolean>
export type TranslationChanges = {
  added: Translations
  modified: Translations
  removed: Translations
  patch: Translations
}
export type TranslationChangesSummary = {
  addedKeys: string[]
  modifiedKeys: string[]
  removedKeys: string[]
}
