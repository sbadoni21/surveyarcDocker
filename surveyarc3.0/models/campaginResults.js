// models/campaignResultModel.js
import {
  collection,
  doc,
  updateDoc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  deleteDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";

class CampaignResultModel {
  constructor(orgId) {
    this.orgId = orgId;
  }

  resultsCol(campaignId) {
    return collection(db, "organizations", this.orgId, "campaignResults", campaignId, "results");
  }

  resultDoc(campaignId, resultId) {
    return doc(db, "organizations", this.orgId, "campaignResults", campaignId, "results", resultId);
  }

  defaultData({
    contactId,
    campaignId,
    messageId = null,
    status = "queued",
    channel = "email",
    recipient = null,
    error = null,
    providerMessageId = null,
    provider = null,
    sentAt = null,
    failedAt = null,
  }) {
    return {
      contactId,
      campaignId,
      messageId,
      status,
      channel,
      recipient,
      error,
      providerMessageId,
      provider,
      sentAt,
      failedAt,
      orgId: this.orgId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
  }

  async create(campaignId, resultData) {
    const data = this.defaultData({ ...resultData, campaignId });
    const ref = await addDoc(this.resultsCol(campaignId), data);
    return ref;
  }

  async getByCampaign(campaignId) {
    const q = query(this.resultsCol(campaignId), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs;
  }

  async get(campaignId, resultId) {
    const snap = await getDoc(this.resultDoc(campaignId, resultId));
    return snap.exists() ? snap : null;
  }

  async update(campaignId, resultId, updateData) {
    await updateDoc(this.resultDoc(campaignId, resultId), { ...updateData, updatedAt: Timestamp.now() });
  }

  async delete(campaignId, resultId) {
    await deleteDoc(this.resultDoc(campaignId, resultId));
  }
}

export const getCampaignResultModel = (orgId) => new CampaignResultModel(orgId);
