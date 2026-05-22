import { z } from 'zod'

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Tên danh mục không được để trống').max(50),
  icon: z.string().optional(),
  type: z.enum(['INCOME', 'EXPENSE', 'BOTH'], {
    errorMap: () => ({ message: 'Loại danh mục không hợp lệ' })
  }),
})

export const updateCategorySchema = createCategorySchema.partial()