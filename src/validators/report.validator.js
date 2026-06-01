import { z } from 'zod'

export const reportQuerySchema = z.object({
  from: z.string().datetime({ message: 'Ngày bắt đầu không hợp lệ' }).optional(),
  to: z.string().datetime({ message: 'Ngày kết thúc không hợp lệ' }).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).optional(),
})

export const exportQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).optional(),
  format: z.enum(['pdf', 'excel'], {
    errorMap: () => ({ message: 'Format phải là pdf hoặc excel' })
  })
})