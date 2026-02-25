import z from "zod"
import { downloadFromDrive } from "../utils/google-drive"
import { createLogger } from "../utils/logger"
import { unpackZip } from "../utils/unpack-zip"
import path from "path"
import { validateTranslations } from "./validate-translations"
import { mergeTranslations } from "./merge-translations"
import { rmRfDir } from "../utils/io"
import { loadConfig } from "../utils/load-config"

type Args = z.infer<typeof ArgsSchema>

const ArgsSchema = z.object({
  config: z.string().optional(),
  prNumber: z.string(),
  verbose: z.boolean().optional().default(false),

  context: z.enum(["ui", "api"]),
  localesDir: z.string(),
  tempDir: z.string(),
  namespaced: z.boolean(),
  deleteTempDir: z.boolean().optional().default(true),
  skipValidation: z.boolean().optional().default(false),
})

const createValidArgs = async (args: any): Promise<Args> => {
  const verbose = Boolean(args.verbose)
  const prNumber = ArgsSchema.shape.prNumber.parse(args.prNumber)

  if (args.config) {
    const loadedConfig = await loadConfig({
      config: z.string().parse(args.config),
      command: "sync",
    })

    return {
      ...loadedConfig,
      prNumber,
      verbose,
    }
  }
  return ArgsSchema.parse(args)
}

const createHandoffFile = (pr: string) => `i18n-handoff-${pr}.zip`
const createTranslatedFile = (pr: string) => `i18n-translation-${pr}.zip`

export const handleSyncTranslations = async (args: any) => {
  const {
    prNumber,
    context,
    tempDir,
    localesDir,
    namespaced,
    verbose,
    deleteTempDir,
    skipValidation,
  } = await createValidArgs(args)
  const downloadsDir = path.join(tempDir, "downloads")
  const logger = createLogger(verbose)

  logger.info(`🔄 Syncing translations for PR #${prNumber}...\n`)

  logger.info(`[1/6] 📥 Downloading translations from Google Drive...`)
  const handoffFileName = createHandoffFile(prNumber)
  const translatedFileName = createTranslatedFile(prNumber)
  await downloadFromDrive({ sourceFileName: handoffFileName, folder: context })
  await downloadFromDrive({
    sourceFileName: translatedFileName,
    folder: context,
  })
  logger.success(`Translations downloaded successfully.\n`)

  logger.info(`[2/6] Processing downloaded files...`)
  const handoffZipFilePath = path.resolve(downloadsDir, handoffFileName)
  const translatedZipFilePath = path.resolve(downloadsDir, translatedFileName)

  const unpackedHandoffPath = await unpackZip(handoffZipFilePath)
  const unpackedTranslatedPath = await unpackZip(translatedZipFilePath)
  logger.success(`Files extracted successfully.\n`)

  if (!skipValidation) {
    logger.info(`[3/6] Validating received translations...`)
    await validateTranslations({
      dir: unpackedTranslatedPath,
      baseLocaleDir: namespaced
        ? path.join(unpackedHandoffPath, "en")
        : unpackedHandoffPath,
      namespaced,
    })
    logger.success(`Received translations are consistent with handoff.\n`)
  }

  logger.info(`[4/6] Syncing translations to the project...`)
  await mergeTranslations({
    patch: unpackedTranslatedPath,
    base: localesDir,
    namespaced,
  })
  logger.success(`Translations merged successfully.\n`)

  if (!skipValidation) {
    logger.info(`[5/6] Validating merged translations...`)
    await validateTranslations({ dir: localesDir, namespaced, verbose })
    logger.success(`Merged translations are consistent with handoff.\n`)
  }

  if (deleteTempDir) {
    logger.info(`[6/6] Cleaning up temporary files...`)
    rmRfDir(tempDir)
    logger.success(`Temporary files cleaned up successfully.\n`)
  } else {
    logger.info(
      `[6/6] Temp files have not been deleted. Remember to clean up ${tempDir} manually when done.`,
    )
  }

  logger.success(`✅ Translations synced successfully for PR #${prNumber}!`)
}
