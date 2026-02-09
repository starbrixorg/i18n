import path from "path"
import {
  assertDirectoryExists,
  getJsonFilesInDirectory,
  isDirectory,
  isFile,
  readTranslationFile,
} from "../utils/io.ts"
import { exitWithError, relativePath } from "../utils/utils.ts"
import { flattenTranslations } from "../utils/translations.ts"
import { getLocalesInDirectory } from "../utils/io.ts"
import { logger } from "../utils/logger.ts"
import type { ArgMap } from "../types.ts"
import { loadConfig } from "../utils/load-config.ts"
import z from "zod"

type Args = {
  dir: string // directory path containing flat translation files
  baseLocale?: string // base locale code, defaults to 'en'
  baseLocaleDir?: string // optional base locale directory path that contains the {baseLocale}.json file (or {baseLocale}/{namespace}.json if namespaced = true), defaults to dirPath
  locales?: string[] // optional list of locale codes to validate, defaults to all locales in dirPath
  namespaced?: boolean // if true, treat as namespaced structure
  verbose?: boolean // if true, enable verbose logging
}

const keysOf = (filePath: string): Set<string> => {
  const t = readTranslationFile(filePath)
  return new Set(Object.keys(flattenTranslations(t)))
}

const diffKeys = (baseKeys: Set<string>, targetKeys: Set<string>) => {
  const missing: string[] = []
  const extra: string[] = []
  const baseKeysArray = Array.from(baseKeys)
  const targetKeysArray = Array.from(targetKeys)

  for (const k of baseKeysArray) if (!targetKeys.has(k)) missing.push(k)
  for (const k of targetKeysArray) if (!baseKeys.has(k)) extra.push(k)

  missing.sort()
  extra.sort()

  return { missing, extra }
}

const formatKeyList = (keys: string[]): string => {
  const maxKeysToShow = 5
  if (keys.length <= maxKeysToShow) {
    return keys.join(", ")
  } else {
    const displayedKeys = keys.slice(0, maxKeysToShow).join(", ")
    return `${displayedKeys}, ... (and ${keys.length - maxKeysToShow} more)`
  }
}

const createViolationMessage = (params: {
  missing: string[]
  extra: string[]
}): string => {
  const { missing, extra } = params
  let message = ""
  if (missing.length) {
    message += `  - missing (${missing.length}): ${formatKeyList(missing)}\n`
  }
  if (extra.length) {
    message += `  - extra (${extra.length}): ${formatKeyList(extra)}\n`
  }
  return message.trim()
}

const validateKeys = (
  baseKeys: Set<string>,
  localeKeys: Set<string>,
): string | null => {
  const { missing, extra } = diffKeys(baseKeys, localeKeys)

  if (missing.length || extra.length) {
    return createViolationMessage({ missing, extra })
  }

  return null
}

const validateFlatDirKeyConsistency = (args: Args): string[] => {
  const { dir, baseLocale } = args
  const baseLocaleDir = args.baseLocaleDir || dir
  assertDirectoryExists(dir)
  assertDirectoryExists(baseLocaleDir)

  const baseLocaleFilePath = path.join(baseLocaleDir, `${baseLocale}.json`)
  if (!isFile(baseLocaleFilePath)) {
    exitWithError(
      `Base locale file '${baseLocale}.json' not found in ${relativePath(baseLocaleDir)}`,
    )
  }

  const violations: string[] = []
  const locales = args.locales || getLocalesInDirectory(dir)
  const baseKeys = keysOf(baseLocaleFilePath)

  /*-- Log validation setup --*/
  if (args.verbose) {
    logger.info(`Validating translation key consistency`)
    logger.info(`- directory: ${relativePath(dir)}`)
    logger.info(
      `- base locale: ${baseLocale} at ${relativePath(baseLocaleFilePath)}`,
    )
    logger.info(
      `- ${args.locales ? "provided" : "detected"} locales: ${locales.join(", ")}\n`,
    )
  }

  for (const locale of locales) {
    const localeFilePath = path.join(dir, `${locale}.json`)

    // Skip validation for against itself
    if (localeFilePath === baseLocaleFilePath) continue

    if (!isFile(localeFilePath)) {
      violations.push(`[${locale}] Missing file: ${locale}.json`)
      continue
    }
    const localeKeys = keysOf(localeFilePath)
    const localeViolation = validateKeys(baseKeys, localeKeys)
    if (localeViolation) {
      violations.push(
        `[${locale}] Key mismatch vs ${baseLocale}.json\n  ${localeViolation}`,
      )
    } else if (args.verbose) {
      logger.success(
        `[${locale}] All keys are consistent with '${baseLocale}.json'`,
      )
    }
  }

  violations.forEach((v) => logger.warn(`${v}\n`))
  return violations
}

const validateNamespacedDirKeyConsistency = (args: Args): string[] => {
  const { dir, baseLocaleDir } = args
  if (typeof baseLocaleDir !== "string") {
    return exitWithError(
      "baseLocaleDir must be provided for namespaced validation.",
    )
  }
  assertDirectoryExists(dir)
  assertDirectoryExists(baseLocaleDir)

  const violations: string[] = []
  const locales = args.locales || getLocalesInDirectory(dir)
  const namespaces = getJsonFilesInDirectory(baseLocaleDir, {
    stripExtension: true,
  }).sort()

  if (!locales.length) {
    logger.warn(`No locales found in directory: ${relativePath(dir)}`)
  }

  if (!namespaces.length) {
    logger.warn(
      `No namespace files found in base locale directory: ${relativePath(baseLocaleDir)}`,
    )
  }

  for (const locale of locales) {
    const localeDir = path.join(dir, locale)
    if (!isDirectory(localeDir)) {
      violations.push(
        `[${locale}] Missing locale directory: ${relativePath(localeDir)}`,
      )
    }

    for (const namespace of namespaces) {
      const baseNamespacePath = path.join(baseLocaleDir, `${namespace}.json`)
      const localeNamespacePath = path.join(localeDir, `${namespace}.json`)

      // Skip validation for against itself
      if (localeNamespacePath === baseNamespacePath) continue

      if (!isFile(localeNamespacePath)) {
        violations.push(`[${locale}] Missing namespace file: ${namespace}.json`)
        continue
      }

      const baseKeys = keysOf(baseNamespacePath)
      const localeKeys = keysOf(localeNamespacePath)

      args.verbose &&
        logger.info(
          `Validating '${relativePath(localeNamespacePath)}' against '${relativePath(baseNamespacePath)}'`,
        )
      const namespaceViolation = validateKeys(baseKeys, localeKeys)

      if (namespaceViolation) {
        violations.push(
          `[${locale}] Key mismatch in '${namespace}.json' vs [${args.baseLocale}] \n  ${namespaceViolation}`,
        )
      } else if (args.verbose) {
        logger.success(
          `[${locale}] All keys in '${namespace}.json' are consistent with [${args.baseLocale}] \n`,
        )
      }
    }
  }
  violations.forEach((v) => logger.warn(`${v}\n`))
  return violations
}

const ArgsSchema = z.object({
  dir: z.string(),
  baseLocale: z.string().optional(),
  baseLocaleDir: z.string().optional(),
  locales: z.string().array().optional(),
  namespaced: z.boolean().optional(),
  verbose: z.boolean().optional(),
})

const createValidArgs = async (args: any): Promise<Args> => {
  const verbose = Boolean(args.verbose)

  if (args.config) {
    const loadedConfig = await loadConfig({
      config: z.string().parse(args.config),
      command: "validate",
    })
    return { ...loadedConfig, verbose }
  }

  const dir = z.string().parse(args.dir)
  const namespaced = Boolean(args.namespaced)

  const baseLocale = args.baseLocale ? args.baseLocale : "en"
  const baseLocaleDir = args.baseLocaleDir
    ? args.baseLocaleDir
    : namespaced
      ? path.join(dir, baseLocale)
      : dir
  const locales = args.locales
    ? z
        .string()
        .parse(args.locale)
        .split(",")
        .map((l) => l.trim())
    : undefined

  return ArgsSchema.parse({
    dir,
    baseLocale,
    baseLocaleDir,
    locales,
    namespaced,
    verbose,
  })
}

export const handleValidateTranslations = async (args: ArgMap) => {
  const validArgs = await createValidArgs(args)
  let violations: string[]

  if (validArgs.namespaced) {
    violations = validateNamespacedDirKeyConsistency(validArgs)
  } else {
    violations = validateFlatDirKeyConsistency(validArgs)
  }

  if (violations.length) {
    exitWithError(`Validation failed with ${violations.length} violation(s).`)
  } else {
    logger.success(`All translation keys are consistent across namespaces.`)
  }
}
