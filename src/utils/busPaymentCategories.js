const BUS_PAYMENT_CATEGORIES = [
  { value: "both", label: "Pickup & Dropping" },
  { value: "pickup_only", label: "Pickup Only" },
  { value: "dropoff_only", label: "Dropping Only" },
  { value: "discounted", label: "Discounted Student" }
];

const VALID_BUS_PAYMENT_CATEGORIES = BUS_PAYMENT_CATEGORIES.map(
  (category) => category.value
);

const normalizeBusPaymentCategory = (category = "") =>
  category.toString().trim().toLowerCase() || "both";

const formatBusPaymentCategoryLabel = (category = "") => {
  const normalizedCategory = normalizeBusPaymentCategory(category);
  const categoryOption = BUS_PAYMENT_CATEGORIES.find(
    (option) => option.value === normalizedCategory
  );

  return categoryOption?.label || "Pickup & Dropping";
};

module.exports = {
  BUS_PAYMENT_CATEGORIES,
  VALID_BUS_PAYMENT_CATEGORIES,
  formatBusPaymentCategoryLabel,
  normalizeBusPaymentCategory
};
