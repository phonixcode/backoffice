const User       = require('../users/user.model');
const Employee   = require('../employees/employee.model');
const Department = require('../departments/department.model');
const Payroll    = require('../payroll/payroll.model');
const Leave      = require('../leave/leave.model');
const AuditLog   = require('../audit/auditLog.model');

const dashboardService = {

  async getOverview() {
    const now          = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth    = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalEmployees,
      activeEmployees,
      newHiresThisMonth,
      newHiresLastMonth,
      totalDepartments,
      activeDepartments,
      totalUsers,
      activeUsers,
      terminatedThisMonth
    ] = await Promise.all([
      Employee.countDocuments({}),
      Employee.countDocuments({ employmentStatus: 'active' }),
      Employee.countDocuments({ startDate: { $gte: startOfMonth } }),
      Employee.countDocuments({ startDate: { $gte: lastMonth, $lte: endLastMonth } }),
      Department.countDocuments({}),
      Department.countDocuments({ isActive: true }),
      User.countDocuments({}),
      User.countDocuments({ isActive: true }),
      Employee.countDocuments({
        employmentStatus: 'terminated',
        endDate: { $gte: startOfMonth }
      })
    ]);

    // calculate growth rate vs last month
    const hiresGrowth = newHiresLastMonth === 0 ? 100
      : (((newHiresThisMonth - newHiresLastMonth) / newHiresLastMonth) * 100).toFixed(1);

    return {
      employees: {
        total:              totalEmployees,
        active:             activeEmployees,
        inactive:           totalEmployees - activeEmployees,
        newHiresThisMonth,
        terminatedThisMonth,
        hiresGrowthPct:     `${hiresGrowth}%`
      },
      departments: {
        total:  totalDepartments,
        active: activeDepartments
      },
      users: {
        total:    totalUsers,
        active:   activeUsers,
        inactive: totalUsers - activeUsers
      }
    };
  },

  async getHRStats() {
    const now          = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear  = new Date(now.getFullYear(), 0, 1);

    const [
      byEmploymentType,
      byEmploymentStatus,
      byDepartment,
      recentHires,
      recentTerminations
    ] = await Promise.all([
      // breakdown by employment type
      Employee.aggregate([
        { $group: { _id: '$employmentType', count: { $sum: 1 } } },
        { $sort:  { count: -1 } }
      ]),

      // breakdown by status
      Employee.aggregate([
        { $group: { _id: '$employmentStatus', count: { $sum: 1 } } },
        { $sort:  { count: -1 } }
      ]),

      // headcount per department
      Employee.aggregate([
        { $match: { employmentStatus: 'active' } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort:  { count: -1 } },
        {
          $lookup: {
            from:         'departments',
            localField:   '_id',
            foreignField: '_id',
            as:           'department'
          }
        },
        { $unwind: '$department' },
        {
          $project: {
            department: '$department.displayName',
            count:      1
          }
        }
      ]),

      // 5 most recent hires
      Employee.find({ employmentStatus: 'active' })
        .sort({ startDate: -1 })
        .limit(5)
        .populate('user',       'firstName lastName email')
        .populate('department', 'displayName')
        .select('employeeId jobTitle startDate')
        .lean(),

      // 5 most recent terminations
      Employee.find({ employmentStatus: 'terminated' })
        .sort({ endDate: -1 })
        .limit(5)
        .populate('user',       'firstName lastName email')
        .populate('department', 'displayName')
        .select('employeeId jobTitle endDate')
        .lean()
    ]);

    // monthly hires for the year — trend chart data
    const monthlyHires = await Employee.aggregate([
      { $match: { startDate: { $gte: startOfYear } } },
      {
        $group: {
          _id: {
            month: { $month: '$startDate' },
            year:  { $year:  '$startDate' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      {
        $project: {
          month: '$_id.month',
          year:  '$_id.year',
          count: 1,
          _id:   0
        }
      }
    ]);

    return {
      breakdown: {
        byEmploymentType:   formatAggregate(byEmploymentType),
        byEmploymentStatus: formatAggregate(byEmploymentStatus),
        byDepartment:       byDepartment.map(d => ({
          department: d.department,
          count:      d.count
        }))
      },
      trends: {
        monthlyHires
      },
      recent: {
        hires:        recentHires,
        terminations: recentTerminations
      }
    };
  },

  async getPayrollStats() {
    const now          = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear  = now.getFullYear();
    const lastMonth    = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear= currentMonth === 1 ? currentYear - 1 : currentYear;

    const [
      currentMonthStats,
      lastMonthStats,
      byStatus,
      salaryByDepartment,
      recentPayrolls
    ] = await Promise.all([
      // current month totals
      Payroll.aggregate([
        {
          $match: {
            'period.month': currentMonth,
            'period.year':  currentYear
          }
        },
        {
          $group: {
            _id:          null,
            totalGross:   { $sum: '$grossPay' },
            totalNet:     { $sum: '$netPay' },
            totalBasic:   { $sum: '$basicSalary' },
            count:        { $sum: 1 },
            avgNet:       { $avg: '$netPay' }
          }
        }
      ]),

      // last month totals for comparison
      Payroll.aggregate([
        {
          $match: {
            'period.month': lastMonth,
            'period.year':  lastMonthYear
          }
        },
        {
          $group: {
            _id:        null,
            totalGross: { $sum: '$grossPay' },
            totalNet:   { $sum: '$netPay' },
            count:      { $sum: 1 }
          }
        }
      ]),

      // breakdown by status
      Payroll.aggregate([
        {
          $match: {
            'period.month': currentMonth,
            'period.year':  currentYear
          }
        },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort:  { count: -1 } }
      ]),

      // average salary by department
      Employee.aggregate([
        { $match: { employmentStatus: 'active' } },
        {
          $group: {
            _id:       '$department',
            avgSalary: { $avg: '$salary.amount' },
            minSalary: { $min: '$salary.amount' },
            maxSalary: { $max: '$salary.amount' },
            headcount: { $sum: 1 }
          }
        },
        { $sort: { avgSalary: -1 } },
        {
          $lookup: {
            from:         'departments',
            localField:   '_id',
            foreignField: '_id',
            as:           'department'
          }
        },
        { $unwind: '$department' },
        {
          $project: {
            department: '$department.displayName',
            avgSalary:  { $round: ['$avgSalary', 0] },
            minSalary:  1,
            maxSalary:  1,
            headcount:  1
          }
        }
      ]),

      // 5 most recent payroll records
      Payroll.find({
        'period.month': currentMonth,
        'period.year':  currentYear
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('employee', 'employeeId jobTitle user')
        .select('basicSalary grossPay netPay status period')
        .lean()
    ]);

    const curr      = currentMonthStats[0] || {};
    const prev      = lastMonthStats[0]    || {};
    const netGrowth = prev.totalNet
      ? (((curr.totalNet - prev.totalNet) / prev.totalNet) * 100).toFixed(1)
      : 0;

    return {
      currentMonth: {
        period:     `${currentMonth}/${currentYear}`,
        totalGross: formatCurrency(curr.totalGross || 0),
        totalNet:   formatCurrency(curr.totalNet   || 0),
        totalBasic: formatCurrency(curr.totalBasic || 0),
        avgNet:     formatCurrency(curr.avgNet     || 0),
        processed:  curr.count || 0
      },
      comparison: {
        lastMonth:     `${lastMonth}/${lastMonthYear}`,
        lastMonthNet:  formatCurrency(prev.totalNet || 0),
        netGrowthPct:  `${netGrowth}%`,
        trend:         Number(netGrowth) >= 0 ? 'up' : 'down'
      },
      breakdown: {
        byStatus:          formatAggregate(byStatus),
        salaryByDepartment
      },
      recent: recentPayrolls
    };
  },

  async getLeaveStats() {
    const now          = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear  = new Date(now.getFullYear(), 0, 1);

    const [
      byStatus,
      byType,
      pendingLeaves,
      monthlyTrend,
      topDepartmentsByLeave
    ] = await Promise.all([
      // breakdown by status
      Leave.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort:  { count: -1 } }
      ]),

      // breakdown by type
      Leave.aggregate([
        { $match: { status: 'approved' } },
        {
          $group: {
            _id:       '$type',
            count:     { $sum: 1 },
            totalDays: { $sum: '$days' }
          }
        },
        { $sort: { totalDays: -1 } }
      ]),

      // pending leave requests — needs action
      Leave.find({ status: 'pending' })
        .sort({ createdAt: 1 }) // oldest first — most urgent
        .limit(10)
        .populate('employee', 'employeeId jobTitle user')
        .select('type startDate endDate days reason createdAt')
        .lean(),

      // monthly leave trend for the year
      Leave.aggregate([
        { $match: { createdAt: { $gte: startOfYear } } },
        {
          $group: {
            _id: {
              month: { $month: '$createdAt' },
              year:  { $year:  '$createdAt' }
            },
            count:     { $sum: 1 },
            totalDays: { $sum: '$days' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        {
          $project: {
            month:     '$_id.month',
            year:      '$_id.year',
            count:     1,
            totalDays: 1,
            _id:       0
          }
        }
      ]),

      // departments with most leave requests
      Leave.aggregate([
        { $match: { status: { $in: ['approved', 'pending'] } } },
        {
          $lookup: {
            from:         'employees',
            localField:   'employee',
            foreignField: '_id',
            as:           'employee'
          }
        },
        { $unwind: '$employee' },
        {
          $group: {
            _id:   '$employee.department',
            count: { $sum: 1 },
            days:  { $sum: '$days' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from:         'departments',
            localField:   '_id',
            foreignField: '_id',
            as:           'department'
          }
        },
        { $unwind: '$department' },
        {
          $project: {
            department: '$department.displayName',
            count:      1,
            days:       1
          }
        }
      ])
    ]);

    return {
      summary: {
        byStatus: formatAggregate(byStatus),
        byType:   byType.map(t => ({
          type:      t._id,
          count:     t.count,
          totalDays: t.totalDays
        }))
      },
      pending: {
        count:    pendingLeaves.length,
        requests: pendingLeaves
      },
      trends: {
        monthly: monthlyTrend
      },
      topDepartments: topDepartmentsByLeave
    };
  },

  async getActivityFeed() {
    const now           = new Date();
    const last24Hours   = new Date(now - 24 * 60 * 60 * 1000);
    const last7Days     = new Date(now - 7  * 24 * 60 * 60 * 1000);

    const [
      recentActivity,
      activityByResource,
      activityByStatus,
      suspiciousCount,
      hourlyTrend
    ] = await Promise.all([
      // last 10 actions
      AuditLog.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select('performedBy action resource status location device createdAt')
        .lean(),

      // activity breakdown by resource — last 7 days
      AuditLog.aggregate([
        { $match: { createdAt: { $gte: last7Days } } },
        { $group: { _id: '$resource', count: { $sum: 1 } } },
        { $sort:  { count: -1 } }
      ]),

      // activity breakdown by status — last 7 days
      AuditLog.aggregate([
        { $match: { createdAt: { $gte: last7Days } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort:  { count: -1 } }
      ]),

      // suspicious activity count — last 24 hours
      AuditLog.countDocuments({
        isSuspicious: true,
        createdAt:    { $gte: last24Hours }
      }),

      // hourly activity trend — last 24 hours
      AuditLog.aggregate([
        { $match: { createdAt: { $gte: last24Hours } } },
        {
          $group: {
            _id:   { $hour: '$createdAt' },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            hour:  '$_id',
            count: 1,
            _id:   0
          }
        }
      ])
    ]);

    return {
      recent:   recentActivity,
      last7Days: {
        byResource: formatAggregate(activityByResource),
        byStatus:   formatAggregate(activityByStatus)
      },
      alerts: {
        suspiciousLast24h: suspiciousCount
      },
      trends: {
        hourly: hourlyTrend
      }
    };
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-NG', {
    style:    'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(amount);
}

function formatAggregate(arr) {
  return arr.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});
}

module.exports = dashboardService;