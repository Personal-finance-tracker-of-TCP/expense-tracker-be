const { Router } = require('express')
const categoryController = require('../controllers/category.controller')
const authMiddleware = require('../middlewares/auth.middleware')

const router = Router()

// Tất cả category routes đều cần đăng nhập
router.use(authMiddleware)

router.get('/', categoryController.getCategories)
router.post('/', categoryController.createCategory)
router.put('/:id', categoryController.updateCategory)
router.delete('/:id', categoryController.deleteCategory)

module.exports = router
