import log from 'electron-log/main'

export function setupLogger(): void {
  log.transports.file.level = 'info'
  log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'warn'
  log.transports.file.maxSize = 10 * 1024 * 1024 // 10 MB rotation
}

export { log }
