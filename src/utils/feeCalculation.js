const { isFeeExemptCategory } = require("./feeCategories");

const normalizeDiscountAmount = (amount = 0) => {
  const numericAmount = Number(amount || 0);

  return Number.isFinite(numericAmount) && numericAmount > 0
    ? numericAmount
    : 0;
};

const getEnrollmentDiscountAmount = (enrollment = {}) =>
  normalizeDiscountAmount(enrollment.discount_amount);

const getExpectedFeeSnapshot = ({ feeStructure, enrollment = {} }) => {
  const feeCategory = enrollment?.fee_category || "returning";
  const baseAmount = Number(feeStructure?.amount || 0);
  const rawDiscountAmount = getEnrollmentDiscountAmount(enrollment);
  const discountAmount = feeCategory === "discounted"
    ? Math.min(rawDiscountAmount, baseAmount)
    : 0;
  const expectedAmount = isFeeExemptCategory(feeCategory)
    ? 0
    : Math.max(baseAmount - discountAmount, 0);

  return {
    baseAmount,
    discountAmount,
    discountReason: enrollment?.discount_reason || "",
    expectedAmount,
    isExempt: isFeeExemptCategory(feeCategory)
  };
};

module.exports = {
  getEnrollmentDiscountAmount,
  getExpectedFeeSnapshot,
  normalizeDiscountAmount
};
