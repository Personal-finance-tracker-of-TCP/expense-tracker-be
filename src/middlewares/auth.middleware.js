import jwt from 'jsonwebtoken'
import { sendError } from '../utils/response.js'

export const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Không có token xác thực', 401)
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded // { id, email, role }
    next()
  } catch (err) {
    return sendError(res, 'Token không hợp lệ hoặc đã hết hạn', 401)
  }
}