const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

function formatPeriod(period) {
  return `${MONTHS[period.month - 1]} ${period.year}`;
}

function formatCurrency(amount, currency = 'NGN') {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

function maskAccountNumber(accountNumber) {
  if (!accountNumber) return undefined;
  return `****${String(accountNumber).slice(-4)}`;
}

function isoDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

module.exports = { formatPeriod, formatCurrency, maskAccountNumber, isoDate };
