import { z } from 'zod'

export const createTransactionSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE'], {
    errorMap: () => ({ message: 'Loại giao dịch phải là INCOME hoặc EXPENSE' })
  }),
  amount: z
    .number({ invalid_type_error: 'Số tiền phải là số' })
    .positive('Số tiền phải lớn hơn 0'),
  categoryId: z.string().min(1, 'Vui lòng chọn danh mục'),
  note: z.string().max(255).optional(),
  transactionDate: z
    .string()
    .datetime({ message: 'Ngày giao dịch không hợp lệ' })
    .refine(
      (val) => new Date(val) <= new Date(),
      'Ngày giao dịch không được ở tương lai'
    )
    .optional()
})

export const updateTransactionSchema = createTransactionSchema.partial()

export const getTransactionsQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).optional(),
  type: z.enum(['INCOME', 'EXPENSE']).optional(),
  categoryId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
})