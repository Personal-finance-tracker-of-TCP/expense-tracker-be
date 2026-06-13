const fs = require('fs');
const file = 'src/controllers/report.controller.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Add path require
content = content.replace(
  "const PDFDocument = require('pdfkit')",
  "const PDFDocument = require('pdfkit')\nconst path = require('path')"
);

// 2. Add budgets to destructuring
content = content.replace(
  "const { transactions, summary } = await reportService.getExportData(req.user.userId, parsed.data)",
  "const { transactions, summary, budgets } = await reportService.getExportData(req.user.userId, parsed.data)"
);

// 3. Add Ngân sách sheet
const sheet2Str = `      // Sheet 2: Tóm tắt
      const sheet2 = workbook.addWorksheet('Tóm tắt')
      sheet2.addRows([
        ['Tổng thu',     summary.totalIncome],
        ['Tổng chi',     summary.totalExpense],
        ['Tiết kiệm',    summary.savings],
        ['Tỷ lệ tiết kiệm', \`\${summary.savingsRate}%\`],
      ])`;

const sheet3Str = `      // Sheet 2: Tóm tắt
      const sheet2 = workbook.addWorksheet('Tóm tắt')
      sheet2.addRows([
        ['Tổng thu',     summary.totalIncome],
        ['Tổng chi',     summary.totalExpense],
        ['Tiết kiệm',    summary.savings],
        ['Tỷ lệ tiết kiệm', \`\${summary.savingsRate}%\`],
      ])

      // Sheet 3: Ngân sách
      const sheet3 = workbook.addWorksheet('Ngân sách')
      sheet3.columns = [
        { header: 'Danh mục',   key: 'category', width: 20 },
        { header: 'Hạn mức',    key: 'limit',    width: 15 },
        { header: 'Đã tiêu',    key: 'spent',    width: 15 },
        { header: 'Còn lại',    key: 'remain',   width: 15 },
        { header: '% Đã dùng',  key: 'percent',  width: 15 },
      ]
      if (budgets && budgets.length > 0) {
        budgets.forEach(b => {
          const category = getCategoryDisplay(b.category)
          sheet3.addRow({
            category: \`\${category.icon} \${category.name}\`,
            limit:    Number(b.limitAmount),
            spent:    Number(b.spentAmount),
            remain:   Number(b.remainingAmount),
            percent:  \`\${Number(b.percentUsed).toFixed(1)}%\`
          })
        })
      }`;
content = content.replace(sheet2Str, sheet3Str);

// 4. Update PDF to use font
const pdfStr = `    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 40 })
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'attachment; filename=Fintrack-report.pdf')
      doc.pipe(res)`;

const newPdfStr = `    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 40 })
      const fontPath = path.join(__dirname, '../assets/fonts/Roboto-Regular.ttf')
      try {
        doc.font(fontPath)
      } catch (e) {
        console.warn('Could not load custom font, falling back to default')
      }
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'attachment; filename=Fintrack-report.pdf')
      doc.pipe(res)`;
content = content.replace(pdfStr, newPdfStr);

fs.writeFileSync(file, content);
console.log('Update successful');
