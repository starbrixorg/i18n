import z from "zod"
import { downloadFromDrive } from "../utils/google-drive"
import { exitWithError } from "../utils/utils"

type Args = z.infer<typeof ArgsSchema>

const ArgsSchema = z
  .object({
    folder: z.enum(["ui", "api"], {
      message: "folder must be either 'ui' or 'api'",
    }),
    prNumber: z.string().min(1, "prNumber is required").optional(),
    sourceFileName: z.string().optional(),
  })
  .refine(
    ({ prNumber, sourceFileName }) => {
      return Boolean(prNumber) !== Boolean(sourceFileName)
    },
    {
      message:
        "Either prNumber or sourceFileName must be provided, but not both",
    },
  )
  .transform((data) => {
    const sourceFileName = data.sourceFileName || createFileName(data.prNumber!)
    return {
      folder: data.folder,
      sourceFileName,
    }
  })

const createValidArgs = (args: any): Args => {
  try {
    return ArgsSchema.parse(args)
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.message
        : "Unknown error during argument validation"
    return exitWithError(`Invalid arguments: ${message}`)
  }
}

const createFileName = (prNumber: string) => {
  return `i18n-translated-${prNumber}.zip`
}

export const handleDownloadTranslations = async (args: unknown) => {
  const validArgs = createValidArgs(args)
  const { folder, sourceFileName } = validArgs

  await downloadFromDrive({
    sourceFileName,
    folder,
  })
}
