import { Router } from 'express'
import * as reportController from '../controllers/report.controller.js'
import { verifyToken } from '../middlewares/auth.middleware.js'

const router = Router()

router.use(verifyToken)

router.get('/summary', reportController.getSummary)
router.get('/chart', reportController.getChartData)
router.get('/export', reportController.exportReport)

export default router