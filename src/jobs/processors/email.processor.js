const { emailQueue } = require('../queue');
const emailService   = require('../../modules/email/email.service');

emailQueue.process(async (job) => {
  const { type, data } = job.data;
  console.log(`Processing email job [${job.id}] type: ${type}`);

  switch (type) {
    case 'forgot-password':
      await emailService.sendForgotPassword(data);
      break;
    case 'password-reset-success':
      await emailService.sendPasswordResetSuccess(data);
      break;
    case 'account-locked':
      await emailService.sendAccountLocked(data);
      break;
    case 'welcome':
      await emailService.sendWelcome(data);
      break;
    case 'termination':
      await emailService.sendTermination(data);
      break;
    case 'payslip-ready':
      await emailService.sendPayslipReady(data);
      break;
    case 'leave-approved':
      await emailService.sendLeaveApproved(data);
      break;
    case 'leave-rejected':
      await emailService.sendLeaveRejected(data);
      break;
    case 'leave-request':
      await emailService.sendLeaveRequest(data);
      break;
    case 'file-ready':
      await emailService.sendFileReady(data);
      break;
    default:
      throw new Error(`Unknown email type: ${type}`);
  }

  console.log(`Email job [${job.id}] sent: ${type} → ${data.to}`);
});

emailQueue.on('failed', (job, err) => {
  console.error(`Email job [${job.id}] failed:`, err.message);
});

module.exports = emailQueue;