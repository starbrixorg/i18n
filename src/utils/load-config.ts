import path from "path"
import { pathToFileURL } from "url"
import { z } from "zod"

type Command = keyof CommandSchemasType
type ConfigSchema = z.infer<typeof configSchema>
type CommandSchemasType = {
  validate: ConfigSchema["validate"]
  snapshot: ConfigSchema["generate"]["snapshot"]
  handoff: ConfigSchema["generate"]["handoff"]
  types: ConfigSchema["generate"]["types"]
  merge: ConfigSchema["merge"]
  sync: ConfigSchema["sync"]
}

const configSchema = z.object({
  generate: z.object({
    snapshot: z.object({
      source: z.string(),
      out: z.string(),
    }),
    handoff: z.object({
      source: z.string(),
      snapshot: z.string(),
      outDir: z.string(),
    }),
    types: z.object({
      source: z.string(),
      out: z.string(),
      locale: z.string(),
    }),
  }),
  merge: z.object({
    patch: z.string(),
    base: z.string(),
    namespaced: z.boolean(),
  }),
  validate: z.object({
    dir: z.string(),
    baseLocale: z.string(),
    baseLocaleDir: z.string(),
    namespaced: z.boolean(),
  }),
  sync: z.object({
    localesDir: z.string(),
    tempDir: z.string(),
    context: z.enum(["ui", "api"]),
    namespaced: z.boolean(),
    deleteTempDir: z.boolean().optional().default(true),
  }),
})

export async function loadConfig<C extends Command>({
  config: configFile,
  command,
}: {
  config: string
  command: C
}): Promise<CommandSchemasType[C]> {
  let mod: any
  const configPath = path.resolve(process.cwd(), configFile)
  try {
    mod = await import(pathToFileURL(configPath).href)
  } catch (err) {
    throw new Error(
      `Failed to load i18n config at ${configPath}\n` +
        `Make sure the file exists and is valid ESM.`,
    )
  }

  const config = mod?.default
  if (!config || typeof config !== "object") {
    throw new Error(`Invalid i18n config: default export must be an object`)
  }

  // Validate the full config at runtime
  const parsedConfig = configSchema.safeParse(config)
  if (!parsedConfig.success) {
    throw new Error(
      `Invalid i18n config:\n${z.formatError(parsedConfig.error)}`,
    )
  }

  // Validate and return only the relevant section for the command
  switch (command) {
    case "validate":
      return parsedConfig.data.validate as CommandSchemasType[C]
    case "snapshot":
      return parsedConfig.data.generate.snapshot as CommandSchemasType[C]
    case "handoff":
      return parsedConfig.data.generate.handoff as CommandSchemasType[C]
    case "types":
      return parsedConfig.data.generate.types as CommandSchemasType[C]
    case "merge":
      return parsedConfig.data.merge as CommandSchemasType[C]
    case "sync":
      return parsedConfig.data.sync as CommandSchemasType[C]
    default:
      throw new Error(`Unsupported command: ${command}`)
  }
}
