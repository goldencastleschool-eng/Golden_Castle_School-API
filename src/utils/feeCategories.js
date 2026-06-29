const FEE_CATEGORIES = [
  { value: "new", label: "Newly Admitted" },
  { value: "returning", label: "Returning/Old" },
  { value: "vip", label: "VIP Student" },
  { value: "discounted", label: "Discounted Student" },
  { value: "staff_child", label: "Staff Child" }
];

const VALID_FEE_CATEGORIES = FEE_CATEGORIES.map((category) => category.value);
const LEGACY_FEE_CATEGORY_LABELS = {
  boarding: "Boarding Student (legacy)"
};

const normalizeFeeCategory = (feeCategory = "") =>
  feeCategory.toString().trim().toLowerCase();

const formatFeeCategoryLabel = (feeCategory = "") => {
  const normalizedCategory = normalizeFeeCategory(feeCategory);
  const category = FEE_CATEGORIES.find(
    (feeCategoryOption) => feeCategoryOption.value === normalizedCategory
  );

  return category?.label || LEGACY_FEE_CATEGORY_LABELS[normalizedCategory] || "Selected";
};

module.exports = {
  FEE_CATEGORIES,
  VALID_FEE_CATEGORIES,
  formatFeeCategoryLabel,
  normalizeFeeCategory
};
