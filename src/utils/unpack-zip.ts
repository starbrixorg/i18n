import unzipper from "unzipper"
import path from "path"
import fs from "fs"
import { exitWithError, relativePath, tryCatch } from "./utils"
import { logger } from "./logger"

const createDirectory = async (path: string): Promise<void> => {
  const { error: dirError } = await tryCatch(
    fs.promises.mkdir(path, { recursive: true }),
  )
  if (dirError) {
    return exitWithError(
      `Failed to create output directory: ${dirError.message}`,
    )
  }
}

const assertZipExists = (zipFilePath: string): void => {
  if (!fs.existsSync(zipFilePath)) {
    return exitWithError(`Zip file not found: ${zipFilePath}`)
  }
  const stats = fs.statSync(zipFilePath)

  if (!stats.isFile()) {
    return exitWithError(`Provided path is not a file: ${zipFilePath}`)
  }
  if (path.extname(zipFilePath).toLowerCase() !== ".zip") {
    return exitWithError(`Provided file is not a zip archive: ${zipFilePath}`)
  }
}

/**
 * Unpacks a zip archive to a temporary directory `.temp/unpacked/<zip-file-base-name>`
 * @param zipFilePath - The path to the zip file to be unpacked. Must be an existing `.zip` file.
 * @returns A promise that resolves to the path of the output directory where the zip was unpacked.
 */
export const unpackZip = async (zipFilePath: string): Promise<string> => {
  assertZipExists(zipFilePath)

  const baseName = path.basename(zipFilePath, path.extname(zipFilePath))
  const outputDir = path.join(".temp", "unpacked")
  await createDirectory(outputDir)

  const { error: unpackError } = await tryCatch(
    fs
      .createReadStream(zipFilePath)
      .pipe(unzipper.Extract({ path: outputDir }))
      .promise(),
  )

  if (unpackError) {
    return exitWithError(`Failed to unpack zip file: ${unpackError.message}`)
  } else {
    const unpackedTo = path.join(outputDir, baseName)
    logger.info(`Unpacked ${relativePath(zipFilePath)} to ${unpackedTo}`)
    return unpackedTo
  }
}
