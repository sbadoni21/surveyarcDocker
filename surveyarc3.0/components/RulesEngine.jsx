export default class RuleEngine {
  constructor(rulesJson) {
    this.rules = Array.isArray(rulesJson) ? rulesJson : [];
  }

  evaluate(answers) {
    const applicableActions = [];

    for (const rule of this.rules.sort((a, b) => (a.priority || 0) - (b.priority || 0))) {
      if (!rule.enabled) continue;

      const conditions = rule.conditions || [];
      const logic = (conditions[0]?.conditionLogic || "AND").toUpperCase();

      const match =
        logic === "AND"
          ? conditions.every((cond) => this.matchCondition(cond, answers))
          : conditions.some((cond) => this.matchCondition(cond, answers));

      if (match && Array.isArray(rule.actions)) {
        applicableActions.push(...rule.actions);
      }
    }

    return applicableActions.length > 0 ? applicableActions : null;
  }

  matchCondition(condition, answers) {
    const { questionId, operator, value } = condition;
    const userValue = answers[questionId];

    // Handle empty or null userValue
    const isEmpty = userValue === undefined || userValue === null || userValue === "" ||
                    (Array.isArray(userValue) && userValue.length === 0);

    switch (operator) {
      // ---------------------- BASIC COMPARISONS ----------------------
      case "equals":
        return `${userValue}`.trim().toLowerCase() === `${value}`.trim().toLowerCase();

      case "not_equals":
        return `${userValue}`.trim().toLowerCase() !== `${value}`.trim().toLowerCase();

      case "greater_than":
        return Number(userValue) > Number(value);

      case "less_than":
        return Number(userValue) < Number(value);

      case "gte":
      case "nps_gte":
        return Number(userValue) >= Number(value);

      case "lte":
      case "nps_lte":
        return Number(userValue) <= Number(value);

      case "between":
      case "nps_between":
        if (!Array.isArray(value) || value.length !== 2) return false;
        const [min, max] = value.map(Number);
        return Number(userValue) >= min && Number(userValue) <= max;

      // ---------------------- TEXT OPERATORS ----------------------
      case "contains":
        if (Array.isArray(userValue)) return userValue.includes(value);
        return `${userValue}`.toLowerCase().includes(`${value}`.toLowerCase());

      case "not_contains":
        if (Array.isArray(userValue)) return !userValue.includes(value);
        return !`${userValue}`.toLowerCase().includes(`${value}`.toLowerCase());

      case "starts_with":
        return `${userValue}`.toLowerCase().startsWith(`${value}`.toLowerCase());

      case "ends_with":
        return `${userValue}`.toLowerCase().endsWith(`${value}`.toLowerCase());

      // ---------------------- MULTI-CHOICE OPERATORS ----------------------
      case "includes_any":
        if (!Array.isArray(userValue) || !Array.isArray(value)) return false;
        return value.some((v) => userValue.includes(v));

      case "includes_all":
        if (!Array.isArray(userValue) || !Array.isArray(value)) return false;
        return value.every((v) => userValue.includes(v));

      // ---------------------- EMPTY CHECKS ----------------------
      case "is_empty":
        return isEmpty;

      case "is_not_empty":
        return !isEmpty;

      // ---------------------- FILE / MEDIA UPLOADS ----------------------
      case "is_present":
        return !isEmpty;

      case "is_not_present":
        return isEmpty;

      // ---------------------- DATE COMPARISONS ----------------------
      case "before":
        return new Date(userValue) < new Date(value);

      case "after":
        return new Date(userValue) > new Date(value);

      case "on":
        return new Date(userValue).toDateString() === new Date(value).toDateString();

      case "between_date":
        if (!Array.isArray(value) || value.length !== 2) return false;
        const [start, end] = value.map((v) => new Date(v));
        const dateVal = new Date(userValue);
        return dateVal >= start && dateVal <= end;

      // ---------------------- YES/NO or LEGAL ----------------------
      case "yes":
        return String(userValue).toLowerCase() === "yes";
      case "no":
        return String(userValue).toLowerCase() === "no";

      // ---------------------- NPS CUSTOM ----------------------
      case "nps_is_promoter":
        return Number(userValue) >= 9 && Number(userValue) <= 10;

      case "nps_is_passive":
        return Number(userValue) >= 6 && Number(userValue) <= 8;

      case "nps_is_detractor":
        return Number(userValue) >= 0 && Number(userValue) <= 5;

      // ---------------------- DEFAULT ----------------------
      default:
        console.warn(`⚠️ Unsupported operator: ${operator}`);
        return false;
    }
  }
}
