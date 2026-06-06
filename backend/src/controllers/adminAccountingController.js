const { Order, StaffEarning, User, WholesalerPaymentBatch } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { logActivity } = require('../utils/activityLogger');
const { parseObjectId } = require('../utils/mongo');

const DAY_MS = 24 * 60 * 60 * 1000;
const COLOMBO_TZ = '+05:30';

function validDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function defaultRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + DAY_MS);
  return { from: start, to: end };
}

function dateRange(query = {}) {
  const fallback = defaultRange();
  const from = validDate(query.from) || fallback.from;
  const to = validDate(query.to) || fallback.to;
  if (to <= from) {
    throw new HttpError(400, 'Invalid date range.');
  }
  return { from, to };
}

function rangeMatch(field, from, to) {
  return {
    [field]: {
      $gte: from,
      $lt: to
    }
  };
}

function zeroSummary() {
  return {
    orders: 0,
    files: 0,
    amount_lkr: 0,
    amount_usd: 0
  };
}

function dayKey(dateField) {
  return {
    $dateToString: {
      format: '%Y-%m-%d',
      date: dateField,
      timezone: COLOMBO_TZ
    }
  };
}

function mergeDaily(rows, key, target) {
  rows.forEach((row) => {
    const day = row._id;
    if (!target.has(day)) {
      target.set(day, {
        date: day,
        customer_revenue_lkr: 0,
        customer_paid_files: 0,
        completed_files: 0,
        completed_orders: 0,
        staff_payable_usd: 0,
        staff_paid_usd: 0,
        wholesaler_receivable_lkr: 0,
        wholesaler_completed_files: 0,
        wholesaler_collected_lkr: 0
      });
    }
    Object.entries(key(row)).forEach(([field, value]) => {
      target.get(day)[field] = value || 0;
    });
  });
}

async function aggregateOne(model, pipeline, fallback = zeroSummary()) {
  const rows = await model.aggregate(pipeline);
  return rows[0] || fallback;
}

async function staffPayables(from, to) {
  const staff = await User.find({ role: 'staff' }).sort({ name: 1 }).select('name email');
  const [allUnpaid, periodEarned, periodPaid] = await Promise.all([
    StaffEarning.aggregate([
      { $match: { status: 'unpaid' } },
      {
        $group: {
          _id: '$staff_id',
          unpaid_files: { $sum: '$completed_file_count' },
          unpaid_usd: { $sum: '$total_earning_usd' }
        }
      }
    ]),
    StaffEarning.aggregate([
      { $match: rangeMatch('created_at', from, to) },
      {
        $group: {
          _id: '$staff_id',
          period_files: { $sum: '$completed_file_count' },
          period_usd: { $sum: '$total_earning_usd' }
        }
      }
    ]),
    StaffEarning.aggregate([
      { $match: { status: 'paid', ...rangeMatch('paid_at', from, to) } },
      {
        $group: {
          _id: '$staff_id',
          paid_usd: { $sum: '$total_earning_usd' }
        }
      }
    ])
  ]);

  const unpaidMap = new Map(allUnpaid.map((row) => [row._id.toString(), row]));
  const periodMap = new Map(periodEarned.map((row) => [row._id.toString(), row]));
  const paidMap = new Map(periodPaid.map((row) => [row._id.toString(), row]));

  return staff.map((member) => {
    const id = member._id.toString();
    const unpaid = unpaidMap.get(id) || {};
    const period = periodMap.get(id) || {};
    const paid = paidMap.get(id) || {};
    return {
      staff_id: id,
      name: member.name,
      email: member.email,
      period_files: period.period_files || 0,
      period_usd: period.period_usd || 0,
      unpaid_files: unpaid.unpaid_files || 0,
      unpaid_usd: unpaid.unpaid_usd || 0,
      paid_usd: paid.paid_usd || 0
    };
  });
}

async function wholesalerReceivables(from, to) {
  const wholesalers = await User.find({ role: 'wholesaler' }).sort({ name: 1 }).select('name email rate_per_file_lkr');
  const [allUnpaid, periodCompleted, periodCleared] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          account_type: 'wholesaler',
          order_status: 'completed',
          wholesaler_payment_status: 'unpaid'
        }
      },
      {
        $group: {
          _id: '$customer_id',
          unpaid_files: { $sum: '$file_count' },
          unpaid_lkr: { $sum: { $multiply: ['$file_count', '$price_per_file_lkr'] } }
        }
      }
    ]),
    Order.aggregate([
      {
        $match: {
          account_type: 'wholesaler',
          order_status: 'completed',
          ...rangeMatch('completed_at', from, to)
        }
      },
      {
        $group: {
          _id: '$customer_id',
          period_files: { $sum: '$file_count' },
          period_lkr: { $sum: { $multiply: ['$file_count', '$price_per_file_lkr'] } }
        }
      }
    ]),
    WholesalerPaymentBatch.aggregate([
      { $match: rangeMatch('cleared_at', from, to) },
      {
        $group: {
          _id: '$wholesaler_id',
          cleared_files: { $sum: '$file_count' },
          cleared_lkr: { $sum: '$amount_lkr' }
        }
      }
    ])
  ]);

  const unpaidMap = new Map(allUnpaid.map((row) => [row._id.toString(), row]));
  const periodMap = new Map(periodCompleted.map((row) => [row._id.toString(), row]));
  const clearedMap = new Map(periodCleared.map((row) => [row._id.toString(), row]));

  return wholesalers.map((member) => {
    const id = member._id.toString();
    const unpaid = unpaidMap.get(id) || {};
    const period = periodMap.get(id) || {};
    const cleared = clearedMap.get(id) || {};
    return {
      wholesaler_id: id,
      name: member.name,
      email: member.email,
      rate_per_file_lkr: member.rate_per_file_lkr || 0,
      period_files: period.period_files || 0,
      period_lkr: period.period_lkr || 0,
      unpaid_files: unpaid.unpaid_files || 0,
      unpaid_lkr: unpaid.unpaid_lkr || 0,
      cleared_files: cleared.cleared_files || 0,
      cleared_lkr: cleared.cleared_lkr || 0
    };
  });
}

async function dailyRows(from, to) {
  const [customerRevenue, completedRows, staffEarned, staffPaid, wholesalerCompleted, wholesalerCleared] =
    await Promise.all([
      Order.aggregate([
        {
          $match: {
            account_type: 'customer',
            payment_status: 'paid',
            ...rangeMatch('created_at', from, to)
          }
        },
        {
          $group: {
            _id: dayKey('$created_at'),
            customer_revenue_lkr: { $sum: '$total_amount_lkr' },
            customer_paid_files: { $sum: '$file_count' }
          }
        }
      ]),
      Order.aggregate([
        {
          $match: {
            order_status: 'completed',
            ...rangeMatch('completed_at', from, to)
          }
        },
        {
          $group: {
            _id: dayKey('$completed_at'),
            completed_files: { $sum: '$file_count' },
            completed_orders: { $sum: 1 }
          }
        }
      ]),
      StaffEarning.aggregate([
        { $match: rangeMatch('created_at', from, to) },
        {
          $group: {
            _id: dayKey('$created_at'),
            staff_payable_usd: { $sum: '$total_earning_usd' }
          }
        }
      ]),
      StaffEarning.aggregate([
        { $match: { status: 'paid', ...rangeMatch('paid_at', from, to) } },
        {
          $group: {
            _id: dayKey('$paid_at'),
            staff_paid_usd: { $sum: '$total_earning_usd' }
          }
        }
      ]),
      Order.aggregate([
        {
          $match: {
            account_type: 'wholesaler',
            order_status: 'completed',
            ...rangeMatch('completed_at', from, to)
          }
        },
        {
          $group: {
            _id: dayKey('$completed_at'),
            wholesaler_completed_files: { $sum: '$file_count' },
            wholesaler_receivable_lkr: { $sum: { $multiply: ['$file_count', '$price_per_file_lkr'] } }
          }
        }
      ]),
      WholesalerPaymentBatch.aggregate([
        { $match: rangeMatch('cleared_at', from, to) },
        {
          $group: {
            _id: dayKey('$cleared_at'),
            wholesaler_collected_lkr: { $sum: '$amount_lkr' }
          }
        }
      ])
    ]);

  const days = new Map();
  mergeDaily(customerRevenue, (row) => ({
    customer_revenue_lkr: row.customer_revenue_lkr,
    customer_paid_files: row.customer_paid_files
  }), days);
  mergeDaily(completedRows, (row) => ({
    completed_files: row.completed_files,
    completed_orders: row.completed_orders
  }), days);
  mergeDaily(staffEarned, (row) => ({ staff_payable_usd: row.staff_payable_usd }), days);
  mergeDaily(staffPaid, (row) => ({ staff_paid_usd: row.staff_paid_usd }), days);
  mergeDaily(wholesalerCompleted, (row) => ({
    wholesaler_completed_files: row.wholesaler_completed_files,
    wholesaler_receivable_lkr: row.wholesaler_receivable_lkr
  }), days);
  mergeDaily(wholesalerCleared, (row) => ({ wholesaler_collected_lkr: row.wholesaler_collected_lkr }), days);

  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}

const accountingSummary = asyncHandler(async (req, res) => {
  const { from, to } = dateRange(req.query);
  const [
    customerIncome,
    completed,
    staffEarned,
    staffUnpaid,
    staffPaid,
    wholesalerCompleted,
    wholesalerUnpaid,
    wholesalerCleared,
    staffRows,
    wholesalerRows,
    days
  ] = await Promise.all([
    aggregateOne(Order, [
      {
        $match: {
          account_type: 'customer',
          payment_status: 'paid',
          ...rangeMatch('created_at', from, to)
        }
      },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          files: { $sum: '$file_count' },
          amount_lkr: { $sum: '$total_amount_lkr' }
        }
      }
    ]),
    aggregateOne(Order, [
      {
        $match: {
          order_status: 'completed',
          ...rangeMatch('completed_at', from, to)
        }
      },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          files: { $sum: '$file_count' }
        }
      }
    ]),
    aggregateOne(StaffEarning, [
      { $match: rangeMatch('created_at', from, to) },
      {
        $group: {
          _id: null,
          files: { $sum: '$completed_file_count' },
          amount_usd: { $sum: '$total_earning_usd' }
        }
      }
    ]),
    aggregateOne(StaffEarning, [
      { $match: { status: 'unpaid' } },
      {
        $group: {
          _id: null,
          files: { $sum: '$completed_file_count' },
          amount_usd: { $sum: '$total_earning_usd' }
        }
      }
    ]),
    aggregateOne(StaffEarning, [
      { $match: { status: 'paid', ...rangeMatch('paid_at', from, to) } },
      {
        $group: {
          _id: null,
          amount_usd: { $sum: '$total_earning_usd' }
        }
      }
    ]),
    aggregateOne(Order, [
      {
        $match: {
          account_type: 'wholesaler',
          order_status: 'completed',
          ...rangeMatch('completed_at', from, to)
        }
      },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          files: { $sum: '$file_count' },
          amount_lkr: { $sum: { $multiply: ['$file_count', '$price_per_file_lkr'] } }
        }
      }
    ]),
    aggregateOne(Order, [
      {
        $match: {
          account_type: 'wholesaler',
          order_status: 'completed',
          wholesaler_payment_status: 'unpaid'
        }
      },
      {
        $group: {
          _id: null,
          files: { $sum: '$file_count' },
          amount_lkr: { $sum: { $multiply: ['$file_count', '$price_per_file_lkr'] } }
        }
      }
    ]),
    aggregateOne(WholesalerPaymentBatch, [
      { $match: rangeMatch('cleared_at', from, to) },
      {
        $group: {
          _id: null,
          files: { $sum: '$file_count' },
          amount_lkr: { $sum: '$amount_lkr' }
        }
      }
    ]),
    staffPayables(from, to),
    wholesalerReceivables(from, to),
    dailyRows(from, to)
  ]);

  res.json({
    range: {
      from: from.toISOString(),
      to: to.toISOString()
    },
    summary: {
      customer_income_lkr: customerIncome.amount_lkr || 0,
      customer_paid_orders: customerIncome.orders || 0,
      customer_paid_files: customerIncome.files || 0,
      completed_orders: completed.orders || 0,
      completed_files: completed.files || 0,
      staff_payable_usd: staffEarned.amount_usd || 0,
      staff_checked_files: staffEarned.files || 0,
      staff_unpaid_usd: staffUnpaid.amount_usd || 0,
      staff_unpaid_files: staffUnpaid.files || 0,
      staff_paid_usd: staffPaid.amount_usd || 0,
      wholesaler_receivable_lkr: wholesalerCompleted.amount_lkr || 0,
      wholesaler_completed_files: wholesalerCompleted.files || 0,
      wholesaler_unpaid_lkr: wholesalerUnpaid.amount_lkr || 0,
      wholesaler_unpaid_files: wholesalerUnpaid.files || 0,
      wholesaler_collected_lkr: wholesalerCleared.amount_lkr || 0,
      wholesaler_cleared_files: wholesalerCleared.files || 0
    },
    staff_payables: staffRows,
    wholesaler_receivables: wholesalerRows,
    daily_rows: days
  });
});

const markStaffPaid = asyncHandler(async (req, res) => {
  const staffId = parseObjectId(req.params.id);
  const staff = await User.findOne({ _id: staffId, role: 'staff' });
  if (!staff) {
    throw new HttpError(404, 'Staff member not found.');
  }

  const unpaidRows = await StaffEarning.find({ staff_id: staffId, status: 'unpaid' });
  if (!unpaidRows.length) {
    throw new HttpError(400, 'No unpaid staff earnings to settle.');
  }

  const paidAt = new Date();
  const fileCount = unpaidRows.reduce((total, row) => total + Number(row.completed_file_count || 0), 0);
  const amountUsd = unpaidRows.reduce((total, row) => total + Number(row.total_earning_usd || 0), 0);

  await StaffEarning.updateMany(
    { _id: { $in: unpaidRows.map((row) => row._id) } },
    { status: 'paid', paid_at: paidAt }
  );

  await logActivity({
    userId: req.user.id,
    action: 'staff_earnings_paid',
    description: `${staff.email} staff earnings settled: ${fileCount} file(s), USD ${amountUsd.toFixed(2)}.`,
    ipAddress: req.ip
  });

  res.json({
    staff: {
      id: staff.id,
      name: staff.name,
      email: staff.email
    },
    settlement: {
      paid_at: paidAt,
      file_count: fileCount,
      amount_usd: amountUsd
    }
  });
});

module.exports = {
  accountingSummary,
  markStaffPaid
};
