const { pdfQueue }          = require('../queue');
const pdfService            = require('../../modules/pdf/pdf.service');
const path                  = require('path');
const fs                    = require('fs');
const notificationService   = require('../../modules/notification/notification.service');

const OUTPUT_DIR = path.join(process.cwd(), 'storage', 'pdfs');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

pdfQueue.process(async (job) => {
  const { type, query, userId, payrollId } = job.data;

  console.log(`Processing PDF job [${job.id}] type: ${type}`);

  try {
    // update job progress
    await job.progress(10);

    let pdfBuffer;
    let filename;

    // generate the right PDF based on type
    switch (type) {
      case 'payslip':
        ({ buffer: pdfBuffer, filename } =
          await pdfService.generatePayslipBuffer(payrollId));
        break;

      case 'payroll-report':
        ({ buffer: pdfBuffer, filename } =
          await pdfService.generatePayrollReportBuffer(query));
        break;

      case 'leave-report':
        ({ buffer: pdfBuffer, filename } =
          await pdfService.generateLeaveReportBuffer(query));
        break;

      case 'audit-report':
        ({ buffer: pdfBuffer, filename } =
          await pdfService.generateAuditReportBuffer(query));
        break;

      default:
        throw new Error(`Unknown PDF type: ${type}`);
    }

    await job.progress(80);

    // save PDF to disk
    const filePath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filePath, pdfBuffer);

    await job.progress(90);

    // notify user via SSE — their PDF is ready
    await notificationService.send({
      title:      'Your PDF is Ready',
      message:    `Your ${type.replace('-', ' ')} has been generated and is ready to download.`,
      type:       'success',
      resource:   'pdf',
      userId,
      metadata: {
        downloadUrl: `/api/v1/pdf/download/${filename}`,
        filename,
        jobId: job.id
      }
    });

    await job.progress(100);
    console.log(`PDF job [${job.id}] completed: ${filename}`);

    return { filename, filePath };

  } catch (err) {
    console.error(`PDF job [${job.id}] failed:`, err.message);

    // notify user of failure
    await notificationService.send({
      title:   'PDF Generation Failed',
      message: `We could not generate your ${type.replace('-', ' ')}. Please try again.`,
      type:    'error',
      userId
    });

    throw err; // re-throw so Bull marks job as failed and retries
  }
});

// job event listeners
pdfQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed:`, result.filename);
});

pdfQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed after ${job.opts.attempts} attempts:`, err.message);
});

pdfQueue.on('stalled', (job) => {
  console.warn(`Job ${job.id} stalled — will be retried`);
});

module.exports = pdfQueue;