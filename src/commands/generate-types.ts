import path from "path"
import type { Translations } from "../types.ts"
import {
  assertDirectoryExists,
  readNamespacesFromDirectory,
  writeFileSync,
} from "../utils/io.ts"
import { flattenTranslations, sortTranslations } from "../utils/translations.ts"
import { logger } from "../utils/logger.ts"
import { loadConfig } from "../utils/load-config.ts"
import z from "zod"

type Args = {
  source: string
  out: string
  locale: string
}

type ResourcesObject = Record<string, Translations>

const createResourcesTypeFileContent = (
  resourcesObject: ResourcesObject,
  locale: string,
): string => {
  const header = [
    "/* eslint-disable */",
    "// ============================================================",
    "// This file is auto-generated",
    "// DO NOT EDIT BY HAND.",
    "// ============================================================",
    "",
  ].join("\n")

  const resourcesExport = `export const resources = ${JSON.stringify(resourcesObject, null, 2)};\n`
  const typeExport = `export type Resources = typeof resources["${locale}"];\n`
  const content = header + "\n" + resourcesExport + "\n" + typeExport

  return content
}

const generateNamespacedResourcesTypeFile = (args: Args): string => {
  const localeDir = path.join(args.source, args.locale)
  assertDirectoryExists(localeDir)

  const translationsByNamespace = readNamespacesFromDirectory(localeDir)
  const flatTranslationsByNamespace: Record<string, Translations> = {}

  for (const [namespace, translations] of Object.entries(
    translationsByNamespace,
  )) {
    flatTranslationsByNamespace[namespace] = sortTranslations(
      flattenTranslations(translations),
    )
  }
  const resourcesObject: ResourcesObject = {
    [args.locale]: flatTranslationsByNamespace,
  }
  return createResourcesTypeFileContent(resourcesObject, args.locale)
}

const ArgsSchema = z.object({
  source: z.string(),
  out: z.string(),
  locale: z.string(),
})

const createValidArgs = async (args: any): Promise<Args> => {
  if (args.config) {
    return await loadConfig({
      config: z.string().parse(args.config),
      command: "types",
    })
  }

  return ArgsSchema.parse({
    source: args.source,
    out: args.out,
    locale: args.locale,
  })
}

export const handleGenerateTypes = async (args: unknown) => {
  const validArgs = await createValidArgs(args)
  const { out } = validArgs

  try {
    const resourcesTypeFileContent =
      generateNamespacedResourcesTypeFile(validArgs)
    writeFileSync(out, resourcesTypeFileContent)
    logger.success(`Generated i18n types at: ${out}\n`)
  } catch (error) {
    logger.warn(`Failed to generate i18n types: ${error}\n`)
  }
}
