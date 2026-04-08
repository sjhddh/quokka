export interface Config {
  port: number
  dbPath: string
}

export function loadConfig(): Config {
  return {
    port: Number(process.env.QUOKKA_PORT) || 7749,
    dbPath: process.env.QUOKKA_DB_PATH || 'quokka.db',
  }
}
