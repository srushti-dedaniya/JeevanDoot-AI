export const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

export const isValidObjectId = (id) => OBJECT_ID_RE.test(id);

export const sanitizeString = (str, maxLength = 1000) => {
  if (!str || typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
};

export const validateRequired = (obj, fields) => {
  const missing = fields.filter(f => !obj?.[f]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
};

export const validateEnum = (value, allowed, field = 'value') => {
  if (!allowed.includes(value)) {
    throw new Error(`Invalid ${field}: ${value}. Allowed: ${allowed.join(', ')}`);
  }
};