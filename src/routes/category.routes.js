import { Router } from 'express'
import * as categoryController from '../controllers/category.controller.js'
import { verifyToken } from '../middlewares/auth.middleware.js'

const router = Router()

// Tất cả category routes đều cần đăng nhập
router.use(verifyToken)

router.get('/', categoryController.getCategories)
router.post('/', categoryController.createCategory)
router.put('/:id', categoryController.updateCategory)
router.delete('/:id', categoryController.deleteCategory)

export default router