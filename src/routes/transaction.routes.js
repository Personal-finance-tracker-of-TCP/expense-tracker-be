import { Router } from 'express'
import * as transactionController from '../controllers/transaction.controller.js'
import { verifyToken } from '../middlewares/auth.middleware.js'

const router = Router()

router.use(verifyToken)

router.get('/', transactionController.getTransactions)
router.post('/', transactionController.createTransaction)
router.get('/:id', transactionController.getTransactionById)
router.put('/:id', transactionController.updateTransaction)
router.delete('/:id', transactionController.deleteTransaction)

export default router