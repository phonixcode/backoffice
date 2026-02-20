const puppeteer = require("puppeteer");
const handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");
const Payroll = require("../payroll/payroll.model");
const Leave = require("../leave/leave.model");
const AuditLog = require("../audit/auditLog.model");

function loadTemplate(name) {
  const filePath = path.join(__dirname, "templates", `${name}.hbs`);
  const source = fs.readFileSync(filePath, "utf8");
  return handlebars.compile(source);
}

async function generatePDF(html) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);
    await page.setContent(html, { waitUntil: "load", timeout: 60000 });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20px",
        right: "20px",
        bottom: "20px",
        left: "20px",
      },
      timeout: 60000,
    });

    return pdf;
  } finally {
    await browser.close().catch(() => {});
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatDate(date) {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function dateStamp() {
  return new Date().toISOString().split("T")[0];
}

function buildPayslipData(payroll) {
  const totalDeductions = (payroll.deductions || [])
    .reduce((s, d) => s + d.amount, 0);

  return {
    employeeId:     payroll.employee?.employeeId                    || '',
    fullName:       `${payroll.employee?.user?.firstName || ''} ${payroll.employee?.user?.lastName || ''}`.trim(),
    department:     payroll.employee?.department?.displayName        || '',
    jobTitle:       payroll.employee?.jobTitle                       || '',
    employmentType: payroll.employee?.employmentType                 || '',
    bankName:       payroll.employee?.bankDetails?.bankName          || '',
    accountNumber:  payroll.employee?.bankDetails?.accountNumber     || '',
    period:         `${payroll.period?.month}/${payroll.period?.year}`,
    status:         payroll.status?.toUpperCase()                    || '',
    basicSalary:    formatCurrency(payroll.basicSalary),
    allowances:     (payroll.allowances || []).map(a => ({
      name:   a.name,
      amount: formatCurrency(a.amount)
    })),
    deductions:     (payroll.deductions || []).map(d => ({
      name:   d.name,
      amount: formatCurrency(d.amount)
    })),
    grossPay:        formatCurrency(payroll.grossPay),
    totalDeductions: formatCurrency(totalDeductions),
    netPay:          formatCurrency(payroll.netPay),
    paidAt:          formatDate(payroll.paidAt),
    generatedAt:     formatDate(new Date())
  };
}

function buildPayrollReportData(payrolls, query) {
  const totalGross      = payrolls.reduce((s, p) => s + (p.grossPay || 0), 0);
  const totalNet        = payrolls.reduce((s, p) => s + (p.netPay   || 0), 0);
  const totalDeductions = payrolls.reduce((s, p) => s +
    (p.deductions || []).reduce((ds, d) => ds + d.amount, 0), 0);

  return {
    period:          `${query.month}/${query.year}`,
    generatedAt:     formatDate(new Date()),
    totalEmployees:  payrolls.length,
    totalGross:      formatCurrency(totalGross),
    totalDeductions: formatCurrency(totalDeductions),
    totalNet:        formatCurrency(totalNet),
    records:         payrolls.map(p => ({
      employeeId:      p.employee?.employeeId                    || '',
      fullName:        `${p.employee?.user?.firstName || ''} ${p.employee?.user?.lastName || ''}`.trim(),
      department:      p.employee?.department?.displayName       || '',
      jobTitle:        p.employee?.jobTitle                      || '',
      basicSalary:     formatCurrency(p.basicSalary),
      grossPay:        formatCurrency(p.grossPay),
      totalDeductions: formatCurrency(
        (p.deductions || []).reduce((s, d) => s + d.amount, 0)
      ),
      netPay:  formatCurrency(p.netPay),
      status:  p.status?.toUpperCase() || ''
    }))
  };
}

function buildLeaveReportData(leaves) {
  const totalDays  = leaves.reduce((s, l) => s + (l.days || 0), 0);
  const avgDays    = leaves.length
    ? (totalDays / leaves.length).toFixed(1)
    : 0;

  const statusCounts = leaves.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, { approved: 0, pending: 0, rejected: 0, cancelled: 0 });

  return {
    generatedAt:   formatDate(new Date()),
    totalRequests: leaves.length,
    totalDays,
    avgDays,
    statusCounts,
    records: leaves.map(l => ({
      employeeId:  l.employee?.employeeId                 || '',
      fullName:    `${l.employee?.user?.firstName || ''} ${l.employee?.user?.lastName || ''}`.trim(),
      department:  l.employee?.department?.displayName    || '',
      type:        l.type,
      startDate:   formatDate(l.startDate),
      endDate:     formatDate(l.endDate),
      days:        l.days  || 0,
      status:      l.status?.toUpperCase()                || '',
      statusClass: l.status?.toLowerCase()                || '',
      reason:      l.reason || ''
    }))
  };
}

function buildAuditReportData(logs, query) {
  const successCount    = logs.filter(l => l.status === 'success').length;
  const failedCount     = logs.filter(l => l.status === 'failed').length;
  const suspiciousCount = logs.filter(l => l.isSuspicious).length;
  const hasFilters      = !!(query.resource || query.status || query.startDate || query.endDate);

  return {
    generatedAt:   formatDate(new Date()),
    dateRange:     query.startDate && query.endDate
      ? `${formatDate(new Date(query.startDate))} — ${formatDate(new Date(query.endDate))}`
      : null,
    totalActions:   logs.length,
    successCount,
    failedCount,
    suspiciousCount,
    suspiciousLogs: logs
      .filter(l => l.isSuspicious)
      .map(l => ({
        createdAt:   formatDate(l.createdAt, true),
        performedBy: l.performedBy?.fullName || 'System',
        email:       l.performedBy?.email    || '',
        action:      l.action,
        resource:    l.resource,
        ip:          l.location?.ip          || '',
        reasons:     (l.suspiciousReasons || []).join(' · ')
      })),
    filters: {
      resource:  query.resource  || null,
      status:    query.status    || null,
      startDate: query.startDate ? formatDate(new Date(query.startDate)) : null,
      endDate:   query.endDate   ? formatDate(new Date(query.endDate))   : null,
      hasAny:    hasFilters
    },
    records: logs.map(l => ({
      createdAt:    formatDate(l.createdAt, true),
      performedBy:  l.performedBy?.fullName || 'System',
      email:        l.performedBy?.email    || '',
      action:       l.action,
      resource:     l.resource,
      permission:   l.permission            || '',
      status:       l.status?.toUpperCase() || '',
      statusClass:  l.status?.toLowerCase() || '',
      ip:           l.location?.ip          || '',
      city:         l.location?.city        || '',
      country:      l.location?.country     || '',
      browser:      `${l.device?.browser?.name || ''} ${l.device?.browser?.version || ''}`.trim(),
      os:           `${l.device?.os?.name || ''} ${l.device?.os?.version || ''}`.trim(),
      isSuspicious: l.isSuspicious
    }))
  };
}

const pdfService = {
  async generatePayslip(res, payrollId) {
    const payroll = await Payroll.findById(payrollId)
      .populate({
        path: "employee",
        populate: [
          { path: "user", select: "firstName lastName email" },
          { path: "department", select: "displayName" },
        ],
      })
      .lean();

    if (!payroll) {
      const error = new Error("Payroll record not found");
      error.statusCode = 404;
      throw error;
    }

    const totalDeductions = (payroll.deductions || []).reduce(
      (s, d) => s + d.amount,
      0,
    );

    // format allowances and deductions for template
    const allowances = (payroll.allowances || []).map((a) => ({
      name: a.name,
      amount: formatCurrency(a.amount),
    }));

    const deductions = (payroll.deductions || []).map((d) => ({
      name: d.name,
      amount: formatCurrency(d.amount),
    }));

    const data = {
      // employee
      employeeId: payroll.employee?.employeeId || "",
      fullName:
        `${payroll.employee?.user?.firstName || ""} ${payroll.employee?.user?.lastName || ""}`.trim(),
      department: payroll.employee?.department?.displayName || "",
      jobTitle: payroll.employee?.jobTitle || "",
      employmentType: payroll.employee?.employmentType || "",
      bankName: payroll.employee?.bankDetails?.bankName || "",
      accountNumber: payroll.employee?.bankDetails?.accountNumber || "",

      // payroll
      period: `${payroll.period?.month}/${payroll.period?.year}`,
      status: payroll.status?.toUpperCase() || "",
      basicSalary: formatCurrency(payroll.basicSalary),
      allowances,
      deductions,
      grossPay: formatCurrency(payroll.grossPay),
      totalDeductions: formatCurrency(totalDeductions),
      netPay: formatCurrency(payroll.netPay),
      paidAt: formatDate(payroll.paidAt),
      generatedAt: formatDate(new Date()),
    };

    const template = loadTemplate("payslip");
    const html = template(data);
    const pdf = await generatePDF(html);

    const filename = `payslip_${data.employeeId}_${payroll.period?.month}_${payroll.period?.year}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdf.length);
    res.end(pdf);
  },

  async generatePayrollReport(res, query = {}) {
    const filter = {};
    if (query.month) filter["period.month"] = Number(query.month);
    if (query.year) filter["period.year"] = Number(query.year);
    if (query.status) filter.status = query.status;

    const payrolls = await Payroll.find(filter)
      .populate({
        path: "employee",
        populate: [
          { path: "user", select: "firstName lastName" },
          { path: "department", select: "displayName" },
        ],
      })
      .lean();

    // calculate totals
    const totalGross = payrolls.reduce((s, p) => s + (p.grossPay || 0), 0);
    const totalNet = payrolls.reduce((s, p) => s + (p.netPay || 0), 0);
    const totalDeductions = payrolls.reduce(
      (s, p) => s + (p.deductions || []).reduce((ds, d) => ds + d.amount, 0),
      0,
    );

    const period =
      query.month && query.year
        ? `${query.month}/${query.year}`
        : "All Periods";

    const records = payrolls.map((p) => ({
      employeeId: p.employee?.employeeId || "",
      fullName:
        `${p.employee?.user?.firstName || ""} ${p.employee?.user?.lastName || ""}`.trim(),
      department: p.employee?.department?.displayName || "",
      jobTitle: p.employee?.jobTitle || "",
      basicSalary: formatCurrency(p.basicSalary),
      grossPay: formatCurrency(p.grossPay),
      totalDeductions: formatCurrency(
        (p.deductions || []).reduce((s, d) => s + d.amount, 0),
      ),
      netPay: formatCurrency(p.netPay),
      status: p.status?.toUpperCase() || "",
    }));

    const data = {
      period,
      generatedAt: formatDate(new Date()),
      totalEmployees: payrolls.length,
      totalGross: formatCurrency(totalGross),
      totalDeductions: formatCurrency(totalDeductions),
      totalNet: formatCurrency(totalNet),
      records,
    };

    const template = loadTemplate("payroll-report");
    const html = template(data);
    const pdf = await generatePDF(html);

    const filename = `payroll_report_${period.replace("/", "_")}_${dateStamp()}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdf.length);
    res.end(pdf);
  },

  async generateLeaveReport(res, query = {}) {
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.startDate) filter.startDate = { $gte: new Date(query.startDate) };
    if (query.endDate) filter.endDate = { $lte: new Date(query.endDate) };

    const MAX_LEAVE_RECORDS = 500;
    const leaves = await Leave.find(filter)
      .populate({
        path: "employee",
        populate: [
          { path: "user", select: "firstName lastName" },
          { path: "department", select: "displayName" },
        ],
      })
      .sort({ startDate: -1 })
      .limit(MAX_LEAVE_RECORDS)
      .lean();

    const totalDays = leaves.reduce((s, l) => s + (l.days || 0), 0);

    const statusCounts = leaves.reduce(
      (acc, l) => {
        acc[l.status] = (acc[l.status] || 0) + 1;
        return acc;
      },
      { approved: 0, pending: 0, rejected: 0, cancelled: 0 },
    );

    const avgDays = leaves.length
      ? (leaves.reduce((s, l) => s + (l.days || 0), 0) / leaves.length).toFixed(
          1,
        )
      : 0;

    const data = {
      generatedAt: formatDate(new Date()),
      totalRequests: leaves.length,
      totalDays,
      avgDays,
      statusCounts,
      records: leaves.map((l) => ({
        employeeId: l.employee?.employeeId || "",
        fullName:
          `${l.employee?.user?.firstName || ""} ${l.employee?.user?.lastName || ""}`.trim(),
        department: l.employee?.department?.displayName || "",
        type: l.type,
        startDate: formatDate(l.startDate),
        endDate: formatDate(l.endDate),
        days: l.days || 0,
        status: l.status?.toUpperCase() || "",
        statusClass: l.status?.toLowerCase() || "",
        reason: l.reason || "",
      })),
    };

    const template = loadTemplate("leave-report");
    const html = template(data);
    const pdf = await generatePDF(html);

    const filename = `leave_report_${dateStamp()}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdf.length);
    res.end(pdf);
  },

  async generateAuditReport(res, query = {}) {
    const filter = {};
    if (query.resource) filter.resource = query.resource;
    if (query.status) filter.status = query.status;
    if (query.startDate) filter.createdAt = { $gte: new Date(query.startDate) };
    if (query.endDate) {
      filter.createdAt = {
        ...filter.createdAt,
        $lte: new Date(query.endDate),
      };
    }

    const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).lean();

    // calculate summary counts
    const successCount = logs.filter((l) => l.status === "success").length;
    const failedCount = logs.filter((l) => l.status === "failed").length;
    const suspiciousCount = logs.filter((l) => l.isSuspicious).length;

    const suspiciousLogs = logs
      .filter((l) => l.isSuspicious)
      .map((l) => ({
        createdAt: formatDate(l.createdAt, true),
        performedBy: l.performedBy?.fullName || "System",
        email: l.performedBy?.email || "",
        action: l.action,
        resource: l.resource,
        ip: l.location?.ip || "",
        reasons: (l.suspiciousReasons || []).join(" · "),
      }));

    const records = logs.map((l) => ({
      createdAt: formatDate(l.createdAt, true),
      performedBy: l.performedBy?.fullName || "System",
      email: l.performedBy?.email || "",
      action: l.action,
      resource: l.resource,
      permission: l.permission || "",
      status: l.status?.toUpperCase() || "",
      statusClass: l.status?.toLowerCase() || "",
      ip: l.location?.ip || "",
      city: l.location?.city || "",
      country: l.location?.country || "",
      browser:
        `${l.device?.browser?.name || ""} ${l.device?.browser?.version || ""}`.trim(),
      os: `${l.device?.os?.name || ""} ${l.device?.os?.version || ""}`.trim(),
      isSuspicious: l.isSuspicious,
    }));

    const hasFilters = !!(
      query.resource ||
      query.status ||
      query.startDate ||
      query.endDate
    );

    const data = {
      generatedAt: formatDate(new Date()),
      dateRange:
        query.startDate && query.endDate
          ? `${formatDate(new Date(query.startDate))} — ${formatDate(new Date(query.endDate))}`
          : null,
      totalActions: logs.length,
      successCount,
      failedCount,
      suspiciousCount,
      suspiciousLogs,
      filters: {
        resource: query.resource || null,
        status: query.status || null,
        startDate: query.startDate
          ? formatDate(new Date(query.startDate))
          : null,
        endDate: query.endDate ? formatDate(new Date(query.endDate)) : null,
        hasAny: hasFilters,
      },
      records,
    };

    const template = loadTemplate("audit-report");
    const html = template(data);
    const pdf = await generatePDF(html);

    const filename = `audit_report_${dateStamp()}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdf.length);
    res.end(pdf);
  },

  async generatePayslipBuffer(payrollId) {
    const payroll = await Payroll.findById(payrollId)
      .populate({
        path: "employee",
        populate: [
          { path: "user", select: "firstName lastName email" },
          { path: "department", select: "displayName" },
        ],
      })
      .lean();

    if (!payroll) {
      const error = new Error("Payroll record not found");
      error.statusCode = 404;
      throw error;
    }

    const data = buildPayslipData(payroll); // extract data building to helper
    const template = loadTemplate("payslip");
    const html = template(data);
    const buffer = await generatePDF(html);

    const filename = `payslip_${data.employeeId}_${payroll.period?.month}_${payroll.period?.year}_${Date.now()}.pdf`;

    return { buffer, filename };
  },

  async generatePayrollReportBuffer(query) {
    if (!query.month || !query.year) {
      const error = new Error("month and year are required");
      error.statusCode = 400;
      throw error;
    }

    const filter = {
      "period.month": Number(query.month),
      "period.year": Number(query.year),
    };
    if (query.status) filter.status = query.status;

    const payrolls = await Payroll.find(filter)
      .populate({
        path: "employee",
        populate: [
          { path: "user", select: "firstName lastName" },
          { path: "department", select: "displayName" },
        ],
      })
      .limit(500)
      .lean();

    const data = buildPayrollReportData(payrolls, query);
    const template = loadTemplate("payroll-report");
    const html = template(data);
    const buffer = await generatePDF(html);

    const filename = `payroll_report_${query.month}_${query.year}_${Date.now()}.pdf`;

    return { buffer, filename };
  },

  async generateLeaveReportBuffer(query) {
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.startDate) filter.startDate = { $gte: new Date(query.startDate) };
    if (query.endDate) filter.endDate = { $lte: new Date(query.endDate) };

    const leaves = await Leave.find(filter)
      .populate({
        path: "employee",
        populate: [
          { path: "user", select: "firstName lastName" },
          { path: "department", select: "displayName" },
        ],
      })
      .limit(500)
      .lean();

    const data = buildLeaveReportData(leaves);
    const template = loadTemplate("leave-report");
    const html = template(data);
    const buffer = await generatePDF(html);

    const filename = `leave_report_${Date.now()}.pdf`;

    return { buffer, filename };
  },

  async generateAuditReportBuffer(query) {
    const filter = {};
    if (query.resource) filter.resource = query.resource;
    if (query.status) filter.status = query.status;
    if (query.startDate) filter.createdAt = { $gte: new Date(query.startDate) };
    if (query.endDate) {
      filter.createdAt = {
        ...filter.createdAt,
        $lte: new Date(query.endDate),
      };
    }

    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    const data = buildAuditReportData(logs, query);
    const template = loadTemplate("audit-report");
    const html = template(data);
    const buffer = await generatePDF(html);

    const filename = `audit_report_${Date.now()}.pdf`;

    return { buffer, filename };
  },
};

module.exports = pdfService;
