const queues        = require('../queue');
const emailService  = require('../../modules/email/email.service');
const outboxService = require('../../modules/outbox/outbox.service');

async function recordResult(job, result) {
  try {
    await outboxService.markEmailResult(String(job.id), result);
  } catch (err) {
    console.error(`Email job [${job.id}] result not recorded:`, err.name);
  }
}

async function handleEmailJob(job) {
  try {
    await sendEmailJob(job);
  } catch (err) {
    if (job.attemptsMade + 1 >= (job.opts?.attempts || 1)) {
      await recordResult(job, { sent: false, error: `EmailSendFailed: ${err.name}${err.code ? ` (${err.code})` : ''}` });
    }
    throw err;
  }
  await recordResult(job, { sent: true });
}

async function sendEmailJob(job) {
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

  console.log(`Email job [${job.id}] sent: ${type}`);
}

function register() {
  const emailQueue = queues.emailQueue;
  emailQueue.process(handleEmailJob).catch(err => {
    if (err) console.error(`emailQueue processing stopped:`, err.message);
  });
  emailQueue.on('failed', (job, err) => {
    console.error(`Email job [${job.id}] failed:`, err.message);
  });
  return queues.workerReady(emailQueue);
}

module.exports = { handleEmailJob, register };
