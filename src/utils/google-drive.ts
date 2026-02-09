import fs from "fs"
import { drive_v3, google } from "googleapis"
import { exitWithError, tryCatch } from "./utils"
import { isFile } from "./io"
import z from "zod"
import { logger } from "./logger"
import path from "path"
import { pipeline } from "stream/promises"
import Stream from "stream"

let cachedDriveClient: drive_v3.Drive | null = null

type UploadArgs = {
  targetFolderId: string
  targetFileName: string
  sourceFilePath: string
}

type DownloadArgs = {
  folder: "ui" | "api"
  sourceFileName: string
}

type JwtCredentials = z.infer<typeof JwtCredentials>

const getFolderIds = (): { ui: string; api: string } => {
  const uiFolderId = process.env.I18N_GOOGLE_DRIVE_UI_FOLDER_ID
  const apiFolderId = process.env.I18N_GOOGLE_DRIVE_API_FOLDER_ID

  return {
    ui: z.string().parse(uiFolderId),
    api: z.string().parse(apiFolderId),
  }
}

const JwtCredentials = z
  .object({
    client_email: z.string(),
    private_key: z.string(),
  })
  .strip()
  .transform((data) => {
    return {
      email: data.client_email,
      key: data.private_key,
    }
  })

const getJwtCredentials = (): JwtCredentials => {
  const serviceAccountJson = process.env.I18N_GOOGLE_DRIVE_SA
  if (!serviceAccountJson) {
    return exitWithError(
      `Env var "I18N_GOOGLE_DRIVE_SA" is required for Google Drive operations.`,
    )
  }

  let credentials
  try {
    credentials = JSON.parse(serviceAccountJson)
  } catch (error) {
    exitWithError(`I18N_GOOGLE_DRIVE_SA is not valid JSON ${error}`)
  }

  return JwtCredentials.parse(credentials)
}

const createDriveClient = () => {
  if (cachedDriveClient) {
    return cachedDriveClient
  }

  const credentials = getJwtCredentials()

  const auth = new google.auth.JWT({
    ...credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  })

  cachedDriveClient = google.drive({ version: "v3", auth })
  return cachedDriveClient
}

const getFileIdByName = async (
  drive: drive_v3.Drive,
  fileName: string,
  folder: "ui" | "api",
): Promise<string> => {
  const folderIds = getFolderIds()
  const query = `name='${fileName}' and trashed=false`
  const parentFolderId = folderIds[folder]

  const { data: response, error } = await tryCatch(
    drive.files.list({
      q: query,
      fields: "files(id, name, parents)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      driveId: "0AMglBNpZuZb8Uk9PVA",
      corpora: "drive",
    }),
  )

  if (error) {
    return exitWithError(`Failed to list files from google drive: ${error}`)
  }

  const matchedFiles = (response.data.files || []).filter((file) => {
    if (!file.parents) return false
    return file.parents.includes(parentFolderId)
  })

  if (matchedFiles.length !== 1) {
    return exitWithError(
      `File with name ${fileName} matched ${matchedFiles.length} files in Google Drive.`,
    )
  }

  const [file] = matchedFiles
  return file.id!
}

const downloadFileById = async (
  drive: drive_v3.Drive,
  fileId: string,
): Promise<Stream.Readable> => {
  try {
    const { data: downloadResponse, error: downloadError } = await tryCatch(
      drive.files.get(
        {
          fileId,
          alt: "media",
          supportsAllDrives: true,
        },
        {
          responseType: "stream",
          headers: {
            acceptEncoding: "gzip",
          },
        },
      ),
    )

    if (downloadError) {
      return exitWithError(
        `Failed to download file from google drive: ${downloadError}`,
      )
    }

    if (!downloadResponse || !downloadResponse.data) {
      return exitWithError(
        `No response data when downloading file from google drive`,
      )
    }

    return downloadResponse.data
  } catch (error) {
    return exitWithError(`Failed to download file from google drive: ${error}`)
  }
}

const saveToFile = async (
  readable: NodeJS.ReadableStream,
  destPath: string,
): Promise<void> => {
  const { error: mkdirError } = await tryCatch(
    fs.promises.mkdir(path.dirname(destPath), { recursive: true }),
  )
  if (mkdirError) {
    return exitWithError(
      `Failed to create directories for ${destPath}: ${mkdirError}`,
    )
  }

  const writeStream = fs.createWriteStream(destPath)
  const { error: writeError } = await tryCatch(pipeline(readable, writeStream))

  if (writeError) {
    exitWithError(`Failed to write downloaded file to disk: ${writeError}`)
  }
}

export const uploadToDrive = async (uploadArgs: UploadArgs): Promise<void> => {
  const { targetFolderId, targetFileName, sourceFilePath } = uploadArgs
  if (!isFile(sourceFilePath)) {
    return exitWithError(`Source file does not exist: ${sourceFilePath}`)
  }

  const drive = createDriveClient()

  const { error } = await tryCatch(
    drive.files.create({
      requestBody: {
        name: targetFileName,
        parents: [targetFolderId],
      },
      media: {
        body: fs.createReadStream(sourceFilePath),
      },
      supportsAllDrives: true,
      fields: "id",
    }),
  )

  if (error) {
    exitWithError(`Failed to upload file to google drive: ${error}`)
  }

  logger.success(
    `Uploaded ${sourceFilePath} to google drive as ${targetFileName}`,
  )
}

export const downloadFromDrive = async (args: DownloadArgs): Promise<void> => {
  const { sourceFileName, folder } = args
  const drive = createDriveClient()
  const destPath = path.join(".temp", "downloads", sourceFileName)

  logger.info(`Looking for file ${sourceFileName} in Google Drive...`)
  const fileId = await getFileIdByName(drive, sourceFileName, folder)

  logger.info(`Found file ${sourceFileName} with ID ${fileId}`)
  logger.info(`Downloading file ${sourceFileName} from Google Drive...`)
  const fileStream = await downloadFileById(drive, fileId)

  logger.info(`Saving downloaded file to ${destPath}...`)
  await saveToFile(fileStream, destPath)

  logger.success(`Downloaded file to ${destPath}`)
}
