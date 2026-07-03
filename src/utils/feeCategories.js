const FEE_CATEGORIES = [
  { value: "new", label: "Newly Admitted" },
  { value: "returning", label: "Returning/Old" },
  { value: "vip", label: "VIP Student" },
  { value: "scholarship", label: "Scholarship Student" },
  { value: "discounted", label: "Discounted Student" },
  { value: "staff_child", label: "Staff Child" }
];

const VALID_FEE_CATEGORIES = FEE_CATEGORIES.map((category) => category.value);
const FEE_EXEMPT_CATEGORIES = ["vip", "scholarship"];
const LEGACY_FEE_CATEGORY_LABELS = {
  boarding: "Boarding Student (legacy)"
};

const normalizeFeeCategory = (feeCategory = "") =>
  feeCategory.toString().trim().toLowerCase();

const isFeeExemptCategory = (feeCategory = "") =>
  FEE_EXEMPT_CATEGORIES.includes(normalizeFeeCategory(feeCategory));

const formatFeeCategoryLabel = (feeCategory = "") => {
  const normalizedCategory = normalizeFeeCategory(feeCategory);
  const category = FEE_CATEGORIES.find(
    (feeCategoryOption) => feeCategoryOption.value === normalizedCategory
  );

  return category?.label || LEGACY_FEE_CATEGORY_LABELS[normalizedCategory] || "Selected";
};

module.exports = {
  FEE_CATEGORIES,
  FEE_EXEMPT_CATEGORIES,
  VALID_FEE_CATEGORIES,
  formatFeeCategoryLabel,
  isFeeExemptCategory,
  normalizeFeeCategory
};
