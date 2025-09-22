import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  Timestamp,
  arrayUnion,
  arrayRemove,
  getDocs,
  deleteDoc
} from "firebase/firestore";
import { firebaseApp } from "@/firebase/firebase"; // your initialized FirebaseApp

const db = getFirestore(firebaseApp);

export default class ProjectModel {
  collectionRef(orgId) {
    return collection(db, "organizations", orgId, "projects");
  }
  docRef(orgId, projectId) {
    return doc(db, "organizations", orgId, "projects", projectId);
  }

  _now() {
    return Timestamp.now();
  }

  defaultData({ projectId, name, description = "", ownerUID }) {
    const now = this._now();
    return {
      projectId,
      name,
      description,
      ownerUID,
      createdAt: now,
      updatedAt: now,
      isActive: true,
      members: [
        {
          uid: ownerUID,
          role: "owner",
          status: "active",
          joinedAt: now
        }
      ],

      startDate: now,
      dueDate: null,
      milestones: [],

      status: "planning",
      progressPercent: 0,

      priority: "medium",
      category: "",
      tags: [],

      attachments: [],

      isPublic: false,
      notificationsEnabled: true,

      lastActivity: now,

      surveyIds: []
    };
  }
/** Create a new project under the specified organization */
async create(data) {
  const projectRef = this.docRef(data.orgId, data.projectId);
  await setDoc(projectRef, this.defaultData({
    projectId: data.projectId,
    name: data.name,
    description: data.description,
    ownerUID: data.ownerUID
  }));
  return projectRef;
}

  /** Get a project by organization ID and project ID */
  async getById(orgId, projectId) {
    const projectRef = this.docRef(orgId, projectId);
    const snap = await getDoc(projectRef);
    return snap.exists() ? snap.data() : null;
  }


async getAll(orgId) {
  const orgDocRef = doc(db, "organizations", orgId);
  const projectsColRef = collection(orgDocRef, "projects");
  const querySnapshot = await getDocs(projectsColRef);

  if (querySnapshot.empty) {
    return null; 
  }
  const projects = [];
  querySnapshot.forEach(doc => {
    projects.push({ id: doc.id, ...doc.data() });
  });

  return projects;
}

  async update(orgId, projectId, updateData) {
    const projectRef = this.docRef(orgId, projectId);
    await updateDoc(projectRef, {
      ...updateData,
      updatedAt: this._now()
    });
    return projectRef;
  }

  async delete(orgId, projectId) {
    const projectRef = this.docRef(orgId, projectId);
    await deleteDoc(projectRef);
    return projectRef;
  }

  /** Add a member to the project */
  async addMember(orgId, projectId, member) {
    const projectRef = this.docRef(orgId, projectId);
    await updateDoc(projectRef, {
      members: arrayUnion(member),
      updatedAt: this._now()
    });
  }

  /** Remove a member from the project */
  async removeMember(orgId, projectId, memberUid) {
    const project = await this.getById(orgId, projectId);
    if (!project) throw new Error("Project not found");

    const memberToRemove = project.members.find(m => m.uid === memberUid);
    if (!memberToRemove) return; // member not found

    const projectRef = this.docRef(orgId, projectId);
    await updateDoc(projectRef, {
      members: arrayRemove(memberToRemove),
      updatedAt: this._now()
    });
  }

  /** Add a survey ID to the project */
  async addSurveyId(orgId, projectId, surveyId) {
    const projectRef = this.docRef(orgId, projectId);
    await updateDoc(projectRef, {
      surveyIds: arrayUnion(surveyId),
      updatedAt: this._now()
    });
  }

  /** Remove a survey ID from the project */
  async removeSurveyId(orgId, projectId, surveyId) {
    const projectRef = this.docRef(orgId, projectId);
    await updateDoc(projectRef, {
      surveyIds: arrayRemove(surveyId),
      updatedAt: this._now()
    });
  }
}
