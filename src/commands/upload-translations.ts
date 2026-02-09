import z from "zod"
import { uploadToDrive } from "../utils/google-drive"

type Args = {
  targetFolderId: string
  targetFileName: string
  sourceFilePath: string
}

const ArgsSchema = z.object({
  targetFolderId: z.string().min(1, "targetFolderId is required"),
  targetFileName: z.string().min(1, "targetFileName is required"),
  sourceFilePath: z.string().min(1, "sourceFilePath is required"),
})

const createValidArgs = (args: any): Args => {
  return ArgsSchema.parse({
    targetFolderId: args.targetFolderId,
    targetFileName: args.targetFileName,
    sourceFilePath: args.sourceFilePath,
  })
}

export const handleUploadTranslations = async (args: unknown) => {
  const validArgs = createValidArgs(args)
  const { targetFolderId, targetFileName, sourceFilePath } = validArgs

  await uploadToDrive({ sourceFilePath, targetFolderId, targetFileName })
}
