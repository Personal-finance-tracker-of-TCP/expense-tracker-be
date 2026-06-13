jest.mock('../src/lib/prisma', () => ({
  transaction: {
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  category: {
    findMany: jest.fn(),
  },
  budget: {
    findMany: jest.fn(),
  },
}))

const { getDateRange } = require('../src/services/report.service')

describe('report service date ranges', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  test('getDateRange returns month boundaries for month/year query', () => {
    const range = getDateRange({ month: 6, year: 2026 })

    expect(range).toEqual({
      gte: new Date(2026, 5, 1),
      lt: new Date(2026, 6, 1),
    })
  })

  test('getDateRange defaults to the current month', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 13, 10, 30, 0))

    const range = getDateRange()

    expect(range).toEqual({
      gte: new Date(2026, 5, 1),
      lt: new Date(2026, 6, 1),
    })
  })
})
