const { csvQueue }        = require('../queue');
const Employee            = require('../../modules/employees/employee.model');
const Payroll             = require('../../modules/payroll/payroll.model');
const Leave               = require('../../modules/leave/leave.model');
const AuditLog            = require('../../modules/audit/auditLog.model');
const { stringify }       = require('csv-stringify');
const { v4: uuidv4 }      = require('uuid');
const path                = require('path');
const fs                  = require('fs');
const notificationService = require('../../modules/notification/notification.service');

const OUTPUT_DIR = path.join(process.cwd(), 'storage', 'csv');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}


function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return isNaN(d) ? '' : d.toISOString().split('T')[0];
}

function formatDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return isNaN(d) ? '' : `${d.toISOString().split('T')[0]} ${d.toTimeString().split(' ')[0]}`;
}

function writeCSV(filePath, columns, rows) {
  return new Promise((resolve, reject) => {
    const output     = fs.createWriteStream(filePath);
    const stringifier = stringify({ header: true, columns });

    output.on('finish', resolve);
    output.on('error',  reject);
    stringifier.on('error', reject);

    stringifier.pipe(output);
    rows.forEach(row => stringifier.write(row));
    stringifier.end();
  });
}

async function processEmployeeExport(job) {
  const { query } = job.data;

  const filter = {};
  if (query.department)       filter.department       = query.department;
  if (query.employmentStatus) filter.employmentStatus = query.employmentStatus;
  if (query.employmentType)   filter.employmentType   = query.employmentType;

  await job.progress(10);

  const employees = await Employee.find(filter)
    .populate('user',       'firstName lastName email')
    .populate('department', 'displayName')
    .lean();

  await job.progress(50);

  const filename = `employees_${Date.now()}.csv`;
  const filePath = path.join(OUTPUT_DIR, filename);

  const columns = [
    { key: 'employeeId',       header: 'Employee ID'        },
    { key: 'firstName',        header: 'First Name'         },
    { key: 'lastName',         header: 'Last Name'          },
    { key: 'email',            header: 'Email'              },
    { key: 'department',       header: 'Department'         },
    { key: 'jobTitle',         header: 'Job Title'          },
    { key: 'employmentType',   header: 'Employment Type'    },
    { key: 'employmentStatus', header: 'Status'             },
    { key: 'salary',           header: 'Basic Salary (NGN)' },
    { key: 'startDate',        header: 'Start Date'         },
    { key: 'endDate',          header: 'End Date'           },
    { key: 'phone',            header: 'Phone'              },
    { key: 'state',            header: 'State'              },
    { key: 'bankName',         header: 'Bank'               },
    { key: 'accountNumber',    header: 'Account Number'     }
  ];

  const rows = employees.map(emp => ({
    employeeId:       emp.employeeId,
    firstName:        emp.user?.firstName             || '',
    lastName:         emp.user?.lastName              || '',
    email:            emp.user?.email                 || '',
    department:       emp.department?.displayName     || '',
    jobTitle:         emp.jobTitle                    || '',
    employmentType:   emp.employmentType              || '',
    employmentStatus: emp.employmentStatus            || '',
    salary:           emp.salary?.amount              || '',
    startDate:        formatDate(emp.startDate),
    endDate:          formatDate(emp.endDate),
    phone:            emp.phone                       || '',
    state:            emp.address?.state              || '',
    bankName:         emp.bankDetails?.bankName       || '',
    accountNumber:    emp.bankDetails?.accountNumber  || ''
  }));

  await writeCSV(filePath, columns, rows);
  await job.progress(90);

  return { filename, total: rows.length };
}

async function processPayrollExport(job) {
  const { query } = job.data;

  const filter = {};
  if (query.month)    filter['period.month'] = Number(query.month);
  if (query.year)     filter['period.year']  = Number(query.year);
  if (query.status)   filter.status          = query.status;
  if (query.employee) filter.employee        = query.employee;

  await job.progress(10);

  const payrolls = await Payroll.find(filter)
    .populate({
      path:     'employee',
      populate: [
        { path: 'user',       select: 'firstName lastName' },
        { path: 'department', select: 'displayName'        }
      ]
    })
    .lean();

  await job.progress(50);

  const filename = `payroll_${Date.now()}.csv`;
  const filePath = path.join(OUTPUT_DIR, filename);

  const columns = [
    { key: 'employeeId',    header: 'Employee ID'           },
    { key: 'firstName',     header: 'First Name'            },
    { key: 'lastName',      header: 'Last Name'             },
    { key: 'department',    header: 'Department'            },
    { key: 'jobTitle',      header: 'Job Title'             },
    { key: 'period',        header: 'Period'                },
    { key: 'basicSalary',   header: 'Basic Salary (NGN)'    },
    { key: 'allowances',    header: 'Total Allowances (NGN)'},
    { key: 'deductions',    header: 'Total Deductions (NGN)'},
    { key: 'grossPay',      header: 'Gross Pay (NGN)'       },
    { key: 'netPay',        header: 'Net Pay (NGN)'         },
    { key: 'status',        header: 'Status'                },
    { key: 'paidAt',        header: 'Payment Date'          },
    { key: 'bankName',      header: 'Bank'                  },
    { key: 'accountNumber', header: 'Account Number'        }
  ];

  const rows = payrolls.map(p => ({
    employeeId:    p.employee?.employeeId                    || '',
    firstName:     p.employee?.user?.firstName               || '',
    lastName:      p.employee?.user?.lastName                || '',
    department:    p.employee?.department?.displayName       || '',
    jobTitle:      p.employee?.jobTitle                      || '',
    period:        `${p.period?.month}/${p.period?.year}`,
    basicSalary:   p.basicSalary                            || 0,
    allowances:    (p.allowances || []).reduce((s, a) => s + a.amount, 0),
    deductions:    (p.deductions || []).reduce((s, d) => s + d.amount, 0),
    grossPay:      p.grossPay                               || 0,
    netPay:        p.netPay                                 || 0,
    status:        p.status                                 || '',
    paidAt:        formatDate(p.paidAt),
    bankName:      p.employee?.bankDetails?.bankName         || '',
    accountNumber: p.employee?.bankDetails?.accountNumber    || ''
  }));

  await writeCSV(filePath, columns, rows);
  await job.progress(90);

  return { filename, total: rows.length };
}

async function processLeaveExport(job) {
  const { query } = job.data;

  const filter = {};
  if (query.status)    filter.status    = query.status;
  if (query.type)      filter.type      = query.type;
  if (query.startDate) filter.startDate = { $gte: new Date(query.startDate) };
  if (query.endDate)   filter.endDate   = { $lte: new Date(query.endDate)   };

  await job.progress(10);

  const leaves = await Leave.find(filter)
    .populate({
      path:     'employee',
      populate: [
        { path: 'user',       select: 'firstName lastName' },
        { path: 'department', select: 'displayName'        }
      ]
    })
    .lean();

  await job.progress(50);

  const filename = `leave_${Date.now()}.csv`;
  const filePath = path.join(OUTPUT_DIR, filename);

  const columns = [
    { key: 'employeeId', header: 'Employee ID'  },
    { key: 'firstName',  header: 'First Name'   },
    { key: 'lastName',   header: 'Last Name'    },
    { key: 'department', header: 'Department'   },
    { key: 'type',       header: 'Leave Type'   },
    { key: 'startDate',  header: 'Start Date'   },
    { key: 'endDate',    header: 'End Date'      },
    { key: 'days',       header: 'Days'          },
    { key: 'reason',     header: 'Reason'        },
    { key: 'status',     header: 'Status'        },
    { key: 'reviewNote', header: 'Review Note'   },
    { key: 'reviewedAt', header: 'Reviewed At'   }
  ];

  const rows = leaves.map(l => ({
    employeeId: l.employee?.employeeId                 || '',
    firstName:  l.employee?.user?.firstName            || '',
    lastName:   l.employee?.user?.lastName             || '',
    department: l.employee?.department?.displayName    || '',
    type:       l.type                                || '',
    startDate:  formatDate(l.startDate),
    endDate:    formatDate(l.endDate),
    days:       l.days                                || 0,
    reason:     l.reason                              || '',
    status:     l.status                              || '',
    reviewNote: l.reviewNote                          || '',
    reviewedAt: formatDate(l.reviewedAt)
  }));

  await writeCSV(filePath, columns, rows);
  await job.progress(90);

  return { filename, total: rows.length };
}

async function processAuditExport(job) {
  const { query } = job.data;

  const filter = {};
  if (query.resource)  filter.resource  = query.resource;
  if (query.status)    filter.status    = query.status;
  if (query.startDate) filter.createdAt = { $gte: new Date(query.startDate) };
  if (query.endDate) {
    filter.createdAt = {
      ...filter.createdAt,
      $lte: new Date(query.endDate)
    };
  }

  await job.progress(10);

  const logs = await AuditLog.find(filter)
    .sort({ createdAt: -1 })
    .lean();

  await job.progress(50);

  const filename = `audit_logs_${Date.now()}.csv`;
  const filePath = path.join(OUTPUT_DIR, filename);

  const columns = [
    { key: 'performedBy',  header: 'Performed By'  },
    { key: 'email',        header: 'Email'         },
    { key: 'action',       header: 'Action'        },
    { key: 'resource',     header: 'Resource'      },
    { key: 'permission',   header: 'Permission'    },
    { key: 'status',       header: 'Status'        },
    { key: 'ip',           header: 'IP Address'    },
    { key: 'country',      header: 'Country'       },
    { key: 'city',         header: 'City'          },
    { key: 'browser',      header: 'Browser'       },
    { key: 'os',           header: 'OS'            },
    { key: 'isSuspicious', header: 'Suspicious'    },
    { key: 'reasons',      header: 'Reasons'       },
    { key: 'createdAt',    header: 'Timestamp'     }
  ];

  const rows = logs.map(log => ({
    performedBy:  log.performedBy?.fullName      || 'System',
    email:        log.performedBy?.email         || '',
    action:       log.action                     || '',
    resource:     log.resource                   || '',
    permission:   log.permission                 || '',
    status:       log.status                     || '',
    ip:           log.location?.ip               || '',
    country:      log.location?.country          || '',
    city:         log.location?.city             || '',
    browser:      `${log.device?.browser?.name || ''} ${log.device?.browser?.version || ''}`.trim(),
    os:           `${log.device?.os?.name || ''} ${log.device?.os?.version || ''}`.trim(),
    isSuspicious: log.isSuspicious ? 'Yes' : 'No',
    reasons:      (log.suspiciousReasons || []).join(' | '),
    createdAt:    formatDateTime(log.createdAt)
  }));

  await writeCSV(filePath, columns, rows);
  await job.progress(90);

  return { filename, total: rows.length };
}


csvQueue.process(async (job) => {
  const { type, userId } = job.data;
  console.log(`Processing CSV job [${job.id}] type: ${type}`);

  try {
    let result;

    switch (type) {
      case 'employees':  result = await processEmployeeExport(job); break;
      case 'payroll':    result = await processPayrollExport(job);  break;
      case 'leave':      result = await processLeaveExport(job);    break;
      case 'audit-logs': result = await processAuditExport(job);    break;
      default: throw new Error(`Unknown CSV export type: ${type}`);
    }

    await job.progress(100);

    // notify user — CSV is ready
    await notificationService.send({
      title:    'Your CSV Export is Ready',
      message:  `Your ${type} export (${result.total} records) is ready to download.`,
      type:     'success',
      resource: 'csv',
      userId,
      metadata: {
        downloadUrl: `/api/v1/export/download/${result.filename}`,
        filename:    result.filename,
        total:       result.total,
        jobId:       job.id
      }
    });

    console.log(`CSV job [${job.id}] completed: ${result.filename} (${result.total} records)`);
    return result;

  } catch (err) {
    console.error(`CSV job [${job.id}] failed:`, err.message);

    await notificationService.send({
      title:   'CSV Export Failed',
      message: `We could not generate your ${type} export. Please try again.`,
      type:    'error',
      userId
    });

    throw err;
  }
});

csvQueue.on('completed', (job, result) => {
  console.log(`CSV Job ${job.id} completed: ${result.filename} — ${result.total} records`);
});

csvQueue.on('failed', (job, err) => {
  console.error(`CSV Job ${job.id} failed:`, err.message);
});

module.exports = csvQueue;