const { Router } = require('express')
const publicController = require('../controllers/public.controller')

const router = Router()

router.get('/statistics', publicController.getStatistics)
router.get('/health', publicController.getHealth)

module.exports = router
