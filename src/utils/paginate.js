/**
 * Extracts and validates pagination params from query string
 * @param {Object} query   — req.query
 * @param {number} maxLimit — maximum allowed page size
 */
function paginate(query, maxLimit = 100) {
  const page  = Math.max(Number(query.page)  || 1, 1);
  const limit = Math.min(Number(query.limit) || 10, maxLimit);
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