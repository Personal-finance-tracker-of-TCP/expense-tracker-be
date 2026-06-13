const { Router } = require('express')
const budgetController = require('../controllers/budget.controller')
const authMiddleware = require('../middlewares/auth.middleware')

const router = Router()

router.use(authMiddleware)

router.get('/', budgetController.getBudgets)
router.post('/', budgetController.createBudget)
router.put('/:id', budgetController.updateBudget)
router.delete('/:id', budgetController.deleteBudget)

module.exports = router
