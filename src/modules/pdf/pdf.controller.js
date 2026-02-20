const { pdfQueue }  = require('../../jobs/queue');
const asyncHandler  = require('../../utils/asyncHandler');
const apiResponse   = require('../../utils/apiResponse');
const path          = require('path');
const fs            = require('fs');
const { v4: uuidv4 } = require('uuid');

const pdfController = {

  payslip: asyncHandler(async (req, res) => {
    const jobId = uuidv4();

    const job = await pdfQueue.add({
      type:      'payslip',
      payrollId: req.params.payrollId,
      userId:    req.user._id
    }, {
      jobId
    });

    return apiResponse.success(res,
      'Payslip generation started — you will be notified when ready',
      { jobId: job.id }
    );
  }),

  payrollReport: asyncHandler(async (req, res) => {
    if (!req.query.month || !req.query.year) {
      return apiResponse.error(res, 'month and year are required', 400);
    }

    const jobId = uuidv4();

    const job = await pdfQueue.add({
      type:   'payroll-report',
      query:  req.query,
      userId: req.user._id
    }, {
      jobId
    });

    return apiResponse.success(res,
      'Payroll report generation started — you will be notified when ready',
      { jobId: job.id }
    );
  }),

  leaveReport: asyncHandler(async (req, res) => {
    const jobId = uuidv4();

    const job = await pdfQueue.add({
      type:   'leave-report',
      query:  req.query,
      userId: req.user._id
    }, {
      jobId
    });

    return apiResponse.success(res,
      'Leave report generation started — you will be notified when ready',
      { jobId: job.id }
    );
  }),

  auditReport: asyncHandler(async (req, res) => {
    const jobId = uuidv4();

    const job = await pdfQueue.add({
      type:   'audit-report',
      query:  req.query,
      userId: req.user._id
    }, {
      jobId
    });

    return apiResponse.success(res,
      'Audit report generation started — you will be notified when ready',
      { jobId: job.id }
    );
  }),

  jobStatus: asyncHandler(async (req, res) => {
    const job = await pdfQueue.getJob(req.params.jobId);

    if (!job) {
      return apiResponse.error(res, 'Job not found', 404);
    }

    const state    = await job.getState();
    const progress = job._progress;
    const result   = job.returnvalue;

    return apiResponse.success(res, 'Job status', {
      jobId:    job.id,
      state,              // waiting, active, completed, failed
      progress,           // 0-100
      result,             // available when completed
      failedReason: job.failedReason || null
    });
  }),

  download: asyncHandler(async (req, res) => {
    const filename = req.params.filename;

    // sanitize filename — prevent path traversal
    const safeName = path.basename(filename);
    const filePath = path.join(process.cwd(), 'storage', 'pdfs', safeName);

    if (!fs.existsSync(filePath)) {
      return apiResponse.error(res, 'File not found or has expired', 404);
    }

    res.setHeader('Content-Type',        'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    fs.createReadStream(filePath).pipe(res);
  })
};

module.exports = pdfController;