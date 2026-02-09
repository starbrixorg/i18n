import fs from "fs"
import path from "path"
import type { Translations } from "../types.ts"
import { SUPPORTED_LOCALES } from "./constants.ts"
import { assert } from "./utils.ts"

export const assertDirectoryExists = (path: string): void => {
  if (!fs.existsSync(path) || !fs.lstatSync(path).isDirectory()) {
    throw new Error(`Directory does not exist: ${path}`)
  }
}

export const readTranslationFile = (path: string): Translations => {
  try {
    const fileContent = fs.readFileSync(path, "utf-8")
    return JSON.parse(fileContent) as Translations
  } catch (error) {
    throw new Error(
      `Failed to read or parse translation file at ${path}\n${(error as Error).message}\n`,
    )
  }
}

export const readNamespacesFromDirectory = (
  path: string,
): Record<string, Translations> => {
  assertDirectoryExists(path)

  const namespaces = getNamespacesInDirectory(path)
  const translationsByNamespace: Record<string, Translations> = {}

  for (const namespace of namespaces) {
    const filePath = `${path}/${namespace}.json`
    translationsByNamespace[namespace] = readTranslationFile(filePath)
  }

  return translationsByNamespace
}

export const getNamespacesInDirectory = (dirPath: string): string[] => {
  assertDirectoryExists(dirPath)

  const files = fs.readdirSync(dirPath)
  return files
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, "")) // Remove .json extension
}

export const writeFileSync = (filePath: string, content: string): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, "utf-8")
}

export const getLocalesInDirectory = (
  dirPath?: string,
  supportedLocales = SUPPORTED_LOCALES,
) => {
  if (!dirPath) return supportedLocales

  assertDirectoryExists(dirPath)

  return fs
    .readdirSync(dirPath)
    .map((file) =>
      file.endsWith(".json") ? file.replace(/\.json$/, "") : file,
    )
    .filter((mayBeLocale) => supportedLocales.includes(mayBeLocale))
    .sort()
}

export const isDirectory = (pathStr: string): boolean => {
  try {
    return fs.lstatSync(pathStr).isDirectory()
  } catch {
    return false
  }
}

export const isFile = (pathStr: string): boolean => {
  try {
    return fs.lstatSync(pathStr).isFile()
  } catch {
    return false
  }
}

export const getJsonFilesInDirectory = (
  dirPath: string,
  options: { stripExtension?: boolean } = {},
): string[] => {
  assert(isDirectory(dirPath), `Path is not a directory: ${dirPath}`)
  const jsonFiles = fs
    .readdirSync(dirPath)
    .filter((file) => file.endsWith(".json"))
  if (options.stripExtension) {
    return jsonFiles.map((file) => file.replace(/\.json$/, ""))
  } else {
    return jsonFiles
  }
}

export const rmRfDir = (dirPath: string): void => {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true })
  }
}
