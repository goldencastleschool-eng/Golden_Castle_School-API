const StaffLevel = require("../models/staffLevelModel");
const PayrollStaff = require("../models/payrollStaffModel");
const PayrollStructure = require("../models/payrollStructureModel");
const PayrollAssignment = require("../models/payrollAssignmentModel");
const PayrollPayment = require("../models/payrollPaymentModel");
const Teacher = require("../models/teacherModel");
const {
  applyListQueryOptions,
  getListQueryOptions
} = require("../utils/listQueryOptions");

const validCategories = ["academic", "non_academic"];
const validPeriodTypes = ["monthly", "termly"];
const staffStatuses = ["active", "inactive", "resigned", "suspended"];
const assignmentStatuses = ["active", "paused", "cancelled"];

const populateStaff = [
  {
    path: "level",
    select: "category name status"
  },
  {
    path: "linked_teacher",
    select: "full_name username status"
  }
];

const populateStructure = {
  path: "level",
  select: "category name status"
};

const populateAssignment = [
  {
    path: "staff",
    select: "full_name category job_title phone status"
  },
  populateStructure,
  {
    path: "structure",
    select: "session period_type period net_amount gross_amount deduction_amount"
  }
];

const populatePayment = [
  {
    path: "staff",
    select: "full_name category job_title phone status"
  },
  {
    path: "assignment",
    select: "session period_type period net_amount status"
  },
  populateStructure
];

const normalizeText = (value = "") => value.toString().trim();

const normalizeItems = (items = []) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => ({
      name: normalizeText(item.name),
      amount: Number(item.amount)
    }))
    .filter((item) => item.name && Number.isFinite(item.amount) && item.amount >= 0);
};

const getRecordId = (record) => record?._id || record || "";

const buildPayrollReference = (paymentId) =>
  `GCIS-PAY-${paymentId.toString().slice(-8).toUpperCase()}`;

const getErrorMessage = (error) =>
  error.response?.data?.message || error.response?.data?.error || error.message;

const escapeRegex = (value = "") =>
  value.toString().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildPayrollQuery = (reqQuery = {}) => {
  const query = {};

  ["category", "level", "session", "period_type", "period", "status"].forEach(
    (field) => {
      if (reqQuery[field]) {
        query[field] = reqQuery[field];
      }
    }
  );

  return query;
};

const calculateStructureTotals = (earnings, deductions) => {
  const gross = earnings.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const deduction = deductions.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  if (deduction > gross) {
    return {
      message: "Total deductions cannot be greater than total earnings"
    };
  }

  return {
    gross_amount: gross,
    deduction_amount: deduction,
    net_amount: gross - deduction
  };
};

const getLevelById = async (levelId, category = "") => {
  if (!levelId) {
    return null;
  }

  const level = await StaffLevel.findById(levelId);

  if (!level) {
    return null;
  }

  if (category && level.category !== category) {
    return null;
  }

  return level;
};

const getLevels = async (req, res) => {
  try {
    const query = {};

    if (req.query.category) {
      query.category = req.query.category;
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    const levelsQuery = StaffLevel.find(query).sort({
      category: 1,
      name: 1
    });
    const levels = await applyListQueryOptions(
      levelsQuery,
      getListQueryOptions(req.query)
    );

    res.json(levels);
  } catch (error) {
    res.status(500).json({
      error: getErrorMessage(error)
    });
  }
};

const createLevel = async (req, res) => {
  try {
    const category = req.body.category;
    const name = normalizeText(req.body.name);

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        message: "A valid staff category is required"
      });
    }

    if (!name) {
      return res.status(400).json({
        message: "Staff level name is required"
      });
    }

    const level = await StaffLevel.create({
      category,
      name,
      status: req.body.status || "active"
    });

    res.status(201).json(level);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "This staff level already exists"
      });
    }

    res.status(500).json({
      error: getErrorMessage(error)
    });
  }
};

const updateLevel = async (req, res) => {
  try {
    const level = await StaffLevel.findById(req.params.id);

    if (!level) {
      return res.status(404).json({
        message: "Staff level not found"
      });
    }

    const category = req.body.category || level.category;
    const name = normalizeText(req.body.name);

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        message: "A valid staff category is required"
      });
    }

    if (!name) {
      return res.status(400).json({
        message: "Staff level name is required"
      });
    }

    if (category !== level.category) {
      const linkedCount = await Promise.all([
        PayrollStaff.countDocuments({ level: level._id }),
        PayrollStructure.countDocuments({ level: level._id }),
        PayrollAssignment.countDocuments({ level: level._id }),
        PayrollPayment.countDocuments({ level: level._id })
      ]);

      if (linkedCount.some((count) => count > 0)) {
        return res.status(400).json({
          message:
            "Cannot change the category of a staff level that is already linked to payroll records"
        });
      }
    }

    level.category = category;
    level.name = name;
    level.status = req.body.status || level.status;

    await level.save();

    res.json(level);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "This staff level already exists"
      });
    }

    res.status(500).json({
      error: getErrorMessage(error)
    });
  }
};

const deleteLevel = async (req, res) => {
  try {
    const level = await StaffLevel.findById(req.params.id);

    if (!level) {
      return res.status(404).json({
        message: "Staff level not found"
      });
    }

    const linkedCount = await Promise.all([
      PayrollStaff.countDocuments({ level: level._id }),
      PayrollStructure.countDocuments({ level: level._id }),
      PayrollAssignment.countDocuments({ level: level._id }),
      PayrollPayment.countDocuments({ level: level._id })
    ]);

    if (linkedCount.some((count) => count > 0)) {
      return res.status(400).json({
        message:
          "Cannot delete a staff level that is linked to staff, salary structures, assignments, or payments"
      });
    }

    await level.deleteOne();

    res.json({
      message: "Staff level deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      error: getErrorMessage(error)
    });
  }
};

const getStaff = async (req, res) => {
  try {
    const query = {};

    ["category", "level", "status"].forEach((field) => {
      if (req.query[field]) {
        query[field] = req.query[field];
      }
    });

    if (req.query.q) {
      const regex = new RegExp(escapeRegex(req.query.q), "i");
      query.$or = [
        {
          full_name: regex
        },
        {
          job_title: regex
        },
        {
          phone: regex
        }
      ];
    }

    const staffQuery = PayrollStaff.find(query)
      .populate(populateStaff)
      .sort({ createdAt: -1 });
    const staff = await applyListQueryOptions(
      staffQuery,
      getListQueryOptions(req.query)
    );

    res.json(staff);
  } catch (error) {
    res.status(500).json({
      error: getErrorMessage(error)
    });
  }
};

const buildStaffPayload = async (payload) => {
  const fullName = normalizeText(payload.full_name);
  const category = payload.category;

  if (!fullName) {
    return {
      message: "Staff name is required"
    };
  }

  if (!validCategories.includes(category)) {
    return {
      message: "A valid staff category is required"
    };
  }

  const level = await getLevelById(payload.level, category);

  if (!level) {
    return {
      message: "Selected staff level was not found for this category"
    };
  }

  let linkedTeacher = null;

  if (payload.linked_teacher) {
    linkedTeacher = await Teacher.findById(payload.linked_teacher);

    if (!linkedTeacher) {
      return {
        message: "Selected linked teacher was not found"
      };
    }
  }

  return {
    full_name: fullName,
    category,
    level: level._id,
    job_title: normalizeText(payload.job_title),
    phone: normalizeText(payload.phone),
    employment_date: payload.employment_date
      ? new Date(payload.employment_date)
      : null,
    linked_teacher: linkedTeacher?._id || null,
    status: staffStatuses.includes(payload.status) ? payload.status : "active",
    note: normalizeText(payload.note)
  };
};

const createStaff = async (req, res) => {
  try {
    const payload = await buildStaffPayload(req.body);

    if (payload.message) {
      return res.status(400).json({
        message: payload.message
      });
    }

    const staff = await PayrollStaff.create(payload);
    const populatedStaff = await PayrollStaff.findById(staff._id).populate(
      populateStaff
    );

    res.status(201).json(populatedStaff);
  } catch (error) {
    res.status(500).json({
      error: getErrorMessage(error)
    });
  }
};

const updateStaff = async (req, res) => {
  try {
    const staff = await PayrollStaff.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        message: "Payroll staff not found"
      });
    }

    const payload = await buildStaffPayload(req.body);

    if (payload.message) {
      return res.status(400).json({
        message: payload.message
      });
    }

    Object.assign(staff, payload);
    await staff.save();

    const populatedStaff = await PayrollStaff.findById(staff._id).populate(
      populateStaff
    );

    res.json(populatedStaff);
  } catch (error) {
    res.status(500).json({
      error: getErrorMessage(error)
    });
  }
};

const deleteStaff = async (req, res) => {
  try {
    const staff = await PayrollStaff.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        message: "Payroll staff not found"
      });
    }

    const linkedCount = await Promise.all([
      PayrollAssignment.countDocuments({ staff: staff._id }),
      PayrollPayment.countDocuments({ staff: staff._id })
    ]);

    if (linkedCount.some((count) => count > 0)) {
      return res.status(400).json({
        message:
          "Cannot delete payroll staff with assignments or payments. Change the staff status instead."
      });
    }

    await staff.deleteOne();

    res.json({
      message: "Payroll staff deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      error: getErrorMessage(error)
    });
  }
};

const getStructures = async (req, res) => {
  try {
    const structuresQuery = PayrollStructure.find(buildPayrollQuery(req.query))
      .populate(populateStructure)
      .sort({
        session: -1,
        period_type: 1,
        period: 1,
        createdAt: -1
      });
    const structures = await applyListQueryOptions(
      structuresQuery,
      getListQueryOptions(req.query)
    );

    res.json(structures);
  } catch (error) {
    res.status(500).json({
      error: getErrorMessage(error)
    });
  }
};

const buildStructurePayload = async (payload) => {
  const category = payload.category;
  const session = normalizeText(payload.session);
  const periodType = payload.period_type;
  const period = normalizeText(payload.period);
  const earnings = normalizeItems(payload.earnings);
  const deductions = normalizeItems(payload.deductions);

  if (!validCategories.includes(category)) {
    return {
      message: "A valid staff category is required"
    };
  }

  if (!session || !validPeriodTypes.includes(periodType) || !period) {
    return {
      message: "Session, period type, and period are required"
    };
  }

  const level = await getLevelById(payload.level, category);

  if (!level) {
    return {
      message: "Selected staff level was not found for this category"
    };
  }

  if (earnings.length === 0) {
    return {
      message: "At least one earning item is required"
    };
  }

  const totals = calculateStructureTotals(earnings, deductions);

  if (totals.message) {
    return totals;
  }

  return {
    level: level._id,
    category,
    session,
    period_type: periodType,
    period,
    earnings,
    deductions,
    ...totals
  };
};

const createStructure = async (req, res) => {
  try {
    const payload = await buildStructurePayload(req.body);

    if (payload.message) {
      return res.status(400).json({
        message: payload.message
      });
    }

    const structure = await PayrollStructure.create(payload);
    const populatedStructure = await PayrollStructure.findById(
      structure._id
    ).populate(populateStructure);

    res.status(201).json(populatedStructure);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message:
          "A payroll structure already exists for this level, session, and period"
      });
    }

    res.status(500).json({
      error: getErrorMessage(error)
    });
  }
};

const updateStructure = async (req, res) => {
  try {
    const structure = await PayrollStructure.findById(req.params.id);

    if (!structure) {
      return res.status(404).json({
        message: "Payroll structure not found"
      });
    }

    const payload = await buildStructurePayload(req.body);

    if (payload.message) {
      return res.status(400).json({
        message: payload.message
      });
    }

    const assignmentCount = await PayrollAssignment.countDocuments({
      structure: structure._id
    });

    if (
      assignmentCount > 0 &&
      (
        getRecordId(payload.level).toString() !== structure.level.toString() ||
        payload.session !== structure.session ||
        payload.period_type !== structure.period_type ||
        payload.period !== structure.period
      )
    ) {
      return res.status(400).json({
        message:
          "This payroll structure already has assignments. You can edit earnings and deductions, but cannot change level, session, or period."
      });
    }

    Object.assign(structure, payload);
    await structure.save();

    const populatedStructure = await PayrollStructure.findById(
      structure._id
    ).populate(populateStructure);

    res.json(populatedStructure);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message:
          "A payroll structure already exists for this level, session, and period"
      });
    }

    res.status(500).json({
      error: getErrorMessage(error)
    });
  }
};

const deleteStructure = async (req, res) => {
  try {
    const structure = await PayrollStructure.findById(req.params.id);

    if (!structure) {
      return res.status(404).json({
        message: "Payroll structure not found"
      });
    }

    const linkedCount = await Promise.all([
      PayrollAssignment.countDocuments({ structure: structure._id }),
      PayrollPayment.countDocuments({
        session: structure.session,
        period_type: structure.period_type,
        period: structure.period,
        level: structure.level
      })
    ]);

    if (linkedCount.some((count) => count > 0)) {
      return res.status(400).json({
        message: "Cannot delete a payroll structure that has assignments or payments"
      });
    }

    await structure.deleteOne();

    res.json({
      message: "Payroll structure deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      error: getErrorMessage(error)
    });
  }
};

const getAssignments = async (req, res) => {
  try {
    const assignmentQuery = buildPayrollQuery(req.query);
    const assignmentsQuery = PayrollAssignment.find(assignmentQuery)
      .populate(populateAssignment)
      .sort({
        createdAt: -1
      });
    const listOptions = getListQueryOptions(req.query);
    const [assignments, totalCount] = await Promise.all([
      applyListQueryOptions(assignmentsQuery, listOptions),
      PayrollAssignment.countDocuments(assignmentQuery)
    ]);

    res.set("X-Total-Count", totalCount.toString());

    res.json(assignments);
  } catch (error) {
    res.status(500).json({
      error: getErrorMessage(error)
    });
  }
};

const createAssignments = async (req, res) => {
  try {
    const staffIds = Array.isArray(req.body.staff_ids)
      ? req.body.staff_ids.filter(Boolean)
      : [];

    if (staffIds.length === 0 || !req.body.structure) {
      return res.status(400).json({
        message: "Select at least one staff member and a payroll structure"
      });
    }

    const structure = await PayrollStructure.findById(req.body.structure).populate(
      populateStructure
    );

    if (!structure) {
      return res.status(404).json({
        message: "Payroll structure not found"
      });
    }

    const staffRecords = await PayrollStaff.find({
      _id: {
        $in: staffIds
      },
      status: "active"
    }).populate("level", "category name status");

    const eligibleStaff = staffRecords.filter((staff) => {
      const levelId = getRecordId(staff.level).toString();

      return (
        staff.category === structure.category &&
        levelId === structure.level._id.toString()
      );
    });

    if (eligibleStaff.length === 0) {
      return res.status(400).json({
        message:
          "No selected active staff member matches this payroll structure level"
      });
    }

    const existingAssignments = await PayrollAssignment.find({
      staff: {
        $in: eligibleStaff.map((staff) => staff._id)
      },
      session: structure.session,
      period_type: structure.period_type,
      period: structure.period
    }).select("staff");
    const existingStaffIds = new Set(
      existingAssignments.map((assignment) => assignment.staff.toString())
    );
    const assignmentPayloads = eligibleStaff
      .filter((staff) => !existingStaffIds.has(staff._id.toString()))
      .map((staff) => ({
        staff: staff._id,
        structure: structure._id,
        category: structure.category,
        level: structure.level._id,
        level_name: structure.level.name,
        session: structure.session,
        period_type: structure.period_type,
        period: structure.period,
        earnings_snapshot: structure.earnings,
        deductions_snapshot: structure.deductions,
        gross_amount: structure.gross_amount,
        deduction_amount: structure.deduction_amount,
        net_amount: structure.net_amount,
        status: "active"
      }));

    if (assignmentPayloads.length > 0) {
      await PayrollAssignment.insertMany(assignmentPayloads, {
        ordered: false
      });
    }

    const assignments = await PayrollAssignment.find({
      staff: {
        $in: eligibleStaff.map((staff) => staff._id)
      },
      session: structure.session,
      period_type: structure.period_type,
      period: structure.period
    })
      .populate(populateAssignment)
      .sort({
        createdAt: -1
      });

    res.status(201).json({
      message:
        `${assignmentPayloads.length} staff assignment(s) created. ` +
        `${existingStaffIds.size} selected staff member(s) already had payroll assignments for this period.`,
      createdCount: assignmentPayloads.length,
      skippedCount: existingStaffIds.size,
      assignments
    });
  } catch (error) {
    res.status(500).json({
      error: getErrorMessage(error)
    });
  }
};

const updateAssignment = async (req, res) => {
  try {
    const assignment = await PayrollAssignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({
        message: "Payroll assignment not found"
      });
    }

    const status = req.body.status;

    if (!assignmentStatuses.includes(status)) {
      return res.status(400).json({
        message: "A valid assignment status is required"
      });
    }

    if (status === "cancelled") {
      const paymentCount = await PayrollPayment.countDocuments({
        assignment: assignment._id
      });

      if (paymentCount > 0) {
        return res.status(400).json({
          message: "Cannot cancel a payroll assignment that has payment records"
        });
      }
    }

    assignment.status = status;
    await assignment.save();

    const populatedAssignment = await PayrollAssignment.findById(
      assignment._id
    ).populate(populateAssignment);

    res.json(populatedAssignment);
  } catch (error) {
    res.status(500).json({
      error: getErrorMessage(error)
    });
  }
};

const deleteAssignment = async (req, res) => {
  try {
    const assignment = await PayrollAssignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({
        message: "Payroll assignment not found"
      });
    }

    const paymentCount = await PayrollPayment.countDocuments({
      assignment: assignment._id
    });

    if (paymentCount > 0) {
      return res.status(400).json({
        message: "Cannot delete a payroll assignment with payment records"
      });
    }

    await assignment.deleteOne();

    res.json({
      message: "Payroll assignment deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      error: getErrorMessage(error)
    });
  }
};

const getPayments = async (req, res) => {
  try {
    const paymentQuery = buildPayrollQuery(req.query);
    const paymentsQuery = PayrollPayment.find(paymentQuery)
      .populate(populatePayment)
      .sort({
        payment_date: -1,
        createdAt: -1
      });
    const listOptions = getListQueryOptions(req.query);
    const [payments, totalCount] = await Promise.all([
      applyListQueryOptions(paymentsQuery, listOptions),
      PayrollPayment.countDocuments(paymentQuery)
    ]);

    res.set("X-Total-Count", totalCount.toString());

    res.json(payments);
  } catch (error) {
    res.status(500).json({
      error: getErrorMessage(error)
    });
  }
};

const getAssignmentPaid = async (assignmentId, excludedPaymentId = "") => {
  const query = {
    assignment: assignmentId
  };

  if (excludedPaymentId) {
    query._id = {
      $ne: excludedPaymentId
    };
  }

  const payments = await PayrollPayment.find(query).select("amount");

  return payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
};

const buildPaymentSnapshot = async (payload, excludedPaymentId = "") => {
  const assignment = await PayrollAssignment.findById(payload.assignment)
    .populate("staff", "full_name category job_title status")
    .populate("level", "name category status");

  if (!assignment) {
    return {
      message: "Selected payroll assignment was not found"
    };
  }

  if (assignment.status !== "active") {
    return {
      message: "Payment can only be recorded for active payroll assignments"
    };
  }

  const amount = Number(payload.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      message: "Payment amount must be greater than zero"
    };
  }

  if (Number.isNaN(new Date(payload.payment_date).getTime())) {
    return {
      message: "Payment date is invalid"
    };
  }

  const alreadyPaid = await getAssignmentPaid(assignment._id, excludedPaymentId);
  const expectedNet = Number(assignment.net_amount || 0);
  const balance = Math.max(expectedNet - alreadyPaid, 0);

  if (amount > balance) {
    return {
      message:
        `Payment amount cannot be greater than the outstanding payroll balance. ` +
        `Expected net pay is ${expectedNet}, already paid is ${alreadyPaid}, and remaining balance is ${balance}.`
    };
  }

  return {
    assignment,
    amount,
    payment_date: new Date(payload.payment_date),
    payment_method: normalizeText(payload.payment_method),
    note: normalizeText(payload.note)
  };
};

const createPayment = async (req, res) => {
  try {
    const snapshot = await buildPaymentSnapshot(req.body);

    if (snapshot.message) {
      return res.status(400).json({
        message: snapshot.message
      });
    }

    const payment = new PayrollPayment({
      assignment: snapshot.assignment._id,
      staff: snapshot.assignment.staff._id || snapshot.assignment.staff,
      category: snapshot.assignment.category,
      level: snapshot.assignment.level._id || snapshot.assignment.level,
      level_name: snapshot.assignment.level_name || snapshot.assignment.level.name,
      session: snapshot.assignment.session,
      period_type: snapshot.assignment.period_type,
      period: snapshot.assignment.period,
      expected_net_at_payment: snapshot.assignment.net_amount,
      earnings_snapshot: snapshot.assignment.earnings_snapshot,
      deductions_snapshot: snapshot.assignment.deductions_snapshot,
      amount: snapshot.amount,
      payment_date: snapshot.payment_date,
      payment_method: snapshot.payment_method,
      note: snapshot.note
    });

    payment.reference_no = buildPayrollReference(payment._id);
    await payment.save();

    const populatedPayment = await PayrollPayment.findById(payment._id).populate(
      populatePayment
    );

    res.status(201).json(populatedPayment);
  } catch (error) {
    res.status(500).json({
      error: getErrorMessage(error)
    });
  }
};

const updatePayment = async (req, res) => {
  try {
    const payment = await PayrollPayment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        message: "Payroll payment record not found"
      });
    }

    const snapshot = await buildPaymentSnapshot(req.body, payment._id);

    if (snapshot.message) {
      return res.status(400).json({
        message: snapshot.message
      });
    }

    payment.assignment = snapshot.assignment._id;
    payment.staff = snapshot.assignment.staff._id || snapshot.assignment.staff;
    payment.category = snapshot.assignment.category;
    payment.level = snapshot.assignment.level._id || snapshot.assignment.level;
    payment.level_name =
      snapshot.assignment.level_name || snapshot.assignment.level.name;
    payment.session = snapshot.assignment.session;
    payment.period_type = snapshot.assignment.period_type;
    payment.period = snapshot.assignment.period;
    payment.expected_net_at_payment = snapshot.assignment.net_amount;
    payment.earnings_snapshot = snapshot.assignment.earnings_snapshot;
    payment.deductions_snapshot = snapshot.assignment.deductions_snapshot;
    payment.amount = snapshot.amount;
    payment.payment_date = snapshot.payment_date;
    payment.payment_method = snapshot.payment_method;
    payment.note = snapshot.note;
    payment.reference_no = payment.reference_no || buildPayrollReference(payment._id);

    await payment.save();

    const populatedPayment = await PayrollPayment.findById(payment._id).populate(
      populatePayment
    );

    res.json(populatedPayment);
  } catch (error) {
    res.status(500).json({
      error: getErrorMessage(error)
    });
  }
};

const deletePayment = async (req, res) => {
  try {
    const payment = await PayrollPayment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        message: "Payroll payment record not found"
      });
    }

    await payment.deleteOne();

    res.json({
      message: "Payroll payment deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      error: getErrorMessage(error)
    });
  }
};

module.exports = {
  getLevels,
  createLevel,
  updateLevel,
  deleteLevel,
  getStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  getStructures,
  createStructure,
  updateStructure,
  deleteStructure,
  getAssignments,
  createAssignments,
  updateAssignment,
  deleteAssignment,
  getPayments,
  createPayment,
  updatePayment,
  deletePayment
};
