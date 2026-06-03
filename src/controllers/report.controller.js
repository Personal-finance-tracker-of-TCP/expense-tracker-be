const reportService = require('../services/report.service')
const { sendSuccess, sendError } = require('../utils/response')
const { reportQuerySchema, exportQuerySchema } = require('../validators/report.validator')
const ExcelJS = require('exceljs')
const PDFDocument = require('pdfkit')

const getCategoryDisplay = (category) => ({
  name: category?.name || 'Ch\u01b0a ph\u00e2n lo\u1ea1i',
  icon: category?.icon || '\uD83D\uDCE6',
})

function getValidationMessage(error) {
  return error.issues?.[0]?.message || 'Du lieu khong hop le'
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

      // Sheet 1: Giao dịch
      const sheet1 = workbook.addWorksheet('Giao dịch')
      sheet1.columns = [
        { header: 'Ngày',       key: 'date',     width: 20 },
        { header: 'Loại',       key: 'type',     width: 10 },
        { header: 'Danh mục',   key: 'category', width: 20 },
        { header: 'Số tiền',    key: 'amount',   width: 15 },
        { header: 'Ghi chú',    key: 'note',     width: 30 },
        { header: 'Nguồn',      key: 'source',   width: 10 },
      ]
      transactions.forEach(t => {
        const category = getCategoryDisplay(t.category)
        sheet1.addRow({
          date:     new Date(t.transactionDate).toLocaleDateString('vi-VN'),
          type:     t.type === 'INCOME' ? 'Thu' : 'Chi',
          category: `${category.icon} ${category.name}`,
          amount:   Number(t.amount),
          note:     t.note || '',
          source:   t.source
        })
      })

      // Sheet 2: Tóm tắt
      const sheet2 = workbook.addWorksheet('Tóm tắt')
      sheet2.addRows([
        ['Tổng thu',     summary.totalIncome],
        ['Tổng chi',     summary.totalExpense],
        ['Tiết kiệm',    summary.savings],
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

      // Tiêu đề
      doc.fontSize(18).text('MoneyTrack – Báo cáo tài chính', { align: 'center' })
      doc.moveDown()

      // Tóm tắt
      doc.fontSize(13).text('Tóm tắt')
      doc.fontSize(11)
        .text(`Tổng thu:  ${summary.totalIncome.toLocaleString('vi-VN')} đ`)
        .text(`Tổng chi:  ${summary.totalExpense.toLocaleString('vi-VN')} đ`)
        .text(`Tiết kiệm: ${summary.savings.toLocaleString('vi-VN')} đ`)
        .text(`Tỷ lệ tiết kiệm: ${summary.savingsRate}%`)
      doc.moveDown()

      // Bảng giao dịch
      doc.fontSize(13).text('Chi tiết giao dịch')
      doc.moveDown(0.5)
      transactions.forEach(t => {
        const category = getCategoryDisplay(t.category)
        doc.fontSize(10).text(
          `${new Date(t.transactionDate).toLocaleDateString('vi-VN')} | ` +
          `${t.type === 'INCOME' ? 'Thu' : 'Chi'} | ` +
          `${category.icon} ${category.name} | ` +
          `${Number(t.amount).toLocaleString('vi-VN')} đ` +
          `${t.note ? ` | ${t.note}` : ''}`
        )
      })

      doc.end()
      return
    }
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
