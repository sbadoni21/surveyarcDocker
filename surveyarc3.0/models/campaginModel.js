// models/campaignModel.js
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp
} from "firebase/firestore";
import { db } from "@/firebase/firebase";

class CampaignModel {
  constructor(orgId) {
    this.orgId = orgId;
  }

  campaignsCol() {
    return collection(db, "organizations", this.orgId, "campaigns");
  }

  campaignDoc(campaignId) {
    return doc(db, "organizations", this.orgId, "campaigns", campaignId);
  }

  defaultData({
    name,
    projectId,
    surveyId,
    templateId,
    listIds = [],
    channel = "email",
    chunkSize = 50,
    contactCount = 0,
    platform = null,
    senderConfig = null,
    senderConfigId = null,
    type = null,
    createdBy = null,
  }) {
    return {
      name,
      projectId,
      surveyId,
      templateId,
      listIds,
      channel,
      chunkSize,
      contactCount,
      platform,
      senderConfig,
      senderConfigId,
      type,
      orgId: this.orgId,
      status: "created",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy,
      totals: {
        targets: contactCount,
        sent: 0,
        failed: 0,
        queued: contactCount,
        skipped: 0,
      },
    };
  }

  async create(projectId, campaignData) {
    const data = this.defaultData({ ...campaignData, projectId });
    const ref = await addDoc(this.campaignsCol(), data);
    return ref;
  }

  async get(campaignId) {
    const snap = await getDoc(this.campaignDoc(campaignId));
    return snap.exists() ? snap : null;
  }

  async getByProject(projectId) {
    const q = query(this.campaignsCol(), where("projectId", "==", projectId), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs;
  }

  async update(campaignId, updateData) {
    const ref = this.campaignDoc(campaignId);
    await updateDoc(ref, { ...updateData, updatedAt: Timestamp.now() });
    return ref;
  }

  async delete(campaignId) {
    const ref = this.campaignDoc(campaignId);
    await deleteDoc(ref);
  }

  async updateProgress(campaignId, progressData) {
    const ref = this.campaignDoc(campaignId);
    await updateDoc(ref, { totals: progressData, updatedAt: Timestamp.now() });
    return ref;
  }

  async start(campaignId) {
    const ref = this.campaignDoc(campaignId);
    await updateDoc(ref, { status: "running", startedAt: Timestamp.now(), updatedAt: Timestamp.now() });
    return ref;
  }

  async complete(campaignId, finalTotals = {}) {
    const ref = this.campaignDoc(campaignId);
    await updateDoc(ref, {
      status: "completed",
      completedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      ...(Object.keys(finalTotals).length ? { totals: finalTotals } : {}),
    });
    return ref;
  }
}

export const getCampaignModel = (orgId) => new CampaignModel(orgId);
