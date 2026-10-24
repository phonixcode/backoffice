const REDACTED = '***REDACTED***';
const SENSITIVE_KEYS = new Set([
  'password', 'confirmpassword', 'currentpassword', 'newpassword',
  'token', 'refreshtoken', 'accesstoken', 'passwordresettoken',
  'authorization', 'cookie', 'secret', 'apikey',
  'bankdetails', 'accountnumber', 'accountname', 'salary',
  'emergencycontact', 'address', 'phone', 'reason', 'reviewnote', 'note', 'notes',
  'medicaldetails', 'nin', 'bvn', 'taxid'
]);

function isSensitive(key) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return SENSITIVE_KEYS.has(normalized)
    || /(?:password|token|secret|apikey)$/.test(normalized);
}

function redactSensitive(value) {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key, isSensitive(key) ? REDACTED : redactSensitive(child)
  ]));
}

function redactUrl(url) {
  const [pathname, search = ''] = String(url || '').split('?');
  if (!search) return pathname;
  const params = new URLSearchParams(search);
  const sanitized = new URLSearchParams();
  for (const [key, value] of params) {
    sanitized.append(key, isSensitive(key) ? REDACTED : value);
  }
  return `${pathname}?${sanitized.toString()}`;
}

module.exports = { redactSensitive, redactUrl };
