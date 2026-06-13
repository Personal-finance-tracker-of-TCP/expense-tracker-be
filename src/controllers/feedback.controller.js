const { z } = require('zod')
const feedbackService = require('../services/feedback.service')
const { sendError } = require('../utils/response')

const optionalText = (maxLength, message) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') return undefined
      const trimmed = value.trim()
      return trimmed ? trimmed : undefined
    },
    z.string().max(maxLength, message).optional()
  )

const feedbackSchema = z.object({
  title: z
    .string({ message: 'title la bat buoc' })
    .trim()
    .min(3, 'title phai co it nhat 3 ky tu')
    .max(100, 'title toi da 100 ky tu'),
  message: z
    .string({ message: 'message la bat buoc' })
    .trim()
    .min(10, 'message phai co it nhat 10 ky tu')
    .max(500, 'message toi da 500 ky tu'),
  type: z.enum(['BUG', 'FEATURE', 'OTHER']).default('OTHER'),
  rating: z.coerce
    .number({ message: 'rating phai la so' })
    .int('rating phai la so nguyen')
    .min(1, 'rating toi thieu la 1')
    .max(5, 'rating toi da la 5')
    .optional(),
  senderName: optionalText(100, 'senderName toi da 100 ky tu'),
  senderEmail: optionalText(150, 'senderEmail toi da 150 ky tu'),
})

function getValidationMessage(error) {
  return error.issues?.[0]?.message || 'Du lieu feedback khong hop le'
}

async function createFeedback(req, res) {
  const parsed = feedbackSchema.safeParse(req.body)

  if (!parsed.success) {
    return sendError(res, getValidationMessage(parsed.error), 400)
  }

  try {
    const result = await feedbackService.createFeedback({
      ...parsed.data,
      userId: req.user.userId,
    })

    return res.status(201).json({
      success: true,
      message: result.message,
      data: {
        feedback: result.feedback,
        adminCount: result.adminCount,
        notificationCount: result.notificationCount,
      },
    })
  } catch (error) {
    console.error('createFeedback error:', error.message)
    return sendError(res, 'Loi khi gui phan hoi toi admin', 500)
  }
}

module.exports = {
  createFeedback,
}
