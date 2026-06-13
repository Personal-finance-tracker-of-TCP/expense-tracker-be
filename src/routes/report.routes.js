const { Router } = require('express')
const reportController = require('../controllers/report.controller')
const authMiddleware = require('../middlewares/auth.middleware')

const router = Router()

router.use(authMiddleware)

router.get('/summary', reportController.getSummary)
router.get('/chart', reportController.getChartData)
router.get('/export', reportController.exportReport)

module.exports = router