const FEE_SECTIONS = {
  EARLY_YEARS: "early_years",
  NURSERY: "nursery",
  BASIC: "basic",
  JUNIOR_SECONDARY: "junior_secondary",
  SENIOR_SECONDARY: "senior_secondary"
};

const FEE_SECTION_LABELS = {
  [FEE_SECTIONS.EARLY_YEARS]: "Creche / Pre-Grade (PG-1 - PG-2)",
  [FEE_SECTIONS.NURSERY]: "Nursery (Nur 1 - Nur 3)",
  [FEE_SECTIONS.BASIC]: "Basic (B1 - B5)",
  [FEE_SECTIONS.JUNIOR_SECONDARY]: "Junior Secondary (JSS 1 - JSS 3)",
  [FEE_SECTIONS.SENIOR_SECONDARY]: "Senior Secondary (SS 1 - SS 3)"
};

const VALID_FEE_SECTIONS = Object.values(FEE_SECTIONS);

const compact = (value = "") => value.toString().toLowerCase().replace(/[^a-z0-9]/g, "");

const getFeeSectionForClass = (classRecord = {}) => {
  const name = compact(classRecord.name || classRecord);

  if (/(creche|pg1|pg2|pregrade|playgroup|preprimary|prekg)/.test(name)) {
    return FEE_SECTIONS.EARLY_YEARS;
  }
  if (/(nursery|nur1|nur2|nur3|kg1|kg2|kg3)/.test(name)) {
    return FEE_SECTIONS.NURSERY;
  }
  if (/(jss|juniorsecondary|js1|js2|js3)/.test(name)) {
    return FEE_SECTIONS.JUNIOR_SECONDARY;
  }
  if (/(sss|ss1|ss2|ss3|seniorsecondary)/.test(name)) {
    return FEE_SECTIONS.SENIOR_SECONDARY;
  }
  if (/(basic|primary|pry|grade|b1|b2|b3|b4|b5)/.test(name)) {
    return FEE_SECTIONS.BASIC;
  }

  return "";
};

module.exports = {
  FEE_SECTIONS,
  FEE_SECTION_LABELS,
  VALID_FEE_SECTIONS,
  getFeeSectionForClass
};
