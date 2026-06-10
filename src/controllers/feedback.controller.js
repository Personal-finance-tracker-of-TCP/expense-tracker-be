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
    .string({ message: 'title là bắt buộc' })
    .trim()
    .min(3, 'title phải có ít nhất 3 ký tự')
    .max(100, 'title tối đa 100 ký tự'),
  message: z
    .string({ message: 'message là bắt buộc' })
    .trim()
    .min(10, 'message phải có ít nhất 10 ký tự')
    .max(500, 'message tối đa 500 ký tự'),
  rating: z.coerce
    .number({ message: 'rating phải là số' })
    .int('rating phải là số nguyên')
    .min(1, 'rating tối thiểu là 1')
    .max(5, 'rating tối đa là 5'),
  senderName: optionalText(100, 'senderName tối đa 100 ký tự'),
  senderEmail: optionalText(150, 'senderEmail tối đa 150 ký tự'),
})

function getValidationMessage(error) {
  return error.issues?.[0]?.message || 'Dữ liệu feedback không hợp lệ'
}

async function createFeedback(req, res) {
  const parsed = feedbackSchema.safeParse(req.body)

  if (!parsed.success) {
    return sendError(res, getValidationMessage(parsed.error), 400)
  }

  try {
    const result = await feedbackService.sendFeedbackToAdmins(parsed.data)

    return res.status(200).json({
      success: true,
      message: result.message,
      data: {
        adminCount: result.adminCount,
        notificationCount: result.notificationCount,
      },
    })
  } catch (error) {
    console.error('createFeedback error:', error.message)
    return sendError(res, 'Lỗi khi gửi feedback tới admin', 500)
  }
}

module.exports = {
  createFeedback,
}
