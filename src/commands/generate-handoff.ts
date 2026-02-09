import path from "path"
import {
  getJsonFilesInDirectory,
  isDirectory,
  isFile,
  readTranslationFile,
  writeFileSync,
} from "../utils/io.ts"
import { relativePath, exitWithError } from "../utils/utils.ts"
import {
  getTranslationChanges,
  hasAnyTranslations,
} from "../utils/translations.ts"
import { logger } from "../utils/logger.ts"
import { loadConfig } from "../utils/load-config.ts"
import { z } from "zod"

type Args = {
  source: string // source file or directory
  snapshot: string // snapshot file or directory
  outDir: string // output directory
  verbose?: boolean
}

const ArgsSchema = z.object({
  source: z.string(),
  snapshot: z.string(),
  outDir: z.string(),
})

const createValidArgs = async (args: any): Promise<Args> => {
  const verbose = Boolean(args.verbose)

  if (args.config) {
    const loadedConfig = await loadConfig({
      config: z.string().parse(args.config),
      command: "handoff",
    })
    return { ...loadedConfig, verbose }
  }

  return ArgsSchema.parse({
    source: args.source,
    snapshot: args.snapshot,
    outDir: args.outDir,
    verbose,
  })
}

const computeChangesAndWriteHandoff = (args: Args): void => {
  const { source, snapshot, outDir } = args

  if (args.verbose) {
    logger.info(
      `Comparing source: ${relativePath(source)} against snapshot: ${relativePath(snapshot)}`,
    )
  }

  try {
    const translations = readTranslationFile(source)
    const snapshotExists = isFile(snapshot)
    const prevTranslations = snapshotExists ? readTranslationFile(snapshot) : {}

    if (args.verbose && !snapshotExists) {
      logger.info(
        `Snapshot file not found at: ${relativePath(snapshot)}. Considering all translations as new.`,
      )
    }

    const patch = snapshotExists
      ? getTranslationChanges({ base: prevTranslations, patch: translations })
          .patch
      : translations

    if (hasAnyTranslations(patch)) {
      const outFileName = path.basename(source)
      const outFilePath = path.join(outDir, outFileName)
      writeFileSync(outFilePath, JSON.stringify(patch, null, 2))
      logger.success(`Handoff file written to: ${relativePath(outFilePath)}`)
    } else {
      logger.info(`No changes detected in the file: ${relativePath(source)}.\n`)
    }
  } catch (error) {
    logger.warn(
      `Error processing files:\n Source: ${relativePath(source)}\n Snapshot: ${relativePath(snapshot)}\n ${error}`,
    )
  }
}

const generateHandoffOfDirectory = (args: Args): void => {
  const { source: sourceDir, snapshot: snapshotDir, outDir } = args
  const jsonFiles = getJsonFilesInDirectory(sourceDir)

  for (const file of jsonFiles) {
    const sourceFilePath = path.join(sourceDir, file)
    const snapshotFilePath = path.join(snapshotDir, file)
    computeChangesAndWriteHandoff({
      source: sourceFilePath,
      snapshot: snapshotFilePath,
      outDir,
      verbose: args.verbose,
    })
  }
}

const resolveInputMode = (
  source: string,
  snapshot: string,
): "directory" | "file" => {
  const sourceIsDirectory = isDirectory(source)
  const snapshotIsDirectory = isDirectory(snapshot)
  const sourceIsFile = isFile(source)
  const snapshotIsFile = isFile(snapshot)

  if (!sourceIsDirectory && !sourceIsFile) {
    exitWithError(`Source path does not exist: ${relativePath(source)}`)
  }

  if (!snapshotIsDirectory && !snapshotIsFile) {
    exitWithError(`Snapshot path does not exist: ${relativePath(snapshot)}`)
  }

  if (sourceIsDirectory && snapshotIsDirectory) return "directory"
  if (sourceIsFile && snapshotIsFile) return "file"
  return exitWithError(
    `Source and snapshot must both be directories or both be files.`,
  )
}

export const handleGenerateHandoff = async (args: unknown) => {
  const validArgs = await createValidArgs(args)
  const { source, snapshot } = validArgs
  const inputMode = resolveInputMode(source, snapshot)

  if (inputMode === "directory") {
    generateHandoffOfDirectory(validArgs)
  } else {
    computeChangesAndWriteHandoff(validArgs)
  }
}
