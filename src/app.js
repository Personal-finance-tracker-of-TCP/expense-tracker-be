const express = require('express')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true })

const prisma = require('./lib/prisma')
const { logDatabaseConfig } = require('./config/database')
const { errorHandler } = require('./middlewares/error.middleware')
const app = express()
const PORT = process.env.PORT || 5000
const cors = require("cors");

const allowedOrigins = [
  "http://localhost:3000",
  ...(process.env.FRONTEND_URL || "").split(","),
  ...(process.env.CORS_ORIGIN || "").split(","),
]
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-webhook-secret"],
}

app.use(cors(corsOptions));
app.options("/{*splat}", cors(corsOptions));
app.use(express.json({ limit: '2mb' }))
const cookieParser = require('cookie-parser')
app.use(cookieParser())


const authRoutes = require('./routes/auth.routes')
const transactionRoutes = require('./routes/transaction.routes')
const categoryRoutes = require('./routes/category.routes')
const reportRoutes = require('./routes/report.routes')
const budgetRoutes = require('./routes/budget.routes')
const aiRoutes = require('./routes/ai.routes')
const { webhookRoutes } = require('./routes/webhook.routes')
const adminRoutes = require('./routes/admin.routes')
const bankLinkRoutes = require('./routes/bank-link.routes')
const bankhubRoutes = require('./routes/bankhub.routes')
const notificationRoutes = require('./routes/notification.routes')
const userRoutes = require('./routes/user.routes')
const feedbackRoutes = require('./routes/feedback.routes')
const publicRoutes = require('./routes/public.routes')

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
app.use('/api/admin', adminRoutes)
app.use('/api/bank-link', bankLinkRoutes)
app.use('/api/bankhub', bankhubRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/users', userRoutes)
app.use('/api/feedback', feedbackRoutes)
app.use('/api/public', publicRoutes)



app.use(errorHandler)

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    logDatabaseConfig()
  })
}

module.exports = app
