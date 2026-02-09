import fs from "fs"
import path from "path"
import { isDirectory, writeFileSync } from "../utils/io.ts"
import { assert, relativePath } from "../utils/utils.ts"
import { logger } from "../utils/logger.ts"
import { loadConfig } from "../utils/load-config.ts"
import z from "zod"

type Args = {
  source: string
  out: string
  config?: string
}

const ArgsSchema = z.object({
  source: z.string(),
  out: z.string(),
})

const createValidArgs = async (args: any): Promise<Args> => {
  if (args.config) {
    return await loadConfig({
      config: z.string().parse(args.config),
      command: "snapshot",
    })
  }

  return ArgsSchema.parse({
    source: args.source,
    out: args.out,
  })
}

export const isValidSourceFile = (pathStr: string): boolean => {
  if (!pathStr.endsWith(".json")) return false
  return fs.existsSync(pathStr) && fs.lstatSync(pathStr).isFile()
}

export const isValidOutputFile = (pathStr: string): boolean => {
  if (!pathStr.endsWith(".json")) return false
  if (fs.existsSync(pathStr)) return fs.lstatSync(pathStr).isFile()
  return true
}

const saveSnapshot = (sourceFile: string, outFile: string) => {
  try {
    assert(
      isValidSourceFile(sourceFile),
      `Source file must be a JSON file: ${sourceFile}`,
    )
    assert(
      isValidOutputFile(outFile),
      `Output file must be a JSON file: ${outFile}`,
    )

    const content = fs.readFileSync(sourceFile, "utf-8")
    writeFileSync(outFile, content)
    logger.success(
      `📷 Snapshot of ${relativePath(sourceFile)} saved at ${relativePath(outFile)}`,
    )
  } catch (error) {
    logger.error(
      `Failed to save snapshot of ${sourceFile}: ${(error as Error).message}`,
    )
  }
}

const saveSnapshotOfDirectory = (sourceDir: string, outDir: string) => {
  const jsonFiles = fs
    .readdirSync(sourceDir)
    .filter((file) => file.endsWith(".json"))

  for (const file of jsonFiles) {
    const sourceFilePath = path.join(sourceDir, file)
    const outFilePath = path.join(outDir, file)
    saveSnapshot(sourceFilePath, outFilePath)
  }
}

export const handleGenerateSnapshot = async (args: any) => {
  const validArgs = await createValidArgs(args)

  if (isDirectory(validArgs.source)) {
    saveSnapshotOfDirectory(validArgs.source, validArgs.out)
  } else {
    saveSnapshot(validArgs.source, validArgs.out)
  }
}
