const reportService = require('../services/report.service')
const { sendSuccess, sendError } = require('../utils/response')
const { reportQuerySchema, exportQuerySchema } = require('../validators/report.validator')
const ExcelJS = require('exceljs')
const PDFDocument = require('pdfkit')
const path = require('path')
const fs = require('fs')

const fontCandidates = [
  path.resolve(__dirname, '..', 'assets', 'fonts', 'NotoSans-Regular.ttf'),
  path.resolve(__dirname, '..', 'assets', 'fonts', 'Roboto-Regular.ttf'),
  'C:\\Windows\\Fonts\\arial.ttf',
  'C:\\Windows\\Fonts\\segoeui.ttf',
]

const getCategoryDisplay = (category) => ({
  name: category?.name || 'Chưa phân loại',
  icon: category?.icon || '📦',
})

function getValidationMessage(error) {
  return error.issues?.[0]?.message || 'Dữ liệu không hợp lệ'
}

function sanitizePdfText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[\uFE00-\uFE0F]/g, '')
    .trim()
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')} đ`
}

function isUsableFont(filePath) {
  try {
    const header = fs.readFileSync(filePath, { encoding: null, flag: 'r' }).subarray(0, 4)
    const signature = header.toString('latin1')
    return (
      header.equals(Buffer.from([0x00, 0x01, 0x00, 0x00])) ||
      signature === 'OTTO' ||
      signature === 'true' ||
      signature === 'typ1'
    )
  } catch {
    return false
  }
}

function getPdfFontPath() {
  return fontCandidates.find(isUsableFont)
}

const getSummary = async (req, res) => {
  try {
    const parsed = reportQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return sendError(res, getValidationMessage(parsed.error), 400)
    }

    const summary = await reportService.getSummary(req.user.userId, parsed.data)
    return sendSuccess(res, summary)
  } catch (err) {
    console.error('getSummary error:', err)
    return sendError(res, 'Lỗi khi lấy tổng hợp báo cáo', 500)
  }
}

const getChartData = async (req, res) => {
  try {
    const parsed = reportQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return sendError(res, getValidationMessage(parsed.error), 400)
    }

    const data = await reportService.getChartData(req.user.userId, parsed.data)
    return sendSuccess(res, data)
  } catch (err) {
    console.error('getChartData error:', err)
    return sendError(res, 'Lỗi khi lấy dữ liệu biểu đồ', 500)
  }
}

const exportReport = async (req, res) => {
  try {
    const parsed = exportQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return sendError(res, getValidationMessage(parsed.error), 400)
    }

    const { format } = parsed.data
    const { transactions, summary } = await reportService.getExportData(
      req.user.userId,
      parsed.data
    )

    if (transactions.length === 0) {
      return sendError(res, 'Không có giao dịch trong kỳ này', 404)
    }

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook()

      const sheet1 = workbook.addWorksheet('Giao dịch')
      sheet1.columns = [
        { header: 'Ngày', key: 'date', width: 20 },
        { header: 'Loại', key: 'type', width: 10 },
        { header: 'Danh mục', key: 'category', width: 20 },
        { header: 'Số tiền', key: 'amount', width: 15 },
        { header: 'Ghi chú', key: 'note', width: 30 },
        { header: 'Nguồn', key: 'source', width: 10 },
      ]

      transactions.forEach((transaction) => {
        const category = getCategoryDisplay(transaction.category)
        sheet1.addRow({
          date: new Date(transaction.transactionDate).toLocaleDateString('vi-VN'),
          type: transaction.type === 'INCOME' ? 'Thu' : 'Chi',
          category: `${category.icon} ${category.name}`,
          amount: Number(transaction.amount),
          note: transaction.note || '',
          source: transaction.source,
        })
      })

      const sheet2 = workbook.addWorksheet('Tóm tắt')
      sheet2.addRows([
        ['Tổng thu', summary.totalIncome],
        ['Tổng chi', summary.totalExpense],
        ['Tiết kiệm', summary.savings],
        ['Tỷ lệ tiết kiệm', `${summary.savingsRate}%`],
      ])

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', 'attachment; filename=moneytrack-report.xlsx')
      await workbook.xlsx.write(res)
      return res.end()
    }

    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 40 })
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'attachment; filename=moneytrack-report.pdf')
      doc.pipe(res)

      const fontPath = getPdfFontPath()
      if (fontPath) {
        doc.registerFont('Unicode', fontPath)
        doc.font('Unicode')
      }

      doc.fontSize(18).text('MoneyTrack - Báo cáo tài chính', { align: 'center' })
      doc.moveDown()

      doc.fontSize(13).text('Tóm tắt')
      doc.fontSize(11)
        .text(`Tổng thu: ${formatMoney(summary.totalIncome)}`)
        .text(`Tổng chi: ${formatMoney(summary.totalExpense)}`)
        .text(`Tiết kiệm: ${formatMoney(summary.savings)}`)
        .text(`Tỷ lệ tiết kiệm: ${summary.savingsRate}%`)
      doc.moveDown()

      doc.fontSize(13).text('Chi tiết giao dịch')
      doc.moveDown(0.5)

      transactions.forEach((transaction) => {
        const category = getCategoryDisplay(transaction.category)
        const line = [
          new Date(transaction.transactionDate).toLocaleDateString('vi-VN'),
          transaction.type === 'INCOME' ? 'Thu' : 'Chi',
          sanitizePdfText(category.name),
          formatMoney(transaction.amount),
          sanitizePdfText(transaction.note),
        ].filter(Boolean).join(' | ')

        doc.fontSize(10).text(line, { width: 515 })
      })

      doc.end()
      return
    }

    return sendError(res, 'Định dạng xuất báo cáo không hợp lệ', 400)
  } catch (err) {
    console.error('exportReport error:', err)
    return sendError(res, 'Lỗi khi xuất báo cáo', 500)
  }
}

module.exports = {
  getSummary,
  getChartData,
  exportReport,
}
