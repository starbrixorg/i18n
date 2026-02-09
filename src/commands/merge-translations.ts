import path from "path"
import {
  assertDirectoryExists,
  getLocalesInDirectory,
  readTranslationFile,
  isFile,
  writeFileSync,
  getJsonFilesInDirectory,
} from "../utils/io.ts"
import { relativePath } from "../utils/utils.ts"
import { logger } from "../utils/logger.ts"
import {
  getChangesSummary,
  getTranslationChanges,
  applyPatch,
} from "../utils/translations.ts"
import { loadConfig } from "../utils/load-config.ts"
import z from "zod"

type MergeFileResult = {
  patchPath: string
  basePath: string
  addedKeys: string[]
  modifiedKeys: string[]
  createdNewFile: boolean
}

type Args = {
  patch: string
  base: string
  namespaced: boolean
  workflow?: string
}

const mergeFiles = (patchPath: string, basePath: string): MergeFileResult => {
  const patchTranslations = readTranslationFile(patchPath)
  const baseExists = isFile(basePath)
  const baseTranslations = baseExists ? readTranslationFile(basePath) : {}
  const translationChanges = getTranslationChanges({
    base: baseTranslations,
    patch: patchTranslations,
  })
  const mergedTranslations = applyPatch({
    base: baseTranslations,
    patch: patchTranslations,
  })

  const mergedContent = JSON.stringify(mergedTranslations, null, 2)
  writeFileSync(basePath, mergedContent)

  return {
    patchPath,
    basePath,
    ...getChangesSummary(translationChanges),
    createdNewFile: !baseExists,
  }
}

const mergeDirectories = (
  patchDir: string,
  baseDir: string,
): Record<string, MergeFileResult> => {
  assertDirectoryExists(patchDir)
  assertDirectoryExists(baseDir)

  const jsonFiles = getJsonFilesInDirectory(patchDir, { stripExtension: true })
  if (!jsonFiles.length) {
    logger.warn(
      `No JSON files found in patch directory: ${relativePath(patchDir)}`,
    )
  }

  const resultByFile: Record<string, MergeFileResult> = {}

  for (const jsonFile of jsonFiles) {
    const patchPath = path.join(patchDir, `${jsonFile}.json`)
    const basePath = path.join(baseDir, `${jsonFile}.json`)
    resultByFile[jsonFile] = mergeFiles(patchPath, basePath)
  }

  return resultByFile
}

const printMergeResult = (result: MergeFileResult): void => {
  const mergedMessage = `${result.createdNewFile ? "Created new file at" : "Merged to"} ${relativePath(
    result.basePath,
  )}`
  logger.success(mergedMessage)

  const addedKeysCount = result.addedKeys.length
  const modifiedKeysCount = result.modifiedKeys.length

  if (addedKeysCount === 0) {
    logger.info("No new keys added.")
  }

  if (modifiedKeysCount === 0) {
    logger.info("No keys modified.")
  }

  const table = {} as Record<string, string>
  if (addedKeysCount > 0) table["Added keys"] = result.addedKeys.join(", ")
  if (modifiedKeysCount > 0)
    table["Modified keys"] = result.modifiedKeys.join(", ")

  const hasChanges = addedKeysCount > 0 || modifiedKeysCount > 0
  if (hasChanges) {
    // eslint-disable-next-line no-console
    console.table(table)
  }
}

const printMergeResults = (results: MergeFileResult[]): void => {
  for (const result of results) {
    printMergeResult(result)
  }
}

const ArgsSchema = z.object({
  patch: z.string(),
  base: z.string(),
  namespaced: z.boolean(),
})

const createValidArgs = async (args: any): Promise<Args> => {
  if (args.config) {
    return await loadConfig({
      config: z.string().parse(args.config),
      command: "merge",
    })
  }

  return ArgsSchema.parse({
    patch: args.patch,
    base: args.base,
    namespaced: Boolean(args.namespaced),
  })
}

export const handleMergeTranslations = async (args: unknown) => {
  const validArgs = await createValidArgs(args)
  const { patch, base, namespaced } = validArgs

  let mergeResults: MergeFileResult[] = []

  if (namespaced) {
    const locales = getLocalesInDirectory(patch)

    if (locales.length === 0) {
      logger.warn(
        `No locale directories found in patch directory: ${relativePath(patch)}`,
      )
    }

    for (const locale of locales) {
      const patchLocaleDir = path.join(patch, locale)
      const baseLocaleDir = path.join(base, locale)
      const resultsByNamespace = mergeDirectories(patchLocaleDir, baseLocaleDir)
      mergeResults.push(...Object.values(resultsByNamespace))
    }
  } else {
    const resultsByLocale = mergeDirectories(patch, base)
    mergeResults = Object.values(resultsByLocale)
  }

  printMergeResults(mergeResults)
}
