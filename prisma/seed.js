const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const defaultCategories = [
  { name: 'Ăn uống',    icon: '🍜', type: 'EXPENSE', isDefault: true },
  { name: 'Di chuyển',  icon: '🚗', type: 'EXPENSE', isDefault: true },
  { name: 'Mua sắm',    icon: '🛍️', type: 'EXPENSE', isDefault: true },
  { name: 'Hóa đơn',    icon: '💡', type: 'EXPENSE', isDefault: true },
  { name: 'Sức khỏe',   icon: '🏥', type: 'EXPENSE', isDefault: true },
  { name: 'Giải trí',   icon: '🎬', type: 'EXPENSE', isDefault: true },
  { name: 'Giáo dục',   icon: '📚', type: 'EXPENSE', isDefault: true },
  { name: 'Lương',      icon: '💰', type: 'INCOME',  isDefault: true },
  { name: 'Thưởng',     icon: '🎁', type: 'INCOME',  isDefault: true },
  { name: 'Đầu tư',     icon: '📈', type: 'INCOME',  isDefault: true },
  { name: 'Khác',       icon: '📦', type: 'BOTH',    isDefault: true },
]

async function main() {
  for (const cat of defaultCategories) {
    await prisma.category.upsert({
      where: { name_isDefault: { name: cat.name, isDefault: true } },
      update: {},
      create: cat
    })
  }
  console.log('Seeded default categories ✓')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
