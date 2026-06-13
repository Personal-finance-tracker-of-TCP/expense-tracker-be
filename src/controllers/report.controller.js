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
  icon: category?.icon || '',
})

function getValidationMessage(error) {
  return error.issues?.[0]?.message || 'Dữ liệu không hợp lệ'
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

function registerPdfFont(doc) {
  const fontPath = fontCandidates.find(isUsableFont)

  if (!fontPath) {
    return 'Helvetica'
  }

  doc.registerFont('ReportRegular', fontPath)
  return 'ReportRegular'
}

function sanitizePdfText(value, fallback = '-') {
  if (value === null || value === undefined) {
    return fallback
  }

  const text = String(value)
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[\uFE00-\uFE0F]/g, '')
    .trim()

  return text || fallback
}

function formatDate(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()

  return `${day}/${month}/${year}`
}

function formatMoney(value) {
  const amount = Number(value)

  if (!Number.isFinite(amount)) {
    return '-'
  }

  return `${amount.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ₫`
}

function formatPercent(value) {
  const rate = Number(value)

  return Number.isFinite(rate) ? `${rate}%` : '-'
}

function truncateToWidth(doc, value, width) {
  const text = sanitizePdfText(value)

  if (text === '-' || doc.widthOfString(text) <= width) {
    return text
  }

  const ellipsis = '...'
  let low = 0
  let high = text.length

  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    const candidate = `${text.slice(0, mid).trimEnd()}${ellipsis}`

    if (doc.widthOfString(candidate) <= width) {
      low = mid
    } else {
      high = mid - 1
    }
  }

  return `${text.slice(0, low).trimEnd()}${ellipsis}`
}

function drawSummary(doc, summary, fontName) {
  const left = doc.page.margins.left
  const valueX = 360
  const valueWidth = doc.page.width - doc.page.margins.right - valueX
  const rows = [
    ['Tổng thu', formatMoney(summary?.totalIncome)],
    ['Tổng chi', formatMoney(summary?.totalExpense)],
    ['Tiết kiệm', formatMoney(summary?.savings)],
    ['Tỉ lệ tiết kiệm', formatPercent(summary?.savingsRate)],
  ]

  doc.font(fontName).fontSize(13).fillColor('#0f172a').text('Tổng quan tài chính')
  doc.moveDown(0.4)

  rows.forEach(([label, value]) => {
    const y = doc.y

    doc.font(fontName).fontSize(10).fillColor('#475569').text(label, left, y, {
      width: 160,
    })
    doc.font(fontName).fontSize(10).fillColor('#0f172a').text(value, valueX, y, {
      width: valueWidth,
      align: 'right',
    })
    doc.y = y + 18
  })

  doc.moveDown(0.7)
}

const transactionColumns = [
  { key: 'date', label: 'Ngày', width: 68, align: 'left' },
  { key: 'type', label: 'Loại', width: 45, align: 'left' },
  { key: 'category', label: 'Danh mục', width: 105, align: 'left' },
  { key: 'amount', label: 'Số tiền', width: 90, align: 'right' },
  { key: 'description', label: 'Mô tả', width: 197, align: 'left' },
]

function getColumnXPositions(doc) {
  let currentX = doc.page.margins.left

  return transactionColumns.map((column) => {
    const x = currentX
    currentX += column.width
    return { ...column, x }
  })
}

function drawTransactionHeader(doc, y, fontName) {
  const columns = getColumnXPositions(doc)
  const tableWidth = transactionColumns.reduce((sum, column) => sum + column.width, 0)
  const rowHeight = 24
  const paddingX = 5

  doc.save()
  doc.rect(doc.page.margins.left, y, tableWidth, rowHeight).fill('#ecfeff')
  doc.restore()

  doc.save()
  doc.strokeColor('#0f766e').lineWidth(0.8)
  doc.rect(doc.page.margins.left, y, tableWidth, rowHeight).stroke()
  doc.restore()

  columns.forEach((column) => {
    doc.font(fontName).fontSize(9).fillColor('#0f172a').text(column.label, column.x + paddingX, y + 7, {
      width: column.width - paddingX * 2,
      align: column.align,
      lineBreak: false,
    })
  })

  return y + rowHeight
}

function drawTransactionRow(doc, transaction, y, fontName, rowIndex) {
  const columns = getColumnXPositions(doc)
  const tableWidth = transactionColumns.reduce((sum, column) => sum + column.width, 0)
  const rowHeight = 26
  const paddingX = 5
  const category = getCategoryDisplay(transaction.category)
  const description = transaction.note || transaction.description || '-'
  const values = {
    date: formatDate(transaction.transactionDate),
    type: transaction.type === 'INCOME' ? 'Thu' : 'Chi',
    category: sanitizePdfText(category.name),
    amount: formatMoney(transaction.amount),
    description: sanitizePdfText(description),
  }

  doc.save()
  doc.rect(doc.page.margins.left, y, tableWidth, rowHeight).fill(rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc')
  doc.restore()

  doc.save()
  doc.strokeColor('#e2e8f0').lineWidth(0.5)
  doc.rect(doc.page.margins.left, y, tableWidth, rowHeight).stroke()
  doc.restore()

  columns.forEach((column) => {
    const textWidth = column.width - paddingX * 2
    const text = truncateToWidth(doc, values[column.key], textWidth)

    doc.font(fontName).fontSize(8.6).fillColor('#0f172a').text(text, column.x + paddingX, y + 8, {
      width: textWidth,
      align: column.align,
      lineBreak: false,
    })
  })

  return y + rowHeight
}

function drawTransactionTable(doc, transactions, fontName) {
  const bottom = doc.page.height - doc.page.margins.bottom
  const rowHeight = 26

  doc.font(fontName).fontSize(13).fillColor('#0f172a').text('Chi tiết giao dịch')
  doc.moveDown(0.5)

  let y = drawTransactionHeader(doc, doc.y, fontName)

  transactions.forEach((transaction, index) => {
    if (y + rowHeight > bottom) {
      doc.addPage()
      y = drawTransactionHeader(doc, doc.page.margins.top, fontName)
    }

    y = drawTransactionRow(doc, transaction, y, fontName, index)
  })

  doc.y = y + 10
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
    const { transactions, summary } = await reportService.getExportData(req.user.userId, parsed.data)

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
          date: formatDate(transaction.transactionDate),
          type: transaction.type === 'INCOME' ? 'Thu' : 'Chi',
          category: [category.icon, category.name].filter(Boolean).join(' '),
          amount: Number(transaction.amount),
          note: sanitizePdfText(transaction.note, ''),
          source: transaction.source || '-',
        })
      })

      const sheet2 = workbook.addWorksheet('Tóm tắt')
      sheet2.addRows([
        ['Tổng thu', summary.totalIncome],
        ['Tổng chi', summary.totalExpense],
        ['Tiết kiệm', summary.savings],
        ['Tỉ lệ tiết kiệm', formatPercent(summary.savingsRate)],
      ])

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', 'attachment; filename=fintrack-report.xlsx')
      await workbook.xlsx.write(res)
      return res.end()
    }

    if (format === 'pdf') {
      const doc = new PDFDocument({ size: 'A4', margin: 45 })
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'attachment; filename=fintrack-report.pdf')
      doc.pipe(res)

      const fontName = registerPdfFont(doc)
      doc.font(fontName)

      doc.fontSize(18).fillColor('#0f172a').text('FinTrack - Báo cáo tài chính', { align: 'center' })
      doc.moveDown()

      drawSummary(doc, summary, fontName)
      drawTransactionTable(doc, transactions, fontName)

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
