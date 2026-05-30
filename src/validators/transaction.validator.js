const { z } = require('zod')

const createTransactionSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE'], {
    message: 'Loại giao dịch phải là INCOME hoặc EXPENSE'
  }),
  amount: z
    .number({ message: 'Số tiền phải là số' })
    .positive('Số tiền phải lớn hơn 0'),
  categoryId: z
    .string({ message: 'Vui lòng chọn danh mục' })
    .min(1, 'Vui lòng chọn danh mục'),
  note: z.string().max(255, 'Ghi chú không được vượt quá 255 ký tự').optional(),
  transactionDate: z
    .string({ message: 'Ngày giao dịch không hợp lệ' })
    .datetime({ message: 'Ngày giao dịch không hợp lệ' })
    .refine(
      (val) => new Date(val) <= new Date(),
      'Ngày giao dịch không được ở tương lai'
    )
    .optional()
})

const updateTransactionSchema = createTransactionSchema.partial()

const getTransactionsQuerySchema = z.object({
  month: z.coerce
    .number({ message: 'Tháng không hợp lệ' })
    .int('Tháng phải là số nguyên')
    .min(1, 'Tháng phải từ 1 đến 12')
    .max(12, 'Tháng phải từ 1 đến 12')
    .optional(),
  year: z.coerce
    .number({ message: 'Năm không hợp lệ' })
    .int('Năm phải là số nguyên')
    .min(2000, 'Năm phải từ 2000 trở lên')
    .optional(),
  type: z.enum(['INCOME', 'EXPENSE'], {
    message: 'Loại giao dịch phải là INCOME hoặc EXPENSE'
  }).optional(),
  categoryId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce
    .number({ message: 'Trang không hợp lệ' })
    .int('Trang phải là số nguyên')
    .min(1, 'Trang phải lớn hơn hoặc bằng 1')
    .default(1),
  limit: z.coerce
    .number({ message: 'Giới hạn không hợp lệ' })
    .int('Giới hạn phải là số nguyên')
    .min(1, 'Giới hạn phải lớn hơn hoặc bằng 1')
    .max(100, 'Giới hạn tối đa là 100')
    .default(20)
})

module.exports = {
  createTransactionSchema,
  updateTransactionSchema,
  getTransactionsQuerySchema,
}
