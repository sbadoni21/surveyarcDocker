// utils/quotaRuntime.js
import quotaModel from "@/models/postGresModels/quotaModel";

/**
 * Evaluate all quotas for current answers
 */
export async function evaluateQuotas({
  quotas = [],
  answers = {},
  respondentId = null,
}) {
  for (const quota of quotas) {
    try {
      const res = await quotaModel.evaluate(quota.id, {
        respondent_id: respondentId,
        facts: answers,
      });

      if (res?.blocked) {
        return {
          blocked: true,
          quotaId: quota.id,
          reason: res.reason,
          action: res.action || quota.whenMet,
          actionPayload: res.action_payload || quota.actionPayload,
        };
      }
    } catch (err) {
      console.error("Quota evaluate failed:", quota.id, err);
    }
  }

  return { blocked: false };
}

/**
 * Increment matched quota cells
 */
export async function incrementQuotas({
  quotas = [],
  answers = {},
  respondentId = null,
}) {
  for (const quota of quotas) {
    try {
      const evalRes = await quotaModel.evaluate(quota.id, {
        respondent_id: respondentId,
        facts: answers,
      });

      const matchedCells = evalRes?.matchedCells || [];

      for (const cellId of matchedCells) {
        await quotaModel.increment(quota.id, {
          matched_cell_id: cellId,
          respondent_id: respondentId,
          reason: "complete",
        });
      }
    } catch (err) {
      console.error("Quota increment failed:", quota.id, err);
    }
  }
}