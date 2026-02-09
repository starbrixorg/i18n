import path from "path"
import type { ArgMap } from "../types.ts"
import { camelCase } from "lodash-es"
import { logger } from "./logger.ts"

export const isPlainObject = (value: any): value is Record<string, any> => {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export const parseArgs = (args: string[]): ArgMap => {
  const argMap: ArgMap = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith("--")) {
      const key = arg.slice(2)
      const nextArg = args[i + 1]
      if (nextArg && !nextArg.startsWith("--")) {
        argMap[camelCase(key)] = nextArg
        i++
      } else {
        argMap[camelCase(key)] = true
      }
    }
  }

  return argMap
}

export const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(message)
  }
}

export const relativePath = (pathStr: string): string =>
  path.relative(process.cwd(), pathStr)

export const exitWithError = (message: string): never => {
  logger.error(`${message}\n`)
  process.exit(1)
}

// Types for the result object with discriminated union
type Success<T> = {
  data: T
  error: null
}

type Failure<E> = {
  data: null
  error: E
}

type Result<T, E = Error> = Success<T> | Failure<E>

export async function tryCatch<T, E = Error>(
  promise: Promise<T>,
): Promise<Result<T, E>> {
  try {
    const data = await promise
    return { data, error: null }
  } catch (error) {
    return { data: null, error: error as E }
  }
}
