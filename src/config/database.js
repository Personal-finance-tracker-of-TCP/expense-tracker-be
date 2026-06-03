function getSafeDatabaseConfig(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    return {
      host: '(not configured)',
      database: '(not configured)',
      username: '(not configured)',
    }
  }

  try {
    const parsed = new URL(databaseUrl)
    return {
      host: parsed.hostname || '(not configured)',
      database: parsed.pathname ? decodeURIComponent(parsed.pathname.replace(/^\/+/, '')) : '(not configured)',
      username: parsed.username ? decodeURIComponent(parsed.username) : '(not configured)',
    }
  } catch (error) {
    return {
      host: '(invalid DATABASE_URL)',
      database: '(invalid DATABASE_URL)',
      username: '(invalid DATABASE_URL)',
    }
  }
}

function logDatabaseConfig(logger = console) {
  const config = getSafeDatabaseConfig()

  logger.log(`Database host: ${config.host}`)
  logger.log(`Database name: ${config.database}`)
  logger.log(`Database username: ${config.username}`)
}

module.exports = {
  getSafeDatabaseConfig,
  logDatabaseConfig,
}
