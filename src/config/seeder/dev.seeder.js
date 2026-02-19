const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const connectDB = require('../db');
const User = require('../../modules/users/user.model');
const Role = require('../../modules/roles/role.model');
const Resource = require('../../modules/resources/resource.model');
const Permission = require('../../modules/permissions/permission.model');
const Department = require('../../modules/departments/department.model');
const Employee = require('../../modules/employees/employee.model');
const Payroll = require('../../modules/payroll/payroll.model');
const Leave = require('../../modules/leave/leave.model');
const AuditLog = require('../../modules/audit/auditLog.model');
const bcrypt = require('bcryptjs');

const SEED_EMPLOYEES = Math.max(1, parseInt(process.env.SEED_EMPLOYEES || '1500', 10));
const SEED_AUDIT_LOGS = Math.max(0, parseInt(process.env.SEED_AUDIT_LOGS || '2000', 10));
const SEED_BULK_BATCH_SIZE = Math.min(50000, Math.max(1000, parseInt(process.env.SEED_BULK_BATCH_SIZE || '10000', 10)));
const FIXED_ROLES_COUNT = 25;

// ─── Nigerian Context ───────────────────────────────────────────────────────

const NIGERIAN_STATES = [
  'Lagos', 'Abuja', 'Rivers', 'Kano', 'Oyo', 'Delta',
  'Anambra', 'Enugu', 'Kaduna', 'Ogun', 'Ondo', 'Edo'
];

const NIGERIAN_CITIES = {
  Lagos:   ['Lagos Island', 'Ikeja', 'Lekki', 'Victoria Island', 'Surulere', 'Yaba'],
  Abuja:   ['Garki', 'Wuse', 'Maitama', 'Asokoro', 'Gwarinpa'],
  Rivers:  ['Port Harcourt', 'Obio-Akpor', 'Eleme'],
  Kano:    ['Kano Municipal', 'Nassarawa', 'Gwale'],
  Oyo:     ['Ibadan North', 'Ibadan South', 'Ogbomosho'],
  Delta:   ['Warri', 'Asaba', 'Sapele'],
  Anambra: ['Onitsha', 'Awka', 'Nnewi'],
  Enugu:   ['Enugu', 'Nsukka', 'Agbani'],
  Kaduna:  ['Kaduna', 'Zaria', 'Kafanchan'],
  Ogun:    ['Abeokuta', 'Sagamu', 'Ijebu-Ode'],
  Ondo:    ['Akure', 'Ondo', 'Owo'],
  Edo:     ['Benin City', 'Auchi', 'Ekpoma']
};

const NIGERIAN_BANKS = [
  'GTBank', 'Access Bank', 'Zenith Bank', 'First Bank',
  'UBA', 'Fidelity Bank', 'Sterling Bank', 'Stanbic IBTC',
  'Union Bank', 'Polaris Bank', 'Wema Bank', 'Keystone Bank'
];

const NIGERIAN_MALE_NAMES = [
  'Chukwuemeka', 'Oluwaseun', 'Babatunde', 'Adebayo', 'Emeka',
  'Chidi', 'Tunde', 'Segun', 'Biodun', 'Kelechi', 'Ifeanyi',
  'Uche', 'Gbenga', 'Rotimi', 'Femi', 'Dele', 'Kunle', 'Wale',
  'Obinna', 'Chibuike', 'Nnamdi', 'Onyeka', 'Sola', 'Tobi', 'Dayo'
];

const NIGERIAN_FEMALE_NAMES = [
  'Adaeze', 'Ngozi', 'Chioma', 'Funmilayo', 'Amaka', 'Blessing',
  'Chiamaka', 'Nneka', 'Yetunde', 'Folake', 'Bukola', 'Shade',
  'Ifeoma', 'Chinwe', 'Temitope', 'Abimbola', 'Oluwakemi', 'Aisha',
  'Fatima', 'Halima', 'Zainab', 'Ronke', 'Tolu', 'Yemi', 'Bisi'
];

const NIGERIAN_LAST_NAMES = [
  'Okonkwo', 'Adeleke', 'Babangida', 'Okafor', 'Adeyemi',
  'Nwosu', 'Ibrahim', 'Abubakar', 'Eze', 'Chukwu', 'Obi',
  'Bello', 'Musa', 'Aliyu', 'Lawal', 'Ogundimu', 'Nzeogwu',
  'Okeke', 'Onyekwere', 'Taiwo', 'Kehinde', 'Dike', 'Odu',
  'Nwachukwu', 'Olawale', 'Adegoke', 'Salami', 'Fagbemi'
];

// ─── Department Salary Ranges (NGN) ─────────────────────────────────────────

const DEPT_SALARY_RANGES = {
  executive:        { min: 800000,  max: 2000000 },
  engineering:      { min: 400000,  max: 900000  },
  devops:           { min: 350000,  max: 800000  },
  product:          { min: 350000,  max: 750000  },
  design:           { min: 250000,  max: 600000  },
  finance:          { min: 250000,  max: 550000  },
  legal:            { min: 300000,  max: 700000  },
  marketing:        { min: 200000,  max: 450000  },
  sales:            { min: 200000,  max: 500000  },
  hr:               { min: 200000,  max: 400000  },
  operations:       { min: 150000,  max: 350000  },
  'customer support':{ min: 120000, max: 280000  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNigerianName(gender) {
  const first = gender === 'male'
    ? faker.helpers.arrayElement(NIGERIAN_MALE_NAMES)
    : faker.helpers.arrayElement(NIGERIAN_FEMALE_NAMES);
  const last = faker.helpers.arrayElement(NIGERIAN_LAST_NAMES);
  return { firstName: first, lastName: last };
}

function getNigerianPhone() {
  const prefixes = ['0803', '0806', '0813', '0816', '0703',
                    '0706', '0813', '0903', '0906', '0805'];
  const prefix = faker.helpers.arrayElement(prefixes);
  const number = faker.string.numeric(7);
  return `+234${prefix.slice(1)}${number}`;
}

function getNigerianAddress() {
  const state = faker.helpers.arrayElement(NIGERIAN_STATES);
  const cities = NIGERIAN_CITIES[state];
  const city = faker.helpers.arrayElement(cities);
  return {
    street:  `${faker.number.int({ min: 1, max: 200 })} ${faker.person.lastName()} Street`,
    city,
    state,
    country: 'Nigeria',
    zipCode: faker.string.numeric(6)
  };
}

function getSalaryForDept(deptName) {
  const key = deptName.toLowerCase();
  const range = DEPT_SALARY_RANGES[key] || DEPT_SALARY_RANGES['operations'];
  return faker.number.int({ min: range.min, max: range.max });
}

function getNigerianBank() {
  return faker.helpers.arrayElement(NIGERIAN_BANKS);
}

function getAccountNumber() {
  return faker.string.numeric(10);
}

// batch insert helper — splits large arrays into chunks
async function batchInsert(Model, records, batchSize = 200) {
  let inserted = 0;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await Model.insertMany(batch, { ordered: false });
    inserted += batch.length;
    process.stdout.write(`\r  → Inserted ${inserted}/${records.length}`);
  }
  console.log(); // newline after progress
}

// ─── Seed Functions ───────────────────────────────────────────────────────────

const DEFAULT_ACTIONS = ['create', 'read', 'update', 'delete', 'list'];

const INITIAL_RESOURCES = [
  { name: 'employees',   displayName: 'Employees',        description: 'Manage company employees',     isSystem: false },
  { name: 'departments', displayName: 'Departments',       description: 'Manage company departments',   isSystem: false },
  { name: 'payroll',     displayName: 'Payroll',           description: 'Manage employee payroll',      isSystem: false },
  { name: 'leave',       displayName: 'Leave',             description: 'Manage employee leave',        isSystem: false },
  { name: 'resources',   displayName: 'Resources',         description: 'Manage system resources',      isSystem: true  },
  { name: 'roles',       displayName: 'Roles',             description: 'Manage system roles',          isSystem: true  },
  { name: 'users',       displayName: 'Users',             description: 'Manage system users',          isSystem: true  },
  { name: 'audit',       displayName: 'Audit Logs',        description: 'View system audit logs',       isSystem: true  },
];

const CUSTOM_ACTIONS = {
  payroll:   [
    { action: 'process',   description: 'Process payroll for a period' },
    { action: 'approve',   description: 'Approve a payroll run' }
  ],
  leave:     [
    { action: 'approve',   description: 'Approve a leave request' },
    { action: 'reject',    description: 'Reject a leave request' }
  ],
  employees: [
    { action: 'terminate', description: 'Terminate an employee' }
  ]
};

const DEPARTMENTS = [
  { name: 'engineering',       displayName: 'Engineering',       description: 'Software engineering' },
  { name: 'devops',            displayName: 'DevOps',            description: 'Infrastructure and DevOps' },
  { name: 'product',           displayName: 'Product',           description: 'Product management' },
  { name: 'design',            displayName: 'Design',            description: 'UI/UX design' },
  { name: 'finance',           displayName: 'Finance',           description: 'Finance and accounts' },
  { name: 'legal',             displayName: 'Legal',             description: 'Legal and compliance' },
  { name: 'marketing',         displayName: 'Marketing',         description: 'Marketing and growth' },
  { name: 'sales',             displayName: 'Sales',             description: 'Sales and business development' },
  { name: 'hr',                displayName: 'Human Resources',   description: 'People and culture' },
  { name: 'operations',        displayName: 'Operations',        description: 'Business operations' },
  { name: 'customer support',  displayName: 'Customer Support',  description: 'Customer success' },
  { name: 'executive',         displayName: 'Executive',         description: 'Executive leadership' }
];

// ─── Step 1: Resources & Permissions ─────────────────────────────────────────

async function seedResources() {
  console.log('\n Seeding resources and permissions...');

  const allPermissions = [];

  for (const resourceData of INITIAL_RESOURCES) {
    let resource = await Resource.findOne({ name: resourceData.name });

    if (!resource) {
      resource = await Resource.create(resourceData);
      console.log(`   Created resource: ${resource.name}`);
    } else {
      console.log(`  Skipping resource: ${resource.name}`);
    }

    const existingPerms = await Permission.countDocuments({ resource: resource._id });
    if (existingPerms > 0) {
      const perms = await Permission.find({ resource: resource._id });
      allPermissions.push(...perms);
      continue;
    }

    // CRUD permissions
    const crudPerms = DEFAULT_ACTIONS.map(action => ({
      resource:     resource._id,
      resourceName: resource.name,
      action,
      name:         `${resource.name}:${action}`,
      type:         'crud',
      description:  `${action} ${resource.displayName}`
    }));

    // custom permissions — this was missing before
    const customPerms = (CUSTOM_ACTIONS[resource.name] || []).map(p => ({
      resource:     resource._id,
      resourceName: resource.name,
      action:       p.action,
      name:         `${resource.name}:${p.action}`,
      type:         'custom',
      description:  p.description
    }));

    const created = await Permission.insertMany([...crudPerms, ...customPerms]);
    allPermissions.push(...created);
    console.log(`  → ${created.length} permissions created for ${resource.name}`);
  }

  return allPermissions;
}

// ─── Step 2: Roles ────────────────────────────────────────────────────────────

async function seedRoles(allPermissions) {
  console.log('\n👥 Seeding roles...');

  const getPerms = (...names) =>
    allPermissions.filter(p => names.includes(p.name)).map(p => p._id);

  const getResourcePerms = (resource, actions) =>
    allPermissions
      .filter(p => p.resourceName === resource && actions.includes(p.action))
      .map(p => p._id);

  const roleDefs = [
    {
      name:        'super_admin',
      displayName: 'Super Admin',
      description: 'Full system access',
      permissions: allPermissions.map(p => p._id),
      isDefault:   false
    },
    {
      name:        'hr_manager',
      displayName: 'HR Manager',
      description: 'Manages employees, departments and leave',
      permissions: [
        ...getResourcePerms('employees',   ['create', 'read', 'update', 'list', 'terminate']),
        ...getResourcePerms('departments', ['create', 'read', 'update', 'delete', 'list']),
        ...getResourcePerms('leave',       ['read', 'list', 'approve', 'reject']),
        ...getResourcePerms('users',       ['create', 'read', 'update', 'list'])
      ],
      isDefault: false
    },
    {
      name:        'finance_manager',
      displayName: 'Finance Manager',
      description: 'Manages payroll and financial operations',
      permissions: [
        ...getResourcePerms('payroll',   ['create', 'read', 'update', 'list', 'process', 'approve']),
        ...getResourcePerms('employees', ['read', 'list']),
      ],
      isDefault: false
    },
    {
      name:        'dept_manager',
      displayName: 'Department Manager',
      description: 'Manages their department team',
      permissions: [
        ...getResourcePerms('employees',   ['read', 'update', 'list']),
        ...getResourcePerms('leave',       ['read', 'list', 'approve', 'reject']),
        ...getResourcePerms('departments', ['read'])
      ],
      isDefault: false
    },
    {
      name:        'senior_employee',
      displayName: 'Senior Employee',
      description: 'Senior staff with extended access',
      permissions: [
        ...getResourcePerms('employees',   ['read', 'list']),
        ...getResourcePerms('leave',       ['create', 'read', 'list']),
        ...getResourcePerms('payroll',     ['read']),
        ...getResourcePerms('departments', ['read', 'list'])
      ],
      isDefault: false
    },
    {
      name:        'employee',
      displayName: 'Employee',
      description: 'Basic employee access',
      permissions: [
        ...getResourcePerms('leave',       ['create', 'read', 'list']),
        ...getResourcePerms('employees',   ['read']),
        ...getResourcePerms('departments', ['read'])
      ],
      isDefault: true
    },
    {
      name:        'auditor',
      displayName: 'Auditor',
      description: 'Read-only access to audit logs and reports',
      permissions: [
        ...getResourcePerms('audit',       ['read', 'list']),
        ...getResourcePerms('employees',   ['read', 'list']),
        ...getResourcePerms('payroll',     ['read', 'list']),
        ...getResourcePerms('leave',       ['read', 'list']),
        ...getResourcePerms('departments', ['read', 'list'])
      ],
      isDefault: false
    },
    {
      name:        'intern',
      displayName: 'Intern',
      description: 'Minimal read-only access',
      permissions: [
        ...getResourcePerms('employees',   ['read']),
        ...getResourcePerms('departments', ['read', 'list'])
      ],
      isDefault: false
    }
  ];

  const roles = {};

  for (const roleDef of roleDefs) {
    let role = await Role.findOne({ name: roleDef.name });

    if (!role) {
      role = await Role.create(roleDef);
      console.log(`  Created role: ${role.name}`);
    } else {
      console.log(`  Skipping role: ${role.name}`);
    }

    roles[roleDef.name] = role;
  }

  return roles;
}

// ─── Step 3: Departments ──────────────────────────────────────────────────────

async function seedDepartments() {
  console.log('\n Seeding departments...');

  const departments = {};

  for (const deptData of DEPARTMENTS) {
    let dept = await Department.findOne({ name: deptData.name });

    if (!dept) {
      dept = await Department.create(deptData);
      console.log(`  Created department: ${dept.displayName}`);
    } else {
      console.log(`   Skipping department: ${dept.displayName}`);
    }

    departments[deptData.name] = dept;
  }

  return departments;
}

// ─── Step 4: Users & Employees ───────────────────────────────────────────────

async function seedUsersAndEmployees(roles, departments) {
  console.log('\n Seeding users and employees...');

  const existingCount = await User.countDocuments({ email: { $ne: 'superadmin@backoffice.com' } });
  if (existingCount >= SEED_EMPLOYEES - 1) {
    console.log('  Users already seeded — skipping');
    return Employee.find().lean();
  }

  const deptList = Object.values(departments);
  const hashedPassword = await bcrypt.hash('Password@123', 12);

  const rolePerms = {};
  for (const [key, role] of Object.entries(roles)) {
    rolePerms[key] = await getPermissionNames(role.permissions);
  }

  let superAdmin = await User.findOne({ email: 'superadmin@backoffice.com' });
  if (!superAdmin) {
    superAdmin = await User.create({
      firstName:        'Super',
      lastName:         'Admin',
      email:            'superadmin@backoffice.com',
      password:         'Password@123',
      roles:            [roles['super_admin']._id],
      permissionsCache: rolePerms['super_admin'] || [],
      isActive: true
    });
    console.log('  Super admin created');
  }

  // track all created employees
  const allEmployees = [];
  let employeeCounter = await Employee.countDocuments() + 1;

  // ── Helper to create user + employee ──
  async function createUserEmployee({
    firstName, lastName, email, roleKey,
    department, jobTitle, salaryOverride
  }) {
    const permCache = rolePerms[roleKey] || [];
    await User.collection.insertOne({
      firstName,
      lastName,
      email,
      password:         hashedPassword,
      roles:            [roles[roleKey]._id],
      permissionsCache: permCache,
      isActive:         true,
      tokenVersion:     0,
      createdAt:        new Date(),
      updatedAt:        new Date()
    });

    const savedUser = await User.findOne({ email });
    const gender    = faker.helpers.arrayElement(['male', 'female']);
    const deptName  = department.name.toLowerCase();
    const salary    = salaryOverride || getSalaryForDept(deptName);

    const employee = {
      user:         savedUser._id,
      employeeId:   `EMP${String(employeeCounter).padStart(4, '0')}`,
      department:   department._id,
      jobTitle,
      employmentType: faker.helpers.arrayElement(['full_time', 'full_time', 'full_time', 'contract']),
      employmentStatus: 'active',
      startDate:    faker.date.between({ from: '2020-01-01', to: '2024-01-01' }),
      salary: {
        amount:    salary,
        currency:  'NGN',
        frequency: 'monthly'
      },
      phone:   getNigerianPhone(),
      address: getNigerianAddress(),
      emergencyContact: {
        name:         getNigerianName(gender === 'male' ? 'female' : 'male').firstName + ' ' +
                      faker.helpers.arrayElement(NIGERIAN_LAST_NAMES),
        relationship: faker.helpers.arrayElement(['Spouse', 'Parent', 'Sibling', 'Friend']),
        phone:        getNigerianPhone()
      },
      bankDetails: {
        bankName:      getNigerianBank(),
        accountNumber: getAccountNumber(),
        accountName:   `${firstName} ${lastName}`
      },
      isActive: true
    };

    employeeCounter++;
    return { user: savedUser, employee };
  }

  const userBatch    = [];
  const employeeBatch = [];

  // ── HR Managers (5) ──
  console.log('  → Creating HR managers...');
  const hrDept = departments['hr'];
  for (let i = 0; i < 5; i++) {
    const gender = faker.helpers.arrayElement(['male', 'female']);
    const { firstName, lastName } = getNigerianName(gender);
    const email = `hr.manager${i + 1}@backoffice.ng`;

    const exists = await User.findOne({ email });
    if (exists) continue;

    const { user, employee } = await createUserEmployee({
      firstName, lastName, email,
      roleKey:    'hr_manager',
      department: hrDept,
      jobTitle:   'HR Manager'
    });
    allEmployees.push({ ...employee, _userId: user._id });
  }

  // ── Finance Managers (5) ──
  console.log('  → Creating finance managers...');
  const financeDept = departments['finance'];
  for (let i = 0; i < 5; i++) {
    const gender = faker.helpers.arrayElement(['male', 'female']);
    const { firstName, lastName } = getNigerianName(gender);
    const email = `finance.manager${i + 1}@backoffice.ng`;

    const exists = await User.findOne({ email });
    if (exists) continue;

    const { user, employee } = await createUserEmployee({
      firstName, lastName, email,
      roleKey:    'finance_manager',
      department: financeDept,
      jobTitle:   'Finance Manager'
    });
    allEmployees.push({ ...employee, _userId: user._id });
  }

  // ── Department Managers (one per dept) ──
  console.log('  → Creating department managers...');
  for (const dept of deptList) {
    const gender = faker.helpers.arrayElement(['male', 'female']);
    const { firstName, lastName } = getNigerianName(gender);
    const email = `${dept.name.replace(' ', '.')}.head@backoffice.ng`;

    const exists = await User.findOne({ email });
    if (exists) continue;

    const { user, employee } = await createUserEmployee({
      firstName, lastName, email,
      roleKey:    'dept_manager',
      department: dept,
      jobTitle:   `Head of ${dept.displayName}`
    });
    allEmployees.push({ ...employee, _userId: user._id });
  }

  // ── Auditors (3) ──
  console.log('  → Creating auditors...');
  for (let i = 0; i < 3; i++) {
    const gender = faker.helpers.arrayElement(['male', 'female']);
    const { firstName, lastName } = getNigerianName(gender);
    const email = `auditor${i + 1}@backoffice.ng`;

    const exists = await User.findOne({ email });
    if (exists) continue;

    const { user, employee } = await createUserEmployee({
      firstName, lastName, email,
      roleKey:    'auditor',
      department: departments['finance'],
      jobTitle:   'Internal Auditor'
    });
    allEmployees.push({ ...employee, _userId: user._id });
  }

  const JOB_TITLES = {
    engineering:      ['Senior Software Engineer', 'Lead Engineer', 'Principal Engineer', 'Tech Lead'],
    devops:           ['Senior DevOps Engineer', 'Cloud Architect', 'Infrastructure Lead'],
    product:          ['Senior Product Manager', 'Product Lead', 'Principal PM'],
    design:           ['Senior UI/UX Designer', 'Lead Designer', 'Design Lead'],
    finance:          ['Senior Accountant', 'Financial Analyst', 'Finance Lead'],
    legal:            ['Senior Legal Counsel', 'Compliance Manager', 'Legal Lead'],
    marketing:        ['Senior Marketing Manager', 'Brand Lead', 'Growth Lead'],
    sales:            ['Senior Sales Manager', 'Account Executive', 'Sales Lead'],
    hr:               ['Senior HR Manager', 'Talent Acquisition Lead', 'People Lead'],
    operations:       ['Senior Operations Manager', 'Process Lead', 'Ops Lead'],
    'customer support': ['Senior Support Manager', 'Customer Success Lead'],
    executive:        ['Chief of Staff', 'Executive Assistant', 'Strategy Lead']
  };

  const REGULAR_JOB_TITLES = {
    engineering:      ['Software Engineer', 'Backend Engineer', 'Frontend Engineer', 'Mobile Engineer', 'QA Engineer'],
    devops:           ['DevOps Engineer', 'Cloud Engineer', 'Systems Administrator'],
    product:          ['Product Manager', 'Business Analyst', 'Product Analyst'],
    design:           ['UI Designer', 'UX Designer', 'Graphic Designer', 'Visual Designer'],
    finance:          ['Accountant', 'Finance Officer', 'Accounts Payable', 'Treasury Analyst'],
    legal:            ['Legal Officer', 'Compliance Officer', 'Contract Specialist'],
    marketing:        ['Marketing Executive', 'Content Writer', 'Social Media Manager', 'SEO Specialist'],
    sales:            ['Sales Executive', 'Business Development Officer', 'Account Manager'],
    hr:               ['HR Officer', 'Recruiter', 'Payroll Officer', 'HR Coordinator'],
    operations:       ['Operations Officer', 'Admin Officer', 'Facility Manager'],
    'customer support': ['Support Agent', 'Customer Success Officer', 'Help Desk Agent'],
    executive:        ['Executive Officer', 'Corporate Affairs Officer']
  };

  const bulkSeniorCount = Math.min(200, Math.floor((SEED_EMPLOYEES - FIXED_ROLES_COUNT) * 0.15));
  const bulkRegularCount = SEED_EMPLOYEES - FIXED_ROLES_COUNT - bulkSeniorCount;
  const seniorPerms = rolePerms['senior_employee'] || [];
  const employeePerms = rolePerms['employee'] || [];
  const internPerms = rolePerms['intern'] || [];

  async function insertBulkUsersAndEmployees({ count, roleKey, jobTitlesMap, isSenior }) {
    const emails = [];
    const userDocs = [];
    const employeeDocs = [];
    const getPerms = (intern) => (intern ? internPerms : employeePerms);
    const getRoleKey = (intern) => (intern ? 'intern' : 'employee');

    for (let i = 0; i < count; i++) {
      const dept = faker.helpers.arrayElement(deptList);
      const gender = faker.helpers.arrayElement(['male', 'female']);
      const { firstName, lastName } = getNigerianName(gender);
      const email = `seed.${roleKey}.${employeeCounter + i}@backoffice.ng`;
      emails.push(email);

      const titles = jobTitlesMap[dept.name.toLowerCase()] || (isSenior ? ['Senior Associate'] : ['Associate']);
      const jobTitle = faker.helpers.arrayElement(titles);
      const salary = isSenior
        ? getSalaryForDept(dept.name)
        : Math.round(getSalaryForDept(dept.name) * 0.7);

      const isTerminated = isSenior ? false : faker.datatype.boolean({ probability: 0.05 });
      const isIntern = isSenior ? false : faker.datatype.boolean({ probability: 0.08 });
      const roleId = isSenior ? roles['senior_employee']._id : roles[getRoleKey(isIntern)]._id;
      const permCache = isSenior ? seniorPerms : getPerms(isIntern);

      userDocs.push({
        firstName,
        lastName,
        email,
        password:         hashedPassword,
        roles:            [roleId],
        permissionsCache: permCache,
        isActive:         !isTerminated,
        tokenVersion:     0,
        createdAt:        isSenior ? new Date() : faker.date.between({ from: '2020-01-01', to: '2024-06-01' }),
        updatedAt:        new Date()
      });

      const empIdLen = Math.max(6, String(SEED_EMPLOYEES).length);
      employeeDocs.push({
        employeeId:       `EMP${String(employeeCounter + i).padStart(empIdLen, '0')}`,
        department:       dept._id,
        jobTitle,
        employmentType:   isSenior ? 'full_time' : (isIntern ? 'intern' : faker.helpers.arrayElement(['full_time', 'full_time', 'contract'])),
        employmentStatus: isTerminated ? 'terminated' : 'active',
        startDate:        faker.date.between({ from: isSenior ? '2019-01-01' : '2020-01-01', to: '2024-06-01' }),
        endDate:          isTerminated ? faker.date.between({ from: '2023-01-01', to: '2024-12-01' }) : undefined,
        salary:           { amount: salary, currency: 'NGN', frequency: 'monthly' },
        phone:            getNigerianPhone(),
        address:          getNigerianAddress(),
        emergencyContact: {
          name:         `${getNigerianName(gender).firstName} ${faker.helpers.arrayElement(NIGERIAN_LAST_NAMES)}`,
          relationship: faker.helpers.arrayElement(['Spouse', 'Parent', 'Sibling', 'Friend']),
          phone:        getNigerianPhone()
        },
        bankDetails: {
          bankName:      getNigerianBank(),
          accountNumber: getAccountNumber(),
          accountName:   `${firstName} ${lastName}`
        },
        isActive: !isTerminated
      });
    }

    await User.collection.insertMany(userDocs, { ordered: false });
    const users = await User.find({ email: { $in: emails } }).lean();
    const emailToUser = Object.fromEntries(users.map((u) => [u.email, u]));
    employeeDocs.forEach((emp, idx) => {
      emp.user = emailToUser[emails[idx]]?._id;
    });
    await batchInsert(Employee, employeeDocs.filter((e) => e.user));
    employeeCounter += count;
  }

  if (bulkSeniorCount > 0) {
    console.log(`  → Creating senior employees (${bulkSeniorCount})...`);
    for (let offset = 0; offset < bulkSeniorCount; offset += SEED_BULK_BATCH_SIZE) {
      const batchSize = Math.min(SEED_BULK_BATCH_SIZE, bulkSeniorCount - offset);
      await insertBulkUsersAndEmployees({
        count:        batchSize,
        roleKey:      'senior',
        jobTitlesMap: JOB_TITLES,
        isSenior:     true
      });
      process.stdout.write(`\r  → Senior: ${Math.min(offset + SEED_BULK_BATCH_SIZE, bulkSeniorCount)}/${bulkSeniorCount}`);
    }
    console.log();
  }

  if (bulkRegularCount > 0) {
    console.log(`  → Creating regular employees (${bulkRegularCount})...`);
    for (let offset = 0; offset < bulkRegularCount; offset += SEED_BULK_BATCH_SIZE) {
      const batchSize = Math.min(SEED_BULK_BATCH_SIZE, bulkRegularCount - offset);
      await insertBulkUsersAndEmployees({
        count:        batchSize,
        roleKey:      'reg',
        jobTitlesMap: REGULAR_JOB_TITLES,
        isSenior:     false
      });
      process.stdout.write(`\r  → Regular: ${Math.min(offset + SEED_BULK_BATCH_SIZE, bulkRegularCount)}/${bulkRegularCount}`);
    }
    console.log();
  }

  // assign managers to departments
  console.log('  → Assigning department heads...');
  const allEmp = await Employee.find({ employmentStatus: 'active' }).lean();
  for (const dept of deptList) {
    const deptEmployees = allEmp.filter(e => e.department.toString() === dept._id.toString());
    if (deptEmployees.length > 0) {
      const head = faker.helpers.arrayElement(deptEmployees);
      await Department.findByIdAndUpdate(dept._id, { head: head._id });
    }
  }

  console.log(`\n   Total employees created: ${employeeCounter - 1}`);
  return await Employee.find().lean();
}

// ─── Step 5: Payroll ──────────────────────────────────────────────────────────

const PAYROLL_MONTHS = [
  { month: 10, year: 2024 },
  { month: 11, year: 2024 },
  { month: 12, year: 2024 }
];

async function seedPayroll(employees) {
  console.log('\n💰 Seeding payroll (3 months)...');

  const superAdmin = await User.findOne({ email: 'superadmin@backoffice.com' });
  const financeManager = await User.findOne({ email: 'finance.manager1@backoffice.ng' });
  const activeEmployees = employees.filter((e) => e.employmentStatus === 'active');
  const expectedPayrollCount = activeEmployees.length * PAYROLL_MONTHS.length;
  const existingCount = await Payroll.countDocuments();

  if (existingCount >= expectedPayrollCount) {
    console.log('  Payroll already seeded — skipping');
    return;
  }

  for (const period of PAYROLL_MONTHS) {
    console.log(`  → Processing payroll for ${period.month}/${period.year}...`);
    for (let i = 0; i < activeEmployees.length; i += SEED_BULK_BATCH_SIZE) {
      const chunk = activeEmployees.slice(i, i + SEED_BULK_BATCH_SIZE);
      const payrollBatch = chunk.map((emp) => {
        const basicSalary = emp.salary?.amount || 200000;
        const allowances = [
          { name: 'Housing Allowance',   amount: Math.round(basicSalary * 0.2) },
          { name: 'Transport Allowance', amount: Math.round(basicSalary * 0.1) },
          { name: 'Meal Allowance',      amount: Math.round(basicSalary * 0.05) }
        ];
        const deductions = [
          { name: 'PAYE Tax',          amount: Math.round(basicSalary * 0.15) },
          { name: 'Pension (Employee)', amount: Math.round(basicSalary * 0.08) },
          { name: 'NHF',               amount: Math.round(basicSalary * 0.025) }
        ];
        if (faker.datatype.boolean({ probability: 0.2 })) {
          allowances.push({
            name:   'Performance Bonus',
            amount: Math.round(basicSalary * faker.number.float({ min: 0.05, max: 0.25 }))
          });
        }
        const totalAllowances = allowances.reduce((s, a) => s + a.amount, 0);
        const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);
        const grossPay = basicSalary + totalAllowances;
        const netPay = grossPay - totalDeductions;
        const status = faker.helpers.weightedArrayElement([
          { weight: 5,  value: 'draft' },
          { weight: 10, value: 'pending_approval' },
          { weight: 25, value: 'approved' },
          { weight: 60, value: 'paid' }
        ]);
        return {
          employee:    emp._id,
          period,
          basicSalary,
          allowances,
          deductions,
          grossPay,
          netPay,
          currency:    'NGN',
          status,
          processedBy: superAdmin._id,
          approvedBy:  ['approved', 'paid'].includes(status) ? financeManager?._id : undefined,
          paidAt:      status === 'paid' ? faker.date.between({
            from: new Date(period.year, period.month - 1, 25),
            to:   new Date(period.year, period.month - 1, 30)
          }) : undefined
        };
      });
      await batchInsert(Payroll, payrollBatch);
    }
    console.log(`  Payroll for ${period.month}/${period.year} done`);
  }
}

// ─── Step 6: Leave Requests ───────────────────────────────────────────────────

const LEAVE_REASONS = [
  'Annual family vacation', 'Medical appointment and recovery', 'Personal matters',
  'Wedding ceremony attendance', 'Bereavement leave', 'Religious observance',
  'Child care responsibilities', 'Home renovation emergency', 'Maternity leave', 'Paternity leave'
];
const LEAVE_REJECT_REASONS = [
  'Insufficient leave balance', 'Critical project deadline',
  'Team understaffed during period', 'Please reschedule to a less busy period'
];

async function seedLeaveRequests(employees) {
  console.log('\n🌴 Seeding leave requests...');

  const superAdmin = await User.findOne({ email: 'superadmin@backoffice.com' });
  const activeEmployees = employees.filter((e) => e.employmentStatus === 'active');
  const minLeaveCount = activeEmployees.length;
  const existingCount = await Leave.countDocuments();

  if (existingCount >= minLeaveCount) {
    console.log('  Leave requests already seeded — skipping');
    return;
  }

  let totalCreated = 0;
  for (let i = 0; i < activeEmployees.length; i += SEED_BULK_BATCH_SIZE) {
    const chunk = activeEmployees.slice(i, i + SEED_BULK_BATCH_SIZE);
    const leaveBatch = [];
    for (const emp of chunk) {
      const leaveCount = faker.number.int({ min: 1, max: 3 });
      for (let j = 0; j < leaveCount; j++) {
        const startDate = faker.date.between({ from: '2024-01-01', to: '2024-12-01' });
        const daysOff = faker.number.int({ min: 1, max: 14 });
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + daysOff);
        const status = faker.helpers.weightedArrayElement([
          { weight: 20, value: 'pending' },
          { weight: 50, value: 'approved' },
          { weight: 20, value: 'rejected' },
          { weight: 10, value: 'cancelled' }
        ]);
        leaveBatch.push({
          employee:   emp._id,
          type:       faker.helpers.arrayElement(['annual', 'sick', 'annual', 'unpaid', 'maternity']),
          startDate,
          endDate,
          days:       daysOff + 1,
          reason:     faker.helpers.arrayElement(LEAVE_REASONS),
          status,
          reviewedBy:  ['approved', 'rejected'].includes(status) ? superAdmin._id : undefined,
          reviewNote:  status === 'rejected'
            ? faker.helpers.arrayElement(LEAVE_REJECT_REASONS)
            : status === 'approved' ? 'Approved. Enjoy your time off!' : undefined,
          reviewedAt: ['approved', 'rejected'].includes(status) ? new Date() : undefined
        });
      }
    }
    if (leaveBatch.length > 0) {
      await batchInsert(Leave, leaveBatch);
      totalCreated += leaveBatch.length;
    }
    process.stdout.write(`\r  → Leave: ${totalCreated} created`);
  }
  console.log();
}

// ─── Step 7: Audit Logs ───────────────────────────────────────────────────────

const AUDIT_RESOURCES = ['employees', 'departments', 'payroll', 'leave', 'users', 'roles'];
const AUDIT_ACTIONS = ['POST', 'PATCH', 'DELETE', 'GET'];
const NIGERIAN_IPS = [
  '197.210.84.1', '105.112.0.1', '41.58.0.1',
  '197.255.0.1',  '196.216.0.1', '154.120.0.1'
];
const SUSPICIOUS_REASONS = [
  'Repeated forbidden attempts — 6 access denied events in the last 15 minutes',
  'High mutation volume — 23 mutating requests in the last 5 minutes',
  'Sensitive resource "payroll" accessed at odd hours (23:00)',
  'Bulk deletions detected — 7 delete operations in the last 10 minutes'
];

function buildAuditLogDoc(users) {
  const user = faker.helpers.arrayElement(users);
  const resource = faker.helpers.arrayElement(AUDIT_RESOURCES);
  const action = faker.helpers.arrayElement(AUDIT_ACTIONS);
  const statusCode = faker.helpers.weightedArrayElement([
    { weight: 70, value: 200 },
    { weight: 15, value: 400 },
    { weight: 10, value: 403 },
    { weight: 5,  value: 500 }
  ]);
  const auditStatus = statusCode === 403 ? 'forbidden' : statusCode >= 400 ? 'failed' : 'success';
  const isSuspicious = faker.datatype.boolean({ probability: 0.05 });
  return {
    performedBy: {
      userId:   user._id,
      email:    user.email,
      fullName: `${user.firstName} ${user.lastName}`
    },
    action,
    resource,
    permission: `${resource}:${action.toLowerCase()}`,
    request: { method: action, url: `/api/v1/${resource}`, body: {}, params: {}, query: {} },
    response: { statusCode, success: statusCode < 400 },
    device: {
      userAgent: faker.internet.userAgent(),
      browser:   { name: faker.helpers.arrayElement(['Chrome', 'Firefox', 'Safari', 'Edge']), version: faker.system.semver() },
      os:        { name: faker.helpers.arrayElement(['Windows', 'macOS', 'Linux', 'Android', 'iOS']), version: faker.system.semver() },
      device:    { type: faker.helpers.arrayElement(['desktop', 'mobile', 'tablet']), vendor: faker.helpers.arrayElement(['Apple', 'Samsung', 'Google', 'Dell', 'HP']), model: faker.helpers.arrayElement(['iPhone', 'Galaxy S23', 'MacBook', 'Latitude']) }
    },
    location: {
      ip: faker.helpers.arrayElement(NIGERIAN_IPS),
      country: 'NG',
      region: faker.helpers.arrayElement(NIGERIAN_STATES),
      city: faker.helpers.arrayElement(['Lagos', 'Abuja', 'Port Harcourt', 'Kano', 'Ibadan']),
      timezone: 'Africa/Lagos',
      ll: [faker.location.latitude({ min: 4, max: 14 }), faker.location.longitude({ min: 3, max: 15 })]
    },
    status:            auditStatus,
    isSuspicious,
    suspiciousReasons: isSuspicious ? [faker.helpers.arrayElement(SUSPICIOUS_REASONS)] : [],
    createdAt:         faker.date.between({ from: '2024-01-01', to: '2024-12-31' })
  };
}

async function seedAuditLogs() {
  console.log('\n Seeding audit logs...');

  const existingCount = await AuditLog.countDocuments();
  if (existingCount >= SEED_AUDIT_LOGS) {
    console.log('  Audit logs already seeded — skipping');
    return;
  }

  const users = await User.find({ isActive: true }).limit(100).lean();
  if (!users.length) return;

  const toCreate = SEED_AUDIT_LOGS - existingCount;
  const auditBatchSize = Math.min(SEED_BULK_BATCH_SIZE, 20000);
  let created = 0;

  for (let i = 0; i < toCreate; i += auditBatchSize) {
    const batchSize = Math.min(auditBatchSize, toCreate - i);
    const auditBatch = Array.from({ length: batchSize }, () => buildAuditLogDoc(users));
    await batchInsert(AuditLog, auditBatch);
    created += batchSize;
    process.stdout.write(`\r  → Audit logs: ${created}/${toCreate}`);
  }
  console.log();
}

// ─── Helper: get permission names from IDs ────────────────────────────────────

async function getPermissionNames(permissionIds) {
  if (!permissionIds || !permissionIds.length) return [];
  const perms = await Permission.find({ _id: { $in: permissionIds } }).lean();
  return perms.map(p => p.name);
}

// ─── Main Runner ──────────────────────────────────────────────────────────────

async function runDevSeeder() {
  await connectDB();

   const isFresh = process.argv.includes('--fresh');

  if (isFresh) {
    console.log('🗑️  Fresh mode — clearing existing data...');
    await Promise.all([
      User.deleteMany({ email: { $ne: 'superadmin@backoffice.com' } }),
      Role.deleteMany({}),
      Resource.deleteMany({}),
      Permission.deleteMany({}),
      Department.deleteMany({}),
      Employee.deleteMany({}),
      Payroll.deleteMany({}),
      Leave.deleteMany({}),
      AuditLog.deleteMany({})
    ]);
    console.log('Cleared\n');
  }
  
  console.log('Starting dev seeder...\n');
  console.log(`Scale: SEED_EMPLOYEES=${SEED_EMPLOYEES}  SEED_AUDIT_LOGS=${SEED_AUDIT_LOGS}  BATCH_SIZE=${SEED_BULK_BATCH_SIZE}`);
  console.log('Mode: Skip existing — only adding missing records\n');

  const start = Date.now();

  const allPermissions = await seedResources();
  const roles          = await seedRoles(allPermissions);
  const departments    = await seedDepartments();
  const employees      = await seedUsersAndEmployees(roles, departments);

  await seedPayroll(employees);
  await seedLeaveRequests(employees);
  await seedAuditLogs();

  const duration = ((Date.now() - start) / 1000).toFixed(2);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Dev seeder complete!\n');
  console.log(`Resources:    ${await Resource.countDocuments()}`);
  console.log(`Permissions:  ${await Permission.countDocuments()}`);
  console.log(`Roles:        ${await Role.countDocuments()}`);
  console.log(`Departments:  ${await Department.countDocuments()}`);
  console.log(`Users:        ${await User.countDocuments()}`);
  console.log(`Employees:    ${await Employee.countDocuments()}`);
  console.log(`Payroll:      ${await Payroll.countDocuments()}`);
  console.log(`Leave:        ${await Leave.countDocuments()}`);
  console.log(`Audit Logs:   ${await AuditLog.countDocuments()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\nCompleted in ${duration}s`);

  await mongoose.disconnect();
  process.exit(0);
}

runDevSeeder().catch(err => {
  console.error('Dev seeder failed:', err);
  process.exit(1);
});