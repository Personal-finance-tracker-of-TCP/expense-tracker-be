const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const { errorHandler } = require('./middlewares/error.middleware')

const transactionRoutes = require('./routes/transaction.routes')
const categoryRoutes = require('./routes/category.routes')

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

module.exports = app
