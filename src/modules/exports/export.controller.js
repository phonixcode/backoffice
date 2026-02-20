const { csvQueue }  = require('../../jobs/queue');
const { v4: uuidv4} = require('uuid');
const asyncHandler  = require('../../utils/asyncHandler');
const apiResponse   = require('../../utils/apiResponse');
const path          = require('path');
const fs            = require('fs');

const exportController = {

  employees: asyncHandler(async (req, res) => {
    const jobId = uuidv4();
    const job   = await csvQueue.add(
      { type: 'employees', query: req.query, userId: req.user._id },
      { jobId }
    );
    return apiResponse.success(res,
      'Employee export started — you will be notified when ready',
      { jobId: job.id }
    );
  }),

  payroll: asyncHandler(async (req, res) => {
    const jobId = uuidv4();
    const job   = await csvQueue.add(
      { type: 'payroll', query: req.query, userId: req.user._id },
      { jobId }
    );
    return apiResponse.success(res,
      'Payroll export started — you will be notified when ready',
      { jobId: job.id }
    );
  }),

  leave: asyncHandler(async (req, res) => {
    const jobId = uuidv4();
    const job   = await csvQueue.add(
      { type: 'leave', query: req.query, userId: req.user._id },
      { jobId }
    );
    return apiResponse.success(res,
      'Leave export started — you will be notified when ready',
      { jobId: job.id }
    );
  }),

  auditLogs: asyncHandler(async (req, res) => {
    const jobId = uuidv4();
    const job   = await csvQueue.add(
      { type: 'audit-logs', query: req.query, userId: req.user._id },
      { jobId }
    );
    return apiResponse.success(res,
      'Audit log export started — you will be notified when ready',
      { jobId: job.id }
    );
  }),

  // check job status
  jobStatus: asyncHandler(async (req, res) => {
    const job = await csvQueue.getJob(req.params.jobId);
    if (!job) return apiResponse.error(res, 'Job not found', 404);

    const state    = await job.getState();
    const progress = job._progress;
    const result   = job.returnvalue;

    return apiResponse.success(res, 'Job status', {
      jobId:        job.id,
      state,
      progress,
      result,
      failedReason: job.failedReason || null
    });
  }),

  download: asyncHandler(async (req, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(process.cwd(), 'storage', 'csv', filename);

    if (!fs.existsSync(filePath)) {
      return apiResponse.error(res, 'File not found or has expired', 404);
    }

    res.setHeader('Content-Type',        'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fs.createReadStream(filePath).pipe(res);
  })
};

module.exports = exportController;