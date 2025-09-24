import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  Timestamp,
  arrayUnion,
} from "firebase/firestore";
import { firebaseApp } from "@/firebase/firebase"; 

const db = getFirestore(firebaseApp);

export default new (class OrganisationModel {
  constructor() {
    this.col = collection(db, "organizations");
  }

  _now() {
    return Timestamp.now();
  }

  _endDate28d() {
    const now = this._now().toDate();
    const ms28d = 28 * 24 * 60 * 60 * 1000;
    return Timestamp.fromDate(new Date(now.getTime() + ms28d));
  }

  defaultData({ uid, name, ownerUID }) {
    const nowTs = this._now();
    const endDateTs = this._endDate28d();

    return {
      uid,
      name,
      ownerUID,
      createdAt: nowTs,
      updatedAt: nowTs,

      subscription: {
        plan: "free",
        renewalType: "none",
        startDate: nowTs,
        endDate: endDateTs,
        autoRenew: true,
        trial: { isActive: true, endsAt: endDateTs },
        quota: { surveys: 10, responses: 1000, teamMembers: 5 },
        currentUsage: { surveys: 0, responses: 0, teamMembers: 1 },
      },

      businessType: "small",
      organisationSize: 1,
      industry: "",
      tags: [],

      themeSettings: {
        primaryColor: "#1e40af",
        secondaryColor: "#facc15",
        logoUrl: "",
        darkMode: false,
      },

      // leave empty initially
      teamMembers: [],

      ssoConfig: {
        enabled: false,
        provider: "saml",
        metadataUrl: "",
        certificate: "",
        issuer: "",
      },
      scimConfig: { enabled: false, baseUrl: "", authToken: "" },
      apiRateLimits: { requestsPerMinute: 1000, burstSize: 200 },

      features: {
        survey: true,
        insights: false,
        integrations: false,
        customBranding: false,
        webhooks: false,
        apiAccess: false,
        whiteLabeling: false,
      },

      integrations: { zapier: false, slack: false, crmConnected: false },

      billingDetails: {
        gstNumber: "",
        billingEmail: "",
        billingAddress: "",
        country: "",
        currency: "INR",
        isGSTApplicable: true,
      },

      lastActivity: nowTs,
      compliance: {
        gdpr: true,
        ccpa: true,
        iso27001: false,
        lastAuditDate: nowTs,
      },

      region: "",
      country: "",
      timezone: "",
      supportedLocales: ["en"],
      defaultLocale: "en",

      dataRegion: "",
      encryption: { kmsKeyName: "", customerManaged: false },

      onboarding: { step: "welcome", startedAt: nowTs, lastStepAt: nowTs },
      referralCode: "",
      createdVia: "web",

      isActive: true,
      isSuspended: false,
      deletedAt: null,
    };
  }
  async create(orgData) {
    const { uid, ownerUID, ownerEmail } = orgData;

    const orgRef = doc(this.col, uid);

    await setDoc(orgRef, {
      ...this.defaultData({
        uid,
        name: orgData.orgName,
        ownerUID,
      }),
      ...orgData,
    });
const test = 
    await updateDoc(orgRef, {
      teamMembers: arrayUnion({
        uid: ownerUID,
        role: "owner",
        email: ownerEmail,
        status: "active",
        joinedAt: this._now(),
      }),

    });
    return orgRef;
  }

  async getById(uid) {
    const orgRef = doc(this.col, uid);
    const snap = await getDoc(orgRef);
    return snap.exists() ? snap.data() : null;
  }

  async update(uid, updateData) {
    const orgRef = doc(this.col, uid);
    await updateDoc(orgRef, {
      ...updateData,
      updatedAt: this._now(),
    });
    return orgRef;
  }

  async softDelete(uid) {
    const orgRef = doc(this.col, uid);
    await updateDoc(orgRef, {
      isActive: false,
      deletedAt: this._now(),
    });
    return orgRef;
  }
})();
