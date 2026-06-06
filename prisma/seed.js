const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = "12345678";

const defaultCategories = [
  { name: "Ăn uống", icon: "🍜", color: "#f97316", type: "EXPENSE", isDefault: true },
  { name: "Di chuyển", icon: "🚗", color: "#3b82f6", type: "EXPENSE", isDefault: true },
  { name: "Mua sắm", icon: "🛍️", color: "#ec4899", type: "EXPENSE", isDefault: true },
  { name: "Hóa đơn", icon: "💡", color: "#eab308", type: "EXPENSE", isDefault: true },
  { name: "Sức khỏe", icon: "🏥", color: "#ef4444", type: "EXPENSE", isDefault: true },
  { name: "Giải trí", icon: "🎬", color: "#8b5cf6", type: "EXPENSE", isDefault: true },
  { name: "Giáo dục", icon: "📚", color: "#06b6d4", type: "EXPENSE", isDefault: true },

  { name: "Lương", icon: "💰", color: "#22c55e", type: "INCOME", isDefault: true },
  { name: "Thưởng", icon: "🎁", color: "#84cc16", type: "INCOME", isDefault: true },
  { name: "Đầu tư", icon: "📈", color: "#14b8a6", type: "INCOME", isDefault: true },

  { name: "Khác", icon: "📦", color: "#64748b", type: "BOTH", isDefault: true },
];

async function seedDefaultCategories() {
  for (const cat of defaultCategories) {
    const existed = await prisma.category.findFirst({
      where: {
        userId: null,
        name: cat.name,
        type: cat.type,
        isDefault: true,
      },
    });

    if (existed) {
      await prisma.category.update({
        where: { id: existed.id },
        data: {
          icon: cat.icon,
          color: cat.color,
          isDefault: true,
        },
      });
    } else {
      await prisma.category.create({
        data: {
          ...cat,
          userId: null,
        },
      });
    }
  }

  console.log("Seeded default categories ✓");
}

async function seedUsers() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@moneytrack.local" },
    update: {
      name: "Admin MoneyTrack",
      passwordHash,
      role: "ADMIN",
      balance: 0,
      sepayCode: "MTA001",
      bankAccountNumber: "970400000000",
      provider: "local",
    },
    create: {
      name: "Admin MoneyTrack",
      email: "admin@moneytrack.local",
      passwordHash,
      role: "ADMIN",
      balance: 0,
      sepayCode: "MTA001",
      bankAccountNumber: "970400000000",
      provider: "local",
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "user@moneytrack.local" },
    update: {
      name: "User Demo",
      passwordHash,
      role: "USER",

      // 8,000,000 income - 100,000 expense - 750,000 SePay expense
      balance: 7150000,

      sepayCode: "MTU001",
      bankAccountNumber: "970400000001",
      provider: "local",
    },
    create: {
      name: "User Demo",
      email: "user@moneytrack.local",
      passwordHash,
      role: "USER",

      // 8,000,000 income - 100,000 expense - 750,000 SePay expense
      balance: 7150000,

      sepayCode: "MTU001",
      bankAccountNumber: "970400000001",
      provider: "local",
    },
  });

  console.log("Seeded users ✓");
  return { admin, user };
}

async function getRequiredCategory(name, type) {
  const category = await prisma.category.findFirst({
    where: {
      userId: null,
      name,
      type,
      isDefault: true,
    },
  });

  if (!category) {
    throw new Error(`Missing required category: ${name} - ${type}`);
  }

  return category;
}

async function seedDemoBudget(user, foodCategory) {
  await prisma.budget.upsert({
    where: {
      userId_categoryId_period_month_year: {
        userId: user.id,
        categoryId: foodCategory.id,
        period: "MONTHLY",
        month: 6,
        year: 2026,
      },
    },
    update: {
      limitAmount: 1000000,
    },
    create: {
      userId: user.id,
      categoryId: foodCategory.id,
      limitAmount: 1000000,
      period: "MONTHLY",
      month: 6,
      year: 2026,
    },
  });

  console.log("Seeded demo budget ✓");
}

async function seedManualTransactions(user, foodCategory, salaryCategory) {
  const existedIncome = await prisma.transaction.findFirst({
    where: {
      userId: user.id,
      note: "Lương tháng 6",
      source: "MANUAL",
    },
  });

  if (!existedIncome) {
    await prisma.transaction.create({
      data: {
        userId: user.id,
        categoryId: salaryCategory.id,
        type: "INCOME",
        amount: 8000000,
        note: "Lương tháng 6",
        transactionDate: new Date("2026-06-01T09:00:00.000Z"),
        source: "MANUAL",
      },
    });
  }

  const existedExpense = await prisma.transaction.findFirst({
    where: {
      userId: user.id,
      note: "Ăn trưa demo",
      source: "MANUAL",
    },
  });

  if (!existedExpense) {
    await prisma.transaction.create({
      data: {
        userId: user.id,
        categoryId: foodCategory.id,
        type: "EXPENSE",
        amount: 100000,
        note: "Ăn trưa demo",
        transactionDate: new Date("2026-06-03T10:00:00.000Z"),
        source: "MANUAL",
      },
    });
  }

  console.log("Seeded manual transactions ✓");
}

async function seedSepayDemoTransaction(user) {
  const sepayId = "SEPAY-DEMO-001";

  let sepayTransaction = await prisma.transaction.findUnique({
    where: { sepayId },
  });

  if (!sepayTransaction) {
    sepayTransaction = await prisma.transaction.create({
      data: {
        userId: user.id,

        // null để demo luồng SePay mới về nhưng chưa phân loại
        categoryId: null,

        type: "EXPENSE",
        amount: 750000,
        note: "SEPAY DEMO MTU001 - giao dịch lớn chờ phân loại",
        transactionDate: new Date("2026-06-05T14:30:00.000Z"),
        source: "SEPAY",
        sepayId,
      },
    });
  }

  await prisma.sepayLog.upsert({
    where: { sepayId },
    update: {
      gateway: "SEPAY",
      transferAmount: 750000,
      transferType: "OUT",
      content: "SEPAY DEMO MTU001 - giao dịch lớn chờ phân loại",
      transactionDate: new Date("2026-06-05T14:30:00.000Z"),
      matchedCode: "MTU001",
      status: "PROCESSED",
      processed: true,
      transactionId: sepayTransaction.id,
      rawPayload: {
        sepayId,
        gateway: "SEPAY",
        amount: 750000,
        transferType: "OUT",
        content: "SEPAY DEMO MTU001 - giao dịch lớn chờ phân loại",
      },
    },
    create: {
      sepayId,
      gateway: "SEPAY",
      transferAmount: 750000,
      transferType: "OUT",
      content: "SEPAY DEMO MTU001 - giao dịch lớn chờ phân loại",
      transactionDate: new Date("2026-06-05T14:30:00.000Z"),
      matchedCode: "MTU001",
      status: "PROCESSED",
      processed: true,
      transactionId: sepayTransaction.id,
      rawPayload: {
        sepayId,
        gateway: "SEPAY",
        amount: 750000,
        transferType: "OUT",
        content: "SEPAY DEMO MTU001 - giao dịch lớn chờ phân loại",
      },
    },
  });

  console.log("Seeded SePay demo transaction and log ✓");
}

async function seedAiAdviceLog(user) {
  const existed = await prisma.aiAdviceLog.findFirst({
    where: {
      userId: user.id,
      period: "MONTH_2026_06",
    },
  });

  if (!existed) {
    await prisma.aiAdviceLog.create({
      data: {
        userId: user.id,
        period: "MONTH_2026_06",
        inputHash: "demo-month-2026-06",
        inputSummary: {
          totalIncome: 8000000,
          totalExpense: 850000,
          saving: 7150000,
          topExpenseCategories: [
            { name: "Ăn uống", amount: 100000 },
            { name: "Chưa phân loại", amount: 750000 },
          ],
        },
        result: {
          summary: "Bạn đang tiết kiệm tốt trong tháng 6.",
          suggestions: [
            "Phân loại giao dịch SePay 750.000đ để báo cáo chính xác hơn.",
            "Tiếp tục giữ chi tiêu ăn uống dưới 1.000.000đ.",
          ],
        },
        provider: "RULE_BASED",
      },
    });
  }

  console.log("Seeded AI advice log ✓");
}

async function seedReportExportLog(user) {
  const existed = await prisma.reportExportLog.findFirst({
    where: {
      userId: user.id,
      format: "PDF",
      month: 6,
      year: 2026,
    },
  });

  if (!existed) {
    await prisma.reportExportLog.create({
      data: {
        userId: user.id,
        format: "PDF",
        month: 6,
        year: 2026,
        fileName: "moneytrack-report-2026-06.pdf",
      },
    });
  }

  console.log("Seeded report export log ✓");
}

async function main() {
  await seedDefaultCategories();

  const { user } = await seedUsers();

  const foodCategory = await getRequiredCategory("Ăn uống", "EXPENSE");
  const salaryCategory = await getRequiredCategory("Lương", "INCOME");

  await seedDemoBudget(user, foodCategory);
  await seedManualTransactions(user, foodCategory, salaryCategory);
  await seedSepayDemoTransaction(user);
  await seedAiAdviceLog(user);
  await seedReportExportLog(user);

  console.log("Seed completed ✓");
  console.log("");
  console.log("Demo accounts:");
  console.log(`Admin: admin@moneytrack.local / ${DEFAULT_PASSWORD}`);
  console.log(`User : user@moneytrack.local / ${DEFAULT_PASSWORD}`);
  console.log(`User SePay Code: MTU001`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });