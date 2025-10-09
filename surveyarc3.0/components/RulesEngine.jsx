export default class RuleEngine {
  constructor(rulesJson) {
    // console.log("Initializing RuleEngine with rules:", rulesJson);
    this.rules = Array.isArray(rulesJson) ? rulesJson : [];
  }

 evaluate(answers) {
  const applicableActions = [];
// console.log(answers);
  for (const rule of this.rules.sort((a, b) => (a.priority || 0) - (b.priority || 0))) {
    if (!rule.enabled) continue;

    const conditions = rule.conditions || [];
    // console.log(conditions);
    const logic = (conditions[0]?.conditionLogic || "AND").toUpperCase(); // use first condition's logic

    // Evaluate all conditions
    const match = logic === "AND"
      ? conditions.every(cond => this.matchCondition(cond, answers))
      : conditions.some(cond => this.matchCondition(cond, answers));

    // console.log(`Rule ${rule.ruleId} matched?`, match);

    if (match && Array.isArray(rule.actions)) {
      applicableActions.push(...rule.actions);
    }
  }

  return applicableActions.length > 0 ? applicableActions : null;
}


  matchCondition(condition, answers) {
    const { questionId, operator, value } = condition;
    // console.log(answers);
    // console.log(questionId)
    const userValue = answers[questionId];


    // console.log("uservalue",userValue);
    // console.log("value",value);
    // console.log(`➡️ Condition: [${operator}] Q:${questionId}, Expected: ${value}, Actual: ${userValue}`);

    if (userValue === undefined || userValue === null) return false;
    switch (operator) {
      case "equals":
        return (
          `${userValue}`.trim().toLowerCase() === `${value}`.trim().toLowerCase()
        );

      case "not_equals":
        return (
          `${userValue}`.trim().toLowerCase() !==
          `${value}`.trim().toLowerCase()
        );

      case "less_than":
        return (
          `${userValue}` < `${value}`
        );

      case "greater_than":
        return (
          `${userValue}` > `${value}`
        );

      case "contains":
        return Array.isArray(userValue) && userValue.includes(value);

      default:
        // console.warn(`⚠️ Unsupported operator: ${operator}`);
        return false;
    }
  }
}
