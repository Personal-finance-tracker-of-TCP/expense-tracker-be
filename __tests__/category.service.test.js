jest.mock('../src/lib/prisma', () => ({
  category: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  transaction: {
    count: jest.fn(),
  },
}))

const prisma = require('../src/lib/prisma')
const {
  getCategories,
  updateCategory,
  deleteCategory,
} = require('../src/services/category.service')

describe('category service ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('getCategories returns personal categories before default categories', async () => {
    const personalCategories = [{ id: 'personal-food', userId: 'user-1', name: 'Ăn uống' }]
    const defaultCategories = [{ id: 'default-food', userId: null, name: 'Ăn uống' }]

    prisma.category.findMany
      .mockResolvedValueOnce(personalCategories)
      .mockResolvedValueOnce(defaultCategories)

    await expect(getCategories('user-1')).resolves.toEqual([
      ...personalCategories,
      ...defaultCategories,
    ])
    expect(prisma.category.findMany).toHaveBeenNthCalledWith(1, {
      where: { userId: 'user-1' },
      orderBy: { name: 'asc' },
    })
    expect(prisma.category.findMany).toHaveBeenNthCalledWith(2, {
      where: { userId: null },
      orderBy: { name: 'asc' },
    })
  })

  test('updateCategory returns null when category is not owned by user', async () => {
    prisma.category.findFirst.mockResolvedValue(null)

    await expect(
      updateCategory('user-1', 'default-category', { name: 'Tên mới' })
    ).resolves.toBeNull()
    expect(prisma.category.findFirst).toHaveBeenCalledWith({
      where: { id: 'default-category', userId: 'user-1' },
    })
    expect(prisma.category.update).not.toHaveBeenCalled()
  })

  test('deleteCategory rejects category that is not owned by user', async () => {
    prisma.category.findFirst.mockResolvedValue(null)

    await expect(deleteCategory('user-1', 'default-category')).resolves.toEqual({
      error: 'NOT_FOUND',
    })
    expect(prisma.category.findFirst).toHaveBeenCalledWith({
      where: { id: 'default-category', userId: 'user-1' },
    })
    expect(prisma.transaction.count).not.toHaveBeenCalled()
    expect(prisma.category.delete).not.toHaveBeenCalled()
  })
})
