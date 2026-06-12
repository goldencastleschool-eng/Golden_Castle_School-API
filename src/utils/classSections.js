const CLASS_SECTIONS = {
  PRE_NURSERY: "pre_nursery",
  NURSERY: "nursery",
  BASIC: "basic",
  SECONDARY: "secondary"
};

const CLASS_SECTION_LABELS = {
  [CLASS_SECTIONS.PRE_NURSERY]: "Pre Nursery",
  [CLASS_SECTIONS.NURSERY]: "Nursery",
  [CLASS_SECTIONS.BASIC]: "Basic",
  [CLASS_SECTIONS.SECONDARY]: "Secondary"
};

const VALID_CLASS_SECTIONS = Object.values(CLASS_SECTIONS);

const compactValue = (value = "") =>
  value.toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const normalizeClassSection = (section = "") => {
  const compactSection = compactValue(section);

  if (!compactSection) {
    return "";
  }

  if (
    ["prenursery", "preprimary", "prekg", "playgroup", "creche"].includes(
      compactSection
    )
  ) {
    return CLASS_SECTIONS.PRE_NURSERY;
  }

  if (["nursery", "kindergarten", "kg"].includes(compactSection)) {
    return CLASS_SECTIONS.NURSERY;
  }

  if (["basic", "primary", "pry", "grade"].includes(compactSection)) {
    return CLASS_SECTIONS.BASIC;
  }

  if (
    [
      "secondary",
      "juniorsecondary",
      "seniorsecondary",
      "jss",
      "sss",
      "js",
      "ss"
    ].includes(compactSection)
  ) {
    return CLASS_SECTIONS.SECONDARY;
  }

  return VALID_CLASS_SECTIONS.includes(section) ? section : "";
};

const inferClassSection = (className = "") => {
  const compactName = compactValue(className);

  if (!compactName) {
    return "";
  }

  if (
    compactName.includes("prenursery") ||
    compactName.includes("preprimary") ||
    compactName.includes("playgroup") ||
    compactName.includes("creche") ||
    compactName.includes("prekg")
  ) {
    return CLASS_SECTIONS.PRE_NURSERY;
  }

  if (
    compactName.includes("nursery") ||
    compactName.startsWith("kg") ||
    compactName.includes("kindergarten")
  ) {
    return CLASS_SECTIONS.NURSERY;
  }

  if (
    compactName.includes("jss") ||
    compactName.includes("sss") ||
    compactName.includes("juniorsecondary") ||
    compactName.includes("seniorsecondary") ||
    compactName.includes("secondary") ||
    /^js[0-9]/.test(compactName) ||
    /^ss[0-9]/.test(compactName)
  ) {
    return CLASS_SECTIONS.SECONDARY;
  }

  if (
    compactName.includes("basic") ||
    compactName.includes("primary") ||
    compactName.startsWith("pry") ||
    compactName.startsWith("grade")
  ) {
    return CLASS_SECTIONS.BASIC;
  }

  return "";
};

const getClassSection = (classRecord = {}) =>
  normalizeClassSection(classRecord.section) ||
  inferClassSection(classRecord.name);

const isSecondaryClass = (classRecord = {}) =>
  getClassSection(classRecord) === CLASS_SECTIONS.SECONDARY;

const formatClassSection = (section = "") =>
  CLASS_SECTION_LABELS[normalizeClassSection(section)] || "Not set";

module.exports = {
  CLASS_SECTIONS,
  CLASS_SECTION_LABELS,
  VALID_CLASS_SECTIONS,
  formatClassSection,
  getClassSection,
  inferClassSection,
  isSecondaryClass,
  normalizeClassSection
};
