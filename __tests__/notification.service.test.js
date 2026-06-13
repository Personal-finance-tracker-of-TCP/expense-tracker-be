jest.mock('../src/lib/prisma', () => ({
  notification: {
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
}))

const prisma = require('../src/lib/prisma')
const {
  markAllNotificationsRead,
  markNotificationRead,
} = require('../src/services/notification.service')

describe('notification service', () => {
  test('markNotificationRead only updates an owned notification', async () => {
    prisma.notification.findFirst.mockResolvedValue({
      id: 'notification-1',
      userId: 'user-1',
    })
    prisma.notification.update.mockResolvedValue({
      id: 'notification-1',
      isRead: true,
    })

    const result = await markNotificationRead('user-1', 'notification-1')

    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: { id: 'notification-1', userId: 'user-1' },
    })
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notification-1' },
      data: { isRead: true },
    })
    expect(result).toEqual({ id: 'notification-1', isRead: true })
  })

  test('markNotificationRead rejects a missing or unowned notification', async () => {
    prisma.notification.findFirst.mockResolvedValue(null)

    await expect(markNotificationRead('user-1', 'notification-2')).rejects.toMatchObject({
      statusCode: 404,
    })
    expect(prisma.notification.update).not.toHaveBeenCalled()
  })

  test('markAllNotificationsRead updates unread notifications for one user', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 3 })

    const result = await markAllNotificationsRead('user-1')

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isRead: false },
      data: { isRead: true },
    })
    expect(result.updatedCount).toBe(3)
  })
})
