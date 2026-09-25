import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  Firestore,
} from 'firebase/firestore';
import { Guideline, Campaign } from '../../shared/types';
import { BASELINE_GUIDELINES } from '../../shared/baselineGuidelines';
import { AppError } from '../errors/AppError';
import { getFirestoreDB } from './FirestoreRepository';

export interface IGuidelineRepository {
  list(campaignId: string): Promise<Guideline[]>;
  getById(campaignId: string, id: string): Promise<Guideline | null>;
  create(campaignId: string, data: { title: string; text: string; type?: 'brand' | 'baseline' }): Promise<Guideline>;
  update(campaignId: string, id: string, updates: Partial<Guideline>, expectedVersion: number): Promise<Guideline>;
  delete(campaignId: string, id: string): Promise<boolean>;
  reorder(campaignId: string, orderedIds: string[]): Promise<Guideline[]>;
  seedBaselineRules(campaignId: string): Promise<Guideline[]>;
  countActiveBrand(campaignId: string): Promise<number>;
  deleteAll(campaignId: string): Promise<number>;
}

export class InMemoryGuidelineRepository implements IGuidelineRepository {
  private guidelines = new Map<string, Guideline[]>();
  private brandCounters = new Map<string, number>();

  async list(campaignId: string): Promise<Guideline[]> {
    let list = this.guidelines.get(campaignId);
    if (!list) {
      // Auto-seed baseline rules on first access if empty
      list = await this.seedBaselineRules(campaignId);
    }
    return [...list].sort((a, b) => a.order - b.order);
  }

  async getById(campaignId: string, id: string): Promise<Guideline | null> {
    const list = await this.list(campaignId);
    const item = list.find((g) => g.id === id);
    return item ? { ...item } : null;
  }

  async create(
    campaignId: string,
    data: { title: string; text: string; type?: 'brand' | 'baseline' }
  ): Promise<Guideline> {
    const list = await this.list(campaignId);
    const type = data.type || 'brand';
    const now = new Date().toISOString();

    let code: string;
    if (type === 'brand') {
      const currentCounter = this.brandCounters.get(campaignId) || 0;
      const nextCounter = currentCounter + 1;
      this.brandCounters.set(campaignId, nextCounter);
      code = `G-${nextCounter}`;
    } else {
      const count = list.filter((g) => g.type === 'baseline').length + 1;
      code = `L-${count}`;
    }

    const maxOrder = list.reduce((max, g) => Math.max(max, g.order), 0);
    const newGuideline: Guideline = {
      id: `gl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      campaignId,
      code,
      type,
      title: data.title.trim(),
      text: data.text.trim(),
      active: true,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    list.push(newGuideline);
    this.guidelines.set(campaignId, list);
    return { ...newGuideline };
  }

  async update(
    campaignId: string,
    id: string,
    updates: Partial<Guideline>,
    expectedVersion: number
  ): Promise<Guideline> {
    const list = await this.list(campaignId);
    const idx = list.findIndex((g) => g.id === id);
    if (idx === -1) {
      throw AppError.notFound('Guideline not found');
    }

    const current = list[idx];
    if (current.version !== expectedVersion) {
      throw AppError.conflict(
        `Guideline version conflict: expected ${expectedVersion}, found ${current.version}`,
        { expectedVersion, currentVersion: current.version }
      );
    }

    const updated: Guideline = {
      ...current,
      ...updates,
      title: updates.title !== undefined ? updates.title.trim() : current.title,
      text: updates.text !== undefined ? updates.text.trim() : current.text,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    };

    list[idx] = updated;
    this.guidelines.set(campaignId, list);
    return { ...updated };
  }

  async delete(campaignId: string, id: string): Promise<boolean> {
    const list = await this.list(campaignId);
    const item = list.find((g) => g.id === id);
    if (!item) {
      throw AppError.notFound('Guideline not found');
    }

    if (item.type === 'baseline') {
      throw AppError.badRequest('Baseline rules cannot be deleted; they can only be deactivated');
    }

    const nextList = list.filter((g) => g.id !== id);
    this.guidelines.set(campaignId, nextList);
    return true;
  }

  async reorder(campaignId: string, orderedIds: string[]): Promise<Guideline[]> {
    const list = await this.list(campaignId);
    const now = new Date().toISOString();

    for (let i = 0; i < orderedIds.length; i++) {
      const g = list.find((item) => item.id === orderedIds[i]);
      if (g) {
        g.order = i + 1;
        g.updatedAt = now;
      }
    }

    this.guidelines.set(campaignId, list);
    return [...list].sort((a, b) => a.order - b.order);
  }

  async seedBaselineRules(campaignId: string): Promise<Guideline[]> {
    const now = new Date().toISOString();
    const seeded: Guideline[] = BASELINE_GUIDELINES.map((base, idx) => ({
      id: `base_${idx + 1}_${campaignId.slice(-6)}`,
      campaignId,
      code: base.code,
      type: 'baseline',
      title: base.title,
      text: base.text,
      active: true,
      order: base.order,
      createdAt: now,
      updatedAt: now,
      version: 1,
    }));

    this.guidelines.set(campaignId, seeded);
    return seeded;
  }

  async countActiveBrand(campaignId: string): Promise<number> {
    const list = await this.list(campaignId);
    return list.filter((g) => g.type === 'brand' && g.active).length;
  }

  async deleteAll(campaignId: string): Promise<number> {
    const count = this.guidelines.get(campaignId)?.length || 0;
    this.guidelines.delete(campaignId);
    this.brandCounters.delete(campaignId);
    return count;
  }
}

export class FirestoreGuidelineRepository implements IGuidelineRepository {
  private db: Firestore;

  constructor(db?: Firestore) {
    this.db = db || getFirestoreDB();
  }

  private getCollection(campaignId: string) {
    return collection(this.db, `campaigns/${campaignId}/guidelines`);
  }

  async list(campaignId: string): Promise<Guideline[]> {
    const colRef = this.getCollection(campaignId);
    const snap = await getDocs(colRef);
    if (snap.empty) {
      return await this.seedBaselineRules(campaignId);
    }
    const items = snap.docs.map((d) => d.data() as Guideline);
    return items.sort((a, b) => a.order - b.order);
  }

  async getById(campaignId: string, id: string): Promise<Guideline | null> {
    const docRef = doc(this.db, `campaigns/${campaignId}/guidelines`, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as Guideline;
  }

  async create(
    campaignId: string,
    data: { title: string; text: string; type?: 'brand' | 'baseline' }
  ): Promise<Guideline> {
    const existing = await this.list(campaignId);
    const type = data.type || 'brand';
    const now = new Date().toISOString();

    // Determine next code
    let code: string;
    if (type === 'brand') {
      const campRef = doc(this.db, 'campaigns', campaignId);
      const campSnap = await getDoc(campRef);
      const campData = campSnap.data() as Campaign | undefined;
      const currentCounter = campData?.guidelineCounters?.brand || 0;
      const nextCounter = currentCounter + 1;
      
      // Persist counter on campaign
      await updateDoc(campRef, {
        'guidelineCounters.brand': nextCounter,
        guidelineIndexStale: true,
        updatedAt: now,
      });
      code = `G-${nextCounter}`;
    } else {
      const count = existing.filter((g) => g.type === 'baseline').length + 1;
      code = `L-${count}`;
    }

    const maxOrder = existing.reduce((max, g) => Math.max(max, g.order), 0);
    const id = `gl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const docRef = doc(this.db, `campaigns/${campaignId}/guidelines`, id);

    const newGuideline: Guideline = {
      id,
      campaignId,
      code,
      type,
      title: data.title.trim(),
      text: data.text.trim(),
      active: true,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    await setDoc(docRef, newGuideline);
    return newGuideline;
  }

  async update(
    campaignId: string,
    id: string,
    updates: Partial<Guideline>,
    expectedVersion: number
  ): Promise<Guideline> {
    const docRef = doc(this.db, `campaigns/${campaignId}/guidelines`, id);
    const existing = await this.getById(campaignId, id);
    if (!existing) {
      throw AppError.notFound('Guideline not found');
    }

    if (existing.version !== expectedVersion) {
      throw AppError.conflict(
        `Guideline version conflict: expected ${expectedVersion}, found ${existing.version}`,
        { expectedVersion, currentVersion: existing.version }
      );
    }

    const now = new Date().toISOString();
    const updated: Guideline = {
      ...existing,
      ...updates,
      title: updates.title !== undefined ? updates.title.trim() : existing.title,
      text: updates.text !== undefined ? updates.text.trim() : existing.text,
      version: existing.version + 1,
      updatedAt: now,
    };

    await setDoc(docRef, updated);

    // Mark campaign guideline index as stale
    const campRef = doc(this.db, 'campaigns', campaignId);
    await updateDoc(campRef, { guidelineIndexStale: true, updatedAt: now }).catch(() => {});

    return updated;
  }

  async delete(campaignId: string, id: string): Promise<boolean> {
    const existing = await this.getById(campaignId, id);
    if (!existing) {
      throw AppError.notFound('Guideline not found');
    }

    if (existing.type === 'baseline') {
      throw AppError.badRequest('Baseline rules cannot be deleted; they can only be deactivated');
    }

    const docRef = doc(this.db, `campaigns/${campaignId}/guidelines`, id);
    await deleteDoc(docRef);

    // Mark guideline index as stale
    const campRef = doc(this.db, 'campaigns', campaignId);
    await updateDoc(campRef, { guidelineIndexStale: true, updatedAt: new Date().toISOString() }).catch(() => {});

    return true;
  }

  async reorder(campaignId: string, orderedIds: string[]): Promise<Guideline[]> {
    const batch = writeBatch(this.db);
    const now = new Date().toISOString();

    orderedIds.forEach((id, index) => {
      const docRef = doc(this.db, `campaigns/${campaignId}/guidelines`, id);
      batch.update(docRef, { order: index + 1, updatedAt: now });
    });

    await batch.commit();

    // Mark guideline index as stale
    const campRef = doc(this.db, 'campaigns', campaignId);
    await updateDoc(campRef, { guidelineIndexStale: true, updatedAt: now }).catch(() => {});

    return await this.list(campaignId);
  }

  async seedBaselineRules(campaignId: string): Promise<Guideline[]> {
    const batch = writeBatch(this.db);
    const now = new Date().toISOString();
    const seeded: Guideline[] = [];

    BASELINE_GUIDELINES.forEach((base, idx) => {
      const id = `base_${idx + 1}_${campaignId.slice(-6)}`;
      const docRef = doc(this.db, `campaigns/${campaignId}/guidelines`, id);
      const rule: Guideline = {
        id,
        campaignId,
        code: base.code,
        type: 'baseline',
        title: base.title,
        text: base.text,
        active: true,
        order: base.order,
        createdAt: now,
        updatedAt: now,
        version: 1,
      };
      batch.set(docRef, rule);
      seeded.push(rule);
    });

    await batch.commit();
    return seeded;
  }

  async countActiveBrand(campaignId: string): Promise<number> {
    const list = await this.list(campaignId);
    return list.filter((g) => g.type === 'brand' && g.active).length;
  }

  async deleteAll(campaignId: string): Promise<number> {
    const list = await this.list(campaignId);
    const batch = writeBatch(this.db);
    list.forEach((g) => {
      batch.delete(doc(this.db, `campaigns/${campaignId}/guidelines`, g.id));
    });
    await batch.commit();
    return list.length;
  }
}
