const { z } = require('zod')

const createCategorySchema = z.object({
  name: z
    .string({ message: 'Tên danh mục không được để trống' })
    .trim()
    .min(1, 'Tên danh mục không được để trống')
    .max(50, 'Tên danh mục không được vượt quá 50 ký tự'),
  icon: z.string().optional(),
  color: z.string().optional(),
  type: z.enum(['INCOME', 'EXPENSE', 'BOTH'], {
    message: 'Loại danh mục không hợp lệ'
  }),
})

const updateCategorySchema = createCategorySchema.partial()

module.exports = {
  createCategorySchema,
  updateCategorySchema,
}
