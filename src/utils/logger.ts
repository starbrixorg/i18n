/* eslint-disable no-console */
import pico from "picocolors"

export const logger = {
  info: (msg: string) => {
    console.log(pico.blue(`ℹ️  INFO: ${msg}`))
  },
  success: (msg: string) => {
    console.log(pico.green(`✅ SUCCESS: ${msg}`))
  },
  warn: (msg: string) => {
    console.log(pico.yellow(`⚠️  WARN: ${msg}`))
  },
  error: (msg: string) => {
    console.log(pico.red(`❌ ERROR: ${msg}`))
  },
}

export const createLogger = (verbose: boolean) => {
  if (verbose) {
    return logger
  }
  return {
    ...logger,
    info: () => {}, // no-op for info when not verbose
  }
}
