jest.mock('../src/lib/prisma', () => ({
  user: {
    findUnique: jest.fn(),
  },
  transaction: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
}))

const prisma = require('../src/lib/prisma')
const { CLASSIFICATION, excludeTransaction } = require('../src/services/transaction.service')

describe('transaction service exclusion', () => {
  test('excludeTransaction marks a SEPAY transaction as excluded', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'USER' })
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-sepay',
      userId: 'user-1',
      source: 'SEPAY',
    })
    prisma.transaction.update.mockResolvedValue({
      id: 'tx-sepay',
      classificationStatus: CLASSIFICATION.EXCLUDED,
    })

    const result = await excludeTransaction('user-1', 'tx-sepay')

    expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
      where: { id: 'tx-sepay', userId: 'user-1' },
    })
    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx-sepay' },
      data: { classificationStatus: CLASSIFICATION.EXCLUDED },
      include: { category: { select: { id: true, name: true, icon: true } } },
    })
    expect(result).toEqual({
      id: 'tx-sepay',
      classificationStatus: CLASSIFICATION.EXCLUDED,
    })
  })

  test('excludeTransaction rejects a MANUAL transaction', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'USER' })
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-manual',
      userId: 'user-1',
      source: 'MANUAL',
    })

    await expect(excludeTransaction('user-1', 'tx-manual')).rejects.toMatchObject({
      statusCode: 400,
    })
    expect(prisma.transaction.update).not.toHaveBeenCalled()
  })

  test('excludeTransaction returns null when the user does not own the transaction', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'USER' })
    prisma.transaction.findFirst.mockResolvedValue(null)

    await expect(excludeTransaction('user-1', 'tx-other')).resolves.toBeNull()
    expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
      where: { id: 'tx-other', userId: 'user-1' },
    })
    expect(prisma.transaction.update).not.toHaveBeenCalled()
  })
})
