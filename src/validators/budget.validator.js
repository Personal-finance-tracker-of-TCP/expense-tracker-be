const { z } = require('zod')

const periodSchema = z.enum(['MONTHLY', 'TOTAL'], {
  message: 'Period phai la MONTHLY hoac TOTAL'
})

const baseBudgetSchema = z.object({
  categoryId: z
    .string({ message: 'Vui long chon danh muc' })
    .trim()
    .min(1, 'Vui long chon danh muc'),
  limitAmount: z.coerce
    .number({ message: 'Han muc phai la so' })
    .positive('Han muc phai lon hon 0'),
  period: periodSchema,
  month: z.coerce
    .number({ message: 'Thang khong hop le' })
    .int('Thang phai la so nguyen')
    .min(1, 'Thang phai tu 1 den 12')
    .max(12, 'Thang phai tu 1 den 12')
    .nullable()
    .optional(),
  year: z.coerce
    .number({ message: 'Nam khong hop le' })
    .int('Nam phai la so nguyen')
    .min(2000, 'Nam phai tu 2000 tro len')
})

const budgetPeriodRules = (data, ctx) => {
  if (data.period === 'MONTHLY' && (data.month === undefined || data.month === null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['month'],
      message: 'MONTHLY yeu cau month tu 1 den 12'
    })
  }
}

const createBudgetSchema = baseBudgetSchema.superRefine(budgetPeriodRules)

const updateBudgetSchema = baseBudgetSchema.partial()

module.exports = {
  createBudgetSchema,
  updateBudgetSchema,
}
