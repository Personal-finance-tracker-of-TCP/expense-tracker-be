const { Router } = require('express')
const transactionController = require('../controllers/transaction.controller')
const authMiddleware = require('../middlewares/auth.middleware')

const router = Router()

router.use(authMiddleware)

router.get('/', transactionController.getTransactions)
router.post('/', transactionController.createTransaction)
router.patch('/:id/exclude', transactionController.excludeTransaction)
router.patch('/:id/classify', transactionController.classifyTransaction)
router.get('/:id', transactionController.getTransactionById)
router.put('/:id', transactionController.updateTransaction)
router.delete('/:id', transactionController.deleteTransaction)

module.exports = router
