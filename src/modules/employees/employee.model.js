const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    employeeId: {
      type: String,
      unique: true,
      trim: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },
    jobTitle: {
      type: String,
      trim: true,
      required: [true, "Job title is required"],
    },
    employmentType: {
      type: String,
      enum: ["full_time", "part_time", "contract", "intern"],
      default: "full_time",
    },
    employmentStatus: {
      type: String,
      enum: ["active", "suspended", "terminated", "resigned"],
      default: "active",
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date, // set when employment ends
    },
    salary: {
      amount: { type: Number, required: true },
      currency: { type: String, default: "USD" },
      frequency: {
        type: String,
        enum: ["monthly", "weekly", "biweekly"],
        default: "monthly",
      },
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
    bankDetails: {
      bankName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      accountName: { type: String, trim: true },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// auto-generate employeeId before saving
// employeeSchema.pre("save", async function (next) {
//   if (!this.isNew) return next();

//   const count = await mongoose.model("Employee").countDocuments();
//   this.employeeId = `EMP${String(count + 1).padStart(4, "0")}`;
//   next();
// });

employeeSchema.pre('save', async function (next) {
  if (!this.isNew) return next();

  try {
    let employeeId;
    let exists = true;
    let attempts = 0;

    while (exists && attempts < 5) {
      const last = await mongoose.model('Employee')
        .findOne({}, { employeeId: 1 })
        .sort({ employeeId: -1 })
        .lean();

      let nextNumber = 1;

      if (last?.employeeId) {
        const currentNumber = parseInt(last.employeeId.replace('EMP', ''), 10);
        if (!isNaN(currentNumber)) nextNumber = currentNumber + 1;
      }

      employeeId = `EMP${String(nextNumber).padStart(4, '0')}`;

      // verify it doesn't already exist
      exists = !!(await mongoose.model('Employee').findOne({ employeeId }).lean());
      attempts++;
    }

    this.employeeId = employeeId;
    next();

  } catch (err) {
    next(err);
  }
});

// employeeSchema.index({ user: 1 });
employeeSchema.index({ department: 1 });
// employeeSchema.index({ employeeId: 1 });

employeeSchema.index({ employmentStatus: 1 });
employeeSchema.index({ isActive: 1 });
employeeSchema.index({ createdAt: -1 });
employeeSchema.index({ department: 1, employmentStatus: 1 });
employeeSchema.index({ department: 1, employmentStatus: 1, employmentType: 1 });
employeeSchema.index({ manager: 1 });

module.exports = mongoose.model("Employee", employeeSchema);
