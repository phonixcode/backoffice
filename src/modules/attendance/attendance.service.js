const Attendance         = require('./attendance.model');
const AttendanceSettings = require('./attendance-settings.model');
const Employee           = require('../employees/employee.model');
const { createNotification } = require('../notifications/notification.service');

function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R    = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseTime(timeStr, referenceDate) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date(referenceDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

const attendanceService = {

  async getSettings() {
    let settings = await AttendanceSettings.findOne().lean();
    if (!settings) {
      settings = await AttendanceSettings.create({});
    }
    return settings;
  },

  async updateSettings(payload) {
    const settings = await AttendanceSettings.findOneAndUpdate(
      {},
      payload,
      { new: true, upsert: true }
    );
    return settings;
  },

  async clockIn(employee, payload, requestMeta) {
    const { lat, lng, accuracy, address, device } = payload;

    // check already clocked in today
    const today    = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existing = await Attendance.findOne({
      employee: employee._id,
      date:     { $gte: today, $lt: tomorrow }
    });

    if (existing) {
      if (!existing.clockOut?.time) {
        throw Object.assign(
          new Error('Already clocked in for today'),
          { statusCode: 400 }
        );
      }
      throw Object.assign(
        new Error('Already completed attendance for today'),
        { statusCode: 400 }
      );
    }

    const settings = await attendanceService.getSettings();
    const now      = new Date();

    // location validation
    if (settings.requireLocation && !settings.allowRemote) {
      if (!lat || !lng) {
        throw Object.assign(
          new Error('Location is required to clock in'),
          { statusCode: 400 }
        );
      }

      if (settings.officeLocation?.lat && settings.officeLocation?.lng) {
        const distance = getDistanceMeters(
          lat, lng,
          settings.officeLocation.lat,
          settings.officeLocation.lng
        );
        if (distance > settings.locationRadius) {
          throw Object.assign(
            new Error(`You are ${Math.round(distance)}m from the office. Must be within ${settings.locationRadius}m`),
            { statusCode: 400 }
          );
        }
      }
    }

    // late check
    const workStart   = parseTime(settings.workStartTime, now);
    const graceEnd    = new Date(workStart.getTime() + settings.graceMinutes * 60000);
    const isLate      = now > graceEnd;
    const lateMinutes = isLate ? Math.round((now - workStart) / 60000) : 0;

    const attendance = await Attendance.create({
      employee: employee._id,
      date:     today,
      clockIn: {
        time:     now,
        location: lat ? { lat, lng, accuracy, address } : undefined,
        ip:       requestMeta.ip,
        device:   device || requestMeta.userAgent
      },
      status:        isLate ? 'late' : 'present',
      isLate,
      lateByMinutes: lateMinutes
    });

    // notify HR if late
    if (isLate) {
      await createNotification({
        title:    'Late Clock-In',
        message:  `${employee.user.firstName} ${employee.user.lastName} clocked in ${lateMinutes} minutes late`,
        type:     'warning',
        target:   { type: 'role', value: 'hr_manager' },
        resource: 'attendance',
        resourceId: attendance._id
      });
    }

    return attendance;
  },

  async clockOut(employee, payload, requestMeta) {
    const { lat, lng, accuracy, address, device, notes } = payload;

    const today    = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const attendance = await Attendance.findOne({
      employee: employee._id,
      date:     { $gte: today, $lt: tomorrow }
    });

    if (!attendance) {
      throw Object.assign(
        new Error('No clock-in found for today'),
        { statusCode: 400 }
      );
    }

    if (attendance.clockOut?.time) {
      throw Object.assign(
        new Error('Already clocked out for today'),
        { statusCode: 400 }
      );
    }

    attendance.clockOut = {
      time:     new Date(),
      location: lat ? { lat, lng, accuracy, address } : undefined,
      ip:       requestMeta.ip,
      device:   device || requestMeta.userAgent
    };

    if (notes) attendance.notes = notes;

    await attendance.save();

    return attendance;
  },

  async getTodayStatus(employeeId) {
    const today    = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const attendance = await Attendance.findOne({
      employee: employeeId,
      date:     { $gte: today, $lt: tomorrow }
    }).lean();

    const settings = await attendanceService.getSettings();

    return {
      attendance,
      isClockedIn:   !!attendance && !attendance.clockOut?.time,
      isClockedOut:  !!attendance?.clockOut?.time,
      hasNotStarted: !attendance,
      settings: {
        workStartTime: settings.workStartTime,
        workEndTime:   settings.workEndTime,
        requireLocation: settings.requireLocation
      }
    };
  },

  async getAll(query) {
    const {
      page = 1, limit = 20,
      employeeId, department,
      startDate, endDate,
      status
    } = query;

    const filter = {};

    if (employeeId) filter.employee = employeeId;
    if (status)     filter.status   = status;

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate)   filter.date.$lte = new Date(endDate);
    }

    // filter by department via employee lookup
    let employeeIds;
    if (department) {
      const employees = await Employee
        .find({ department }, { _id: 1 })
        .lean();
      employeeIds = employees.map(e => e._id);
      filter.employee = { $in: employeeIds };
    }

    const [records, total] = await Promise.all([
      Attendance.find(filter)
        .populate({
          path:   'employee',
          select: 'employeeId jobTitle user department',
          populate: [
            { path: 'user',       select: 'firstName lastName email' },
            { path: 'department', select: 'displayName' }
          ]
        })
        .sort({ date: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Attendance.countDocuments(filter)
    ]);

    return {
      records,
      pagination: {
        total,
        page:    Number(page),
        limit:   Number(limit),
        pages:   Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  },

  async getEmployeeSummary(employeeId, month, year) {
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 0, 23, 59, 59);

    const records = await Attendance.find({
      employee: employeeId,
      date:     { $gte: start, $lte: end }
    }).lean();

    const totalDays     = records.length;
    const presentDays   = records.filter(r => r.status === 'present').length;
    const lateDays      = records.filter(r => r.status === 'late').length;
    const absentDays    = records.filter(r => r.status === 'absent').length;
    const totalMinutes  = records.reduce((s, r) => s + (r.duration       || 0), 0);
    const totalOvertime = records.reduce((s, r) => s + (r.overtimeMinutes || 0), 0);

    return {
      month, year,
      totalDays,
      presentDays,
      lateDays,
      absentDays,
      totalHours:    (totalMinutes  / 60).toFixed(1),
      overtimeHours: (totalOvertime / 60).toFixed(1),
      attendanceRate: totalDays
        ? ((presentDays + lateDays) / totalDays * 100).toFixed(1)
        : '0',
      records
    };
  },

  async getDepartmentSummary(date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const records = await Attendance.find({
      date: { $gte: start, $lte: end }
    })
      .populate({
        path:   'employee',
        select: 'department',
        populate: { path: 'department', select: 'displayName' }
      })
      .lean();

    const grouped = records.reduce((acc, r) => {
      const dept = r.employee?.department?.displayName ?? 'Unknown';
      if (!acc[dept]) {
        acc[dept] = { present: 0, late: 0, absent: 0, total: 0 };
      }
      acc[dept].total++;
      acc[dept][r.status] = (acc[dept][r.status] || 0) + 1;
      return acc;
    }, {});

    return grouped;
  }
};

module.exports = attendanceService;