import { parseArgs } from "./utils/utils.ts"
import { handleGenerateSnapshot } from "./commands/generate-snapshot.ts"
import { handleGenerateTypes } from "./commands/generate-types.ts"
import { handleMergeTranslations } from "./commands/merge-translations.ts"
import { handleGenerateHandoff } from "./commands/generate-handoff.ts"
import { handleValidateTranslations } from "./commands/validate-translations.ts"
import { handleUploadTranslations } from "./commands/upload-translations.ts"
import { handleDownloadTranslations } from "./commands/download-translations.ts"
import { handleSyncTranslations } from "./commands/sync-translations.ts"
import dotenv from "dotenv"

dotenv.config()

export const runCli = (args: string[]): void | Promise<void> => {
  const parsedArgs = parseArgs(args)
  const command = args[0]

  // Handle "generate" command
  if (command === "generate") {
    const subCommand = args[1]
    switch (subCommand) {
      case "types":
        return handleGenerateTypes(parsedArgs)
      case "snapshot":
        return handleGenerateSnapshot(parsedArgs)
      case "handoff":
        return handleGenerateHandoff(parsedArgs)
      default:
        throw new Error(`Unknown generate sub-command: ${subCommand}`)
    }
  }

  // Handle merge command
  if (command === "merge") {
    return handleMergeTranslations(parsedArgs)
  }

  // Handle validate command
  if (command === "validate") {
    return handleValidateTranslations(parsedArgs)
  }

  // Handle upload command
  if (command === "upload") {
    return handleUploadTranslations(parsedArgs)
  }

  // Handle download command
  if (command === "download") {
    return handleDownloadTranslations(parsedArgs)
  }

  // Handle sync command
  if (command === "sync") {
    return handleSyncTranslations(parsedArgs)
  }

  // If no valid command is found, throw an error
  throw new Error(`Unknown command: ${command}`)
}
