// ============================== models/campaignProgressModel.js ==============================
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  query,
  where,
  Timestamp,
  increment,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";

export default class CampaignProgressModel {
  constructor(orgId) {
    this.orgId = orgId;
  }

  // /organizations/{orgId}/campaignProgress/{campaignId}
  progressDoc(campaignId) {
    return doc(db, "organizations", this.orgId, "campaignProgress", campaignId);
  }

  progressCol() {
    return collection(db, "organizations", this.orgId, "campaignProgress");
  }

  defaultTotals(overrides = {}) {
    return {
      targets: 0,
      queued: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      ...overrides,
    };
  }

  // Create or merge a progress doc
  async upsert({
    campaignId,
    projectId,
    percentage = 0,
    totals = {},
    status = "created",
  }) {
    const ref = this.progressDoc(campaignId);
    const base = {
      campaignId,
      projectId,
      orgId: this.orgId,
      status,
      percentage,
      totals: this.defaultTotals(totals),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    await setDoc(ref, base, { merge: true });
    return ref;
  }

  // Mark when campaign starts
  async markStarted(campaignId, projectId, targets = 0) {
    const ref = this.progressDoc(campaignId);
    await setDoc(
      ref,
      {
        campaignId,
        projectId,
        orgId: this.orgId,
        status: "running",
        startedAt: Timestamp.now(),
        percentage: 0,
        totals: this.defaultTotals({ targets, queued: targets }),
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
    return ref;
  }

  // Incremental tick updates while processing
  async tick(campaignId, { sent = 0, failed = 0, skipped = 0, queued = 0 }) {
    const ref = this.progressDoc(campaignId);
    await updateDoc(ref, {
      "totals.sent": increment(sent),
      "totals.failed": increment(failed),
      "totals.skipped": increment(skipped),
      "totals.queued": increment(queued),
      updatedAt: Timestamp.now(),
    });
    return ref;
  }

  async setPercentage(campaignId, percentage) {
    const ref = this.progressDoc(campaignId);
    await updateDoc(ref, { percentage, updatedAt: Timestamp.now() });
    return ref;
  }

  async markCompleted(campaignId) {
    const ref = this.progressDoc(campaignId);
    await updateDoc(ref, {
      status: "completed",
      percentage: 100,
      completedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return ref;
  }

  async get(campaignId) {
    const snap = await getDoc(this.progressDoc(campaignId));
    return snap.exists() ? snap : null;
  }

  // Listener helpers (optional)
  listenProject(projectId, cb) {
    const q = query(this.progressCol(), where("projectId", "==", projectId));
    return onSnapshot(q, cb);
  }
}

// Singleton export helper (optional)
export const campaignProgressModel = new CampaignProgressModel();
