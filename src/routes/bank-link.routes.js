const { Router } = require('express')
const bankLinkController = require('../controllers/bank-link.controller')
const authMiddleware = require('../middlewares/auth.middleware')

const router = Router()

router.use(authMiddleware)

router.post('/', bankLinkController.linkBank)
router.post('/regenerate', bankLinkController.regenerateBankLink)
router.get('/', bankLinkController.getBankLink)
router.delete('/', bankLinkController.unlinkBank)

module.exports = router
