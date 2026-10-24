/**
 * Extracts and validates pagination params from query string
 * @param {Object} query   — req.query
 * @param {number} maxLimit — maximum allowed page size
 */
function paginate(query, maxLimit = 100) {
  const positiveInteger = (value, fallback) => {
    if (typeof value !== 'string' && typeof value !== 'number') return fallback;
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : fallback;
  };
  const pageLimit = positiveInteger(maxLimit, 100);
  const limit = Math.min(positiveInteger(query.limit, 10), pageLimit);
  let page = positiveInteger(query.page, 1);
  if (!Number.isSafeInteger((page - 1) * limit)) page = 1;
  const skip  = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Builds standard pagination metadata
 */
function paginationMeta(total, page, limit) {
  const pages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    pages,
    hasNext: page < pages,
    hasPrev: page > 1
  };
}

module.exports = { paginate, paginationMeta };
