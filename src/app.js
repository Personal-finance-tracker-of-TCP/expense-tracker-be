import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { errorHandler } from './middlewares/error.middleware.js'

import transactionRoutes from './routes/transaction.routes.js'
import categoryRoutes from './routes/category.routes.js'

dotenv.config()
const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.send('Expense Tracker API is running')
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/transactions', transactionRoutes)
app.use('/api/categories', categoryRoutes)

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

export default app