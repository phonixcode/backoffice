const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs         = require('fs');
const path       = require('path');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const templateCache = {};

function loadTemplate(name) {
  if (templateCache[name]) return templateCache[name];

  const filePath = path.join(__dirname, 'templates', `${name}.hbs`);
  const source   = fs.readFileSync(filePath, 'utf8');
  const compiled = handlebars.compile(source);

  templateCache[name] = compiled;
  return compiled;
}

function loadBase() {
  return loadTemplate('base');
}

function renderEmail({ template, data, subject, tag }) {
  const contentTemplate = loadTemplate(template);
  const content         = contentTemplate(data);
  const baseTemplate    = loadBase();

  return baseTemplate({
    subject,
    tag:     tag || 'Notification',
    content
  });
}

async function sendEmail({ to, subject, template, tag, data }) {
  const html = renderEmail({ template, data, subject, tag });

  return transporter.sendMail({
    from:    `"BackOffice NG" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html
  });
}

const emailService = {

  async sendForgotPassword({ to, firstName, resetUrl }) {
    return sendEmail({
      to,
      subject:  'Reset Your Password — BackOffice NG',
      template: 'forgot-password',
      tag:      'Security',
      data:     { firstName, resetUrl }
    });
  },

  async sendPasswordResetSuccess({ to, firstName, email, ip }) {
    return sendEmail({
      to,
      subject:  'Password Changed Successfully — BackOffice NG',
      template: 'password-reset-success',
      tag:      'Security',
      data: {
        firstName,
        email,
        ip:        ip   || 'Unknown',
        changedAt: new Date().toLocaleString('en-NG'),
        loginUrl:  `${process.env.CLIENT_URL}/login`
      }
    });
  },

  async sendAccountLocked({ to, firstName, email, attempts, ip }) {
    const now       = new Date();
    const unlocksAt = new Date(now.getTime() + 30 * 60 * 1000);

    return sendEmail({
      to,
      subject:  'Account Locked — BackOffice NG',
      template: 'account-locked',
      tag:      'Security Alert',
      data: {
        firstName,
        email,
        attempts,
        ip:                ip || 'Unknown',
        lockedAt:          now.toLocaleString('en-NG'),
        unlocksAt:         unlocksAt.toLocaleString('en-NG'),
        forgotPasswordUrl: `${process.env.CLIENT_URL}/forgot-password`
      }
    });
  },

  async sendWelcome({ to, firstName, fullName, employeeId, department, jobTitle, email, tempPassword, startDate }) {
    return sendEmail({
      to,
      subject:  'Welcome to BackOffice NG 🎉',
      template: 'welcome',
      tag:      'Onboarding',
      data: {
        firstName,
        fullName,
        employeeId,
        department,
        jobTitle,
        email,
        tempPassword,
        startDate: new Date(startDate).toLocaleDateString('en-NG', {
          day: '2-digit', month: 'long', year: 'numeric'
        }),
        loginUrl: `${process.env.CLIENT_URL}/login`
      }
    });
  },

  async sendTermination({ to, firstName, employeeId, department, jobTitle, endDate, reason }) {
    return sendEmail({
      to,
      subject:  'Employment Termination Notice — BackOffice NG',
      template: 'termination',
      tag:      'HR Notice',
      data: {
        firstName,
        employeeId,
        department,
        jobTitle,
        reason:  reason || 'Not specified',
        endDate: new Date(endDate).toLocaleDateString('en-NG', {
          day: '2-digit', month: 'long', year: 'numeric'
        })
      }
    });
  },

  async sendPayslipReady({ to, firstName, employeeId, period, basicSalary, totalAllowances, totalDeductions, grossPay, netPay, bankName, accountNumber, paidAt, payslipUrl }) {
    return sendEmail({
      to,
      subject:  `Salary Payment — ${period} — BackOffice NG`,
      template: 'payslip-ready',
      tag:      'Payroll',
      data: {
        firstName,
        employeeId,
        period,
        basicSalary,
        totalAllowances,
        totalDeductions,
        grossPay,
        netPay,
        bankName,
        accountNumber,
        payslipUrl,
        paidAt: new Date(paidAt).toLocaleDateString('en-NG', {
          day: '2-digit', month: 'long', year: 'numeric'
        })
      }
    });
  },

  async sendLeaveApproved({ to, firstName, leaveType, startDate, endDate, days, approvedBy }) {
    return sendEmail({
      to,
      subject:  'Leave Request Approved — BackOffice NG',
      template: 'leave-approved',
      tag:      'Leave',
      data: {
        firstName,
        leaveType,
        days,
        approvedBy,
        startDate:  new Date(startDate).toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' }),
        endDate:    new Date(endDate).toLocaleDateString('en-NG',   { day: '2-digit', month: 'long', year: 'numeric' }),
        approvedAt: new Date().toLocaleString('en-NG')
      }
    });
  },

  async sendLeaveRejected({ to, firstName, leaveType, startDate, endDate, days, reviewedBy, reviewNote }) {
    return sendEmail({
      to,
      subject:  'Leave Request Update — BackOffice NG',
      template: 'leave-rejected',
      tag:      'Leave',
      data: {
        firstName,
        leaveType,
        days,
        reviewedBy,
        reviewNote: reviewNote || null,
        startDate:  new Date(startDate).toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' }),
        endDate:    new Date(endDate).toLocaleDateString('en-NG',   { day: '2-digit', month: 'long', year: 'numeric' })
      }
    });
  },

  async sendLeaveRequest({ to, recipientName, employeeName, department, leaveType, startDate, endDate, days, reason, reviewUrl }) {
    return sendEmail({
      to,
      subject:  `New Leave Request — ${employeeName} — BackOffice NG`,
      template: 'leave-request',
      tag:      'Leave Approval',
      data: {
        recipientName,
        employeeName,
        department,
        leaveType,
        days,
        reason,
        reviewUrl,
        startDate:   new Date(startDate).toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' }),
        endDate:     new Date(endDate).toLocaleDateString('en-NG',   { day: '2-digit', month: 'long', year: 'numeric' }),
        submittedAt: new Date().toLocaleString('en-NG')
      }
    });
  },

  async sendFileReady({ to, firstName, fileType, filename, downloadUrl }) {
    return sendEmail({
      to,
      subject:  `Your ${fileType} is Ready — BackOffice NG`,
      template: 'file-ready',
      tag:      'Export',
      data: {
        firstName,
        fileType,
        filename,
        downloadUrl,
        generatedAt: new Date().toLocaleString('en-NG')
      }
    });
  }
};

module.exports = emailService;