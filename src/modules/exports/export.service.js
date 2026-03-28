const { stringify } = require('csv-stringify');
const Employee   = require('../employees/employee.model');
const Payroll    = require('../payroll/payroll.model');
const Leave      = require('../leave/leave.model');
const AuditLog   = require('../audit/auditLog.model');

const exportService = {

  async streamEmployees(res, query = {}) {
    const filter = {};
    if (query.department)       filter.department = query.department;
    if (query.employmentStatus) filter.employmentStatus = query.employmentStatus;
    if (query.employmentType)   filter.employmentType = query.employmentType;

    // set response headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="employees_${dateStamp()}.csv"`);

    const stringifier = stringify({
      header: true,
      columns: [
        { key: 'employeeId',       header: 'Employee ID'       },
        { key: 'firstName',        header: 'First Name'        },
        { key: 'lastName',         header: 'Last Name'         },
        { key: 'email',            header: 'Email'             },
        { key: 'department',       header: 'Department'        },
        { key: 'jobTitle',         header: 'Job Title'         },
        { key: 'employmentType',   header: 'Employment Type'   },
        { key: 'employmentStatus', header: 'Status'            },
        { key: 'salary',           header: 'Basic Salary (NGN)'},
        { key: 'startDate',        header: 'Start Date'        },
        { key: 'endDate',          header: 'End Date'          },
        { key: 'phone',            header: 'Phone'             },
        { key: 'state',            header: 'State'             },
        { key: 'bankName',         header: 'Bank'              },
        { key: 'accountNumber',    header: 'Account Number'    }
      ]
    });

    stringifier.pipe(res);

    const cursor = Employee.find(filter)
      .populate('user',       'firstName lastName email')
      .populate('department', 'displayName')
      .lean()
      .cursor();

    cursor.on('data', (emp) => {
      stringifier.write({
        employeeId:       emp.employeeId,
        firstName:        emp.user?.firstName        || '',
        lastName:         emp.user?.lastName         || '',
        email:            emp.user?.email            || '',
        department:       emp.department?.displayName || '',
        jobTitle:         emp.jobTitle               || '',
        employmentType:   emp.employmentType         || '',
        employmentStatus: emp.employmentStatus       || '',
        salary:           emp.salary?.amount         || '',
        startDate:        formatDate(emp.startDate),
        endDate:          formatDate(emp.endDate),
        phone:            emp.phone                  || '',
        state:            emp.address?.state         || '',
        bankName:         emp.bankDetails?.bankName  || '',
        accountNumber:    emp.bankDetails?.accountNumber || ''
      });
    });

    cursor.on('end',   () => stringifier.end());
    cursor.on('error', (err) => {
      console.error('Export cursor error:', err);
      stringifier.end();
    });
  },

  async streamPayroll(res, query = {}) {
    const filter = {};
    if (query.month)  filter['period.month'] = Number(query.month);
    if (query.year)   filter['period.year']  = Number(query.year);
    if (query.status) filter.status = query.status;

    const periodLabel = query.month && query.year
      ? `${query.month}_${query.year}`
      : 'all';

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="payroll_${periodLabel}_${dateStamp()}.csv"`);

    const stringifier = stringify({
      header: true,
      columns: [
        { key: 'employeeId',   header: 'Employee ID'          },
        { key: 'firstName',    header: 'First Name'           },
        { key: 'lastName',     header: 'Last Name'            },
        { key: 'department',   header: 'Department'           },
        { key: 'jobTitle',     header: 'Job Title'            },
        { key: 'period',       header: 'Period'               },
        { key: 'basicSalary',  header: 'Basic Salary (NGN)'   },
        { key: 'allowances',   header: 'Total Allowances (NGN)'},
        { key: 'deductions',   header: 'Total Deductions (NGN)'},
        { key: 'grossPay',     header: 'Gross Pay (NGN)'      },
        { key: 'netPay',       header: 'Net Pay (NGN)'        },
        { key: 'status',       header: 'Status'               },
        { key: 'paidAt',       header: 'Payment Date'         },
        { key: 'bankName',     header: 'Bank'                 },
        { key: 'accountNumber',header: 'Account Number'       }
      ]
    });

    stringifier.pipe(res);

    const cursor = Payroll.find(filter)
      .populate({
        path:     'employee',
        populate: [
          { path: 'user',       select: 'firstName lastName' },
          { path: 'department', select: 'displayName'        }
        ]
      })
      .lean()
      .cursor();

    cursor.on('data', (p) => {
      const totalAllowances = (p.allowances || []).reduce((s, a) => s + a.amount, 0);
      const totalDeductions = (p.deductions || []).reduce((s, d) => s + d.amount, 0);

      stringifier.write({
        employeeId:    p.employee?.employeeId                  || '',
        firstName:     p.employee?.user?.firstName             || '',
        lastName:      p.employee?.user?.lastName              || '',
        department:    p.employee?.department?.displayName     || '',
        jobTitle:      p.employee?.jobTitle                    || '',
        period:        `${p.period?.month}/${p.period?.year}`,
        basicSalary:   p.basicSalary                          || 0,
        allowances:    totalAllowances,
        deductions:    totalDeductions,
        grossPay:      p.grossPay                             || 0,
        netPay:        p.netPay                               || 0,
        status:        p.status                               || '',
        paidAt:        formatDate(p.paidAt),
        bankName:      p.employee?.bankDetails?.bankName      || '',
        accountNumber: p.employee?.bankDetails?.accountNumber || ''
      });
    });

    cursor.on('end',   () => stringifier.end());
    cursor.on('error', (err) => {
      console.error('Export cursor error:', err);
      stringifier.end();
    });
  },

  async streamLeave(res, query = {}) {
    const filter = {};
    if (query.status)    filter.status = query.status;
    if (query.type)      filter.type   = query.type;
    if (query.startDate) filter.startDate = { $gte: new Date(query.startDate) };
    if (query.endDate)   filter.endDate   = { $lte: new Date(query.endDate)   };

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="leave_${dateStamp()}.csv"`);

    const stringifier = stringify({
      header: true,
      columns: [
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
      ]
    });

    stringifier.pipe(res);

    const cursor = Leave.find(filter)
      .populate({
        path:     'employee',
        populate: [
          { path: 'user',       select: 'firstName lastName' },
          { path: 'department', select: 'displayName'        }
        ]
      })
      .lean()
      .cursor();

    cursor.on('data', (l) => {
      stringifier.write({
        employeeId: l.employee?.employeeId                || '',
        firstName:  l.employee?.user?.firstName           || '',
        lastName:   l.employee?.user?.lastName            || '',
        department: l.employee?.department?.displayName   || '',
        type:       l.type                               || '',
        startDate:  formatDate(l.startDate),
        endDate:    formatDate(l.endDate),
        days:       l.days                               || 0,
        reason:     l.reason                             || '',
        status:     l.status                             || '',
        reviewNote: l.reviewNote                         || '',
        reviewedAt: formatDate(l.reviewedAt)
      });
    });

    cursor.on('end',   () => stringifier.end());
    cursor.on('error', (err) => {
      console.error('Export cursor error:', err);
      stringifier.end();
    });
  },

  async streamAuditLogs(res, query = {}) {
    const filter = {};
    if (query.resource)  filter.resource = query.resource;
    if (query.status)    filter.status   = query.status;
    if (query.startDate) filter.createdAt = { $gte: new Date(query.startDate) };
    if (query.endDate) {
      filter.createdAt = {
        ...filter.createdAt,
        $lte: new Date(query.endDate)
      };
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${dateStamp()}.csv"`);

    const stringifier = stringify({
      header: true,
      columns: [
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
      ]
    });

    stringifier.pipe(res);

    const cursor = AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .lean()
      .cursor();

    cursor.on('data', (log) => {
      stringifier.write({
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
        createdAt:    formatDate(log.createdAt, true)
      });
    });

    cursor.on('end',   () => stringifier.end());
    cursor.on('error', (err) => {
      console.error('Export cursor error:', err);
      stringifier.end();
    });
  },

  async streamAttendance(res, query = {}) {
    const filter = {};
    if (query.employeeId) filter.employee = query.employeeId;
    if (query.status)     filter.status   = query.status;
    if (query.startDate)  filter.date     = { $gte: new Date(query.startDate) };
    if (query.endDate) {
      filter.date = {
        ...filter.date,
        $lte: new Date(query.endDate)
      };
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_${dateStamp()}.csv"`);

    const stringifier = stringify({
      header: true,
      columns: [
        { key: 'employeeId', header: 'Employee ID'  },
        { key: 'firstName',  header: 'First Name'   },
        { key: 'lastName',   header: 'Last Name'    },
        { key: 'department', header: 'Department'  },
        { key: 'jobTitle',   header: 'Job Title'    },
        { key: 'date',       header: 'Date'         },
        { key: 'status',     header: 'Status'       },
        { key: 'inTime',     header: 'In Time'      },
        { key: 'outTime',    header: 'Out Time'     },
        { key: 'duration',   header: 'Duration'     },
        { key: 'overtime',   header: 'Overtime'     }
      ]
    });

    stringifier.pipe(res);

    const cursor = Attendance.find(filter)
      .sort({ date: -1 })
      .lean()
      .cursor();
    cursor.on('data', (a) => {
      stringifier.write({
        employeeId: a.employee?.employeeId                || '',
        firstName:  a.employee?.user?.firstName           || '',
        lastName:   a.employee?.user?.lastName            || '',
        department: a.employee?.department?.displayName   || '',
        jobTitle:   a.employee?.jobTitle                    || '',
        date:       formatDate(a.date),
        status:     a.status                             || '',
        inTime:     formatDate(a.clockIn?.time, true)    || '',
        outTime:    formatDate(a.clockOut?.time, true)   || '',
        duration:   a.duration                          || 0,
        overtime:   a.overtimeMinutes                  || 0
      });
    });

    cursor.on('end',   () => stringifier.end());
    cursor.on('error', (err) => {
      console.error('Export cursor error:', err);
      stringifier.end();
    });
  }
};


function formatDate(date, withTime = false) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d)) return '';
  const base = d.toISOString().split('T')[0];
  if (!withTime) return base;
  return `${base} ${d.toTimeString().split(' ')[0]}`;
}

function dateStamp() {
  return new Date().toISOString().split('T')[0]; // e.g 2026-02-20
}

module.exports = exportService;