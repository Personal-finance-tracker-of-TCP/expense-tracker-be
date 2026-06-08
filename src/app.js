const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true })

const prisma = require('./lib/prisma')
const { logDatabaseConfig } = require('./config/database')
const { errorHandler } = require('./middlewares/error.middleware')
const app = express()
const PORT = process.env.PORT || 5000
const allowedOrigins = (
  process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
)
app.use(express.json())

const authRoutes = require('./routes/auth.routes')
const transactionRoutes = require('./routes/transaction.routes')
const categoryRoutes = require('./routes/category.routes')
const reportRoutes = require('./routes/report.routes')
const budgetRoutes = require('./routes/budget.routes')
const aiRoutes = require('./routes/ai.routes')
const { webhookRoutes, adminSepayRoutes } = require('./routes/webhook.routes')

app.use('/auth', authRoutes)

app.get('/', (req, res) => {
  res.send('Expense Tracker API is running')
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.get('/health/db', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', database: 'ok' })
  } catch (error) {
    res.status(503).json({ status: 'error', database: 'unavailable' })
  }
})

app.use('/api/transactions', transactionRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/budgets', budgetRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/webhooks', webhookRoutes)
app.use('/api/admin', adminSepayRoutes)

app.use(errorHandler)

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    logDatabaseConfig()
  })
}

module.exports = app
