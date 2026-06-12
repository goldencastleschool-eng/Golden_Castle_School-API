const DEFAULT_MAX_LIMIT = 500;

const parsePositiveInteger = (value, fallback = 0) => {
  const parsedValue = Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
};

const getListQueryOptions = (query = {}, {
  maxLimit = DEFAULT_MAX_LIMIT
} = {}) => {
  const requestedLimit = parsePositiveInteger(query.limit);
  const page = parsePositiveInteger(query.page, 1);
  const limit = requestedLimit > 0
    ? Math.min(requestedLimit, maxLimit)
    : 0;
  const skip = limit > 0 ? (page - 1) * limit : 0;

  return {
    limit,
    skip,
    page
  };
};

const applyListQueryOptions = (mongooseQuery, options = {}) => {
  if (options.skip > 0) {
    mongooseQuery.skip(options.skip);
  }

  if (options.limit > 0) {
    mongooseQuery.limit(options.limit);
  }

  return mongooseQuery;
};

module.exports = {
  applyListQueryOptions,
  getListQueryOptions
};
