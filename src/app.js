import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { errorHandler } from './middlewares/error.middleware.js'

// Routes (uncomment khi từng người tạo xong)
// import authRoutes from './routes/auth.routes.js'
import transactionRoutes from './routes/transaction.routes.js'
import categoryRoutes from './routes/category.routes.js'
// import budgetRoutes from './routes/budget.routes.js'
import reportRoutes from './routes/report.routes.js'
// import webhookRoutes from './routes/webhook.routes.js'
// import aiRoutes from './routes/ai.routes.js'

dotenv.config()
const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

// app.use('/api/auth', authRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/categories', categoryRoutes)
// app.use('/api/budgets', budgetRoutes)
app.use('/api/reports', reportRoutes)
// app.use('/api/webhook', webhookRoutes)
// app.use('/api/ai', aiRoutes)

app.get('/health', (req, res) => res.json({ status: 'ok' }))

app.use(errorHandler)

app.listen(PORT, () => console.log(`Server running on port ${PORT}`))

export default app