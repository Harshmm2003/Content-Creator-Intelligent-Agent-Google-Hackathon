import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  Firestore,
} from 'firebase/firestore';
import { CandidateCreator, BulkCreateCreatorsResponse, BulkCreatorResultItem } from '../../shared/types';
import { parseCreatorInput } from '../../shared/creatorInputParser';
import { CONFIG } from '../../shared/config';
import { AppError } from '../errors/AppError';
import { getFirestoreDB } from './FirestoreRepository';

export interface CreatorListOptions {
  status?: string;
  selected?: boolean;
  sort?: string; // 'createdAt' | 'name' | 'plannedPublishDate'
}

export interface ICreatorRepository {
  list(campaignId: string, options?: CreatorListOptions): Promise<CandidateCreator[]>;
  getById(campaignId: string, id: string): Promise<CandidateCreator | null>;
  create(campaignId: string, input: string): Promise<CandidateCreator>;
  bulkCreate(campaignId: string, inputs: string[]): Promise<BulkCreateCreatorsResponse>;
  update(
    campaignId: string,
    id: string,
    updates: Partial<Pick<CandidateCreator, 'notes' | 'tags' | 'selected' | 'plannedPublishDate'>>,
    expectedVersion: number
  ): Promise<CandidateCreator>;
  delete(campaignId: string, id: string): Promise<boolean>;
  count(campaignId: string): Promise<number>;
  deleteAll(campaignId: string): Promise<number>;
}

export class InMemoryCreatorRepository implements ICreatorRepository {
  private creators = new Map<string, CandidateCreator[]>();

  async list(campaignId: string, options?: CreatorListOptions): Promise<CandidateCreator[]> {
    let list = this.creators.get(campaignId) || [];

    if (options?.status) {
      list = list.filter((c) => c.status === options.status);
    }

    if (options?.selected !== undefined) {
      list = list.filter((c) => c.selected === options.selected);
    }

    return [...list].sort((a, b) => {
      if (options?.sort === 'plannedPublishDate') {
        const da = a.plannedPublishDate || '9999';
        const db = b.plannedPublishDate || '9999';
        return da.localeCompare(db);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  async getById(campaignId: string, id: string): Promise<CandidateCreator | null> {
    const list = this.creators.get(campaignId) || [];
    const item = list.find((c) => c.id === id);
    return item ? { ...item } : null;
  }

  async create(campaignId: string, rawInput: string): Promise<CandidateCreator> {
    const parsed = parseCreatorInput(rawInput);
    if (!parsed.valid) {
      throw AppError.badRequest(parsed.reason);
    }

    const currentList = this.creators.get(campaignId) || [];
    if (currentList.length >= CONFIG.MAX_CREATORS_PER_CAMPAIGN) {
      throw AppError.badRequest(
        `Campaign limit reached: maximum ${CONFIG.MAX_CREATORS_PER_CAMPAIGN} creators allowed`
      );
    }

    const duplicate = currentList.find((c) => c.normalizedKey === parsed.normalizedKey);
    if (duplicate) {
      throw AppError.conflict(`Creator "${parsed.value}" is already in this campaign`);
    }

    const now = new Date().toISOString();
    const newCreator: CandidateCreator = {
      id: `cr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      campaignId,
      input: rawInput.trim(),
      inputType: parsed.inputType,
      normalizedKey: parsed.normalizedKey,
      status: 'pending',
      channel: null,
      metrics: null,
      scores: null,
      selected: false,
      plannedPublishDate: null,
      notes: '',
      tags: [],
      error: null,
      analyzedAt: null,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    currentList.push(newCreator);
    this.creators.set(campaignId, currentList);
    return { ...newCreator };
  }

  async bulkCreate(campaignId: string, inputs: string[]): Promise<BulkCreateCreatorsResponse> {
    const currentList = this.creators.get(campaignId) || [];
    const results: BulkCreatorResultItem[] = [];
    const existingKeys = new Set(currentList.map((c) => c.normalizedKey));
    let addedCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;

    for (const rawInput of inputs) {
      const trimmed = rawInput.trim();
      if (!trimmed) continue;

      const parsed = parseCreatorInput(trimmed);
      if (!parsed.valid) {
        results.push({
          input: trimmed,
          status: 'invalid',
          reason: parsed.reason,
        });
        invalidCount++;
        continue;
      }

      if (existingKeys.has(parsed.normalizedKey)) {
        results.push({
          input: trimmed,
          status: 'duplicate',
          reason: `Already in campaign (${parsed.value})`,
        });
        duplicateCount++;
        continue;
      }

      if (currentList.length + addedCount >= CONFIG.MAX_CREATORS_PER_CAMPAIGN) {
        results.push({
          input: trimmed,
          status: 'invalid',
          reason: `Limit reached: maximum ${CONFIG.MAX_CREATORS_PER_CAMPAIGN} creators per campaign`,
        });
        invalidCount++;
        continue;
      }

      const now = new Date().toISOString();
      const newCreator: CandidateCreator = {
        id: `cr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        campaignId,
        input: trimmed,
        inputType: parsed.inputType,
        normalizedKey: parsed.normalizedKey,
        status: 'pending',
        channel: null,
        metrics: null,
        scores: null,
        selected: false,
        plannedPublishDate: null,
        notes: '',
        tags: [],
        error: null,
        analyzedAt: null,
        createdAt: now,
        updatedAt: now,
        version: 1,
      };

      currentList.push(newCreator);
      existingKeys.add(parsed.normalizedKey);
      addedCount++;
      results.push({
        input: trimmed,
        status: 'added',
        creator: newCreator,
      });
    }

    this.creators.set(campaignId, currentList);
    return {
      results,
      addedCount,
      duplicateCount,
      invalidCount,
      totalCreatorsInCampaign: currentList.length,
    };
  }

  async update(
    campaignId: string,
    id: string,
    updates: Partial<Pick<CandidateCreator, 'notes' | 'tags' | 'selected' | 'plannedPublishDate'>>,
    expectedVersion: number
  ): Promise<CandidateCreator> {
    const currentList = this.creators.get(campaignId) || [];
    const idx = currentList.findIndex((c) => c.id === id);
    if (idx === -1) {
      throw AppError.notFound('Creator not found');
    }

    const current = currentList[idx];
    if (current.version !== expectedVersion) {
      throw AppError.conflict(
        `Creator version conflict: expected ${expectedVersion}, found ${current.version}`,
        { expectedVersion, currentVersion: current.version }
      );
    }

    const updated: CandidateCreator = {
      ...current,
      notes: updates.notes !== undefined ? updates.notes : current.notes,
      tags: updates.tags !== undefined ? updates.tags : current.tags,
      selected: updates.selected !== undefined ? updates.selected : current.selected,
      plannedPublishDate:
        updates.plannedPublishDate !== undefined ? updates.plannedPublishDate : current.plannedPublishDate,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    };

    currentList[idx] = updated;
    this.creators.set(campaignId, currentList);
    return { ...updated };
  }

  async delete(campaignId: string, id: string): Promise<boolean> {
    const currentList = this.creators.get(campaignId) || [];
    const idx = currentList.findIndex((c) => c.id === id);
    if (idx === -1) {
      throw AppError.notFound('Creator not found');
    }
    currentList.splice(idx, 1);
    this.creators.set(campaignId, currentList);
    return true;
  }

  async count(campaignId: string): Promise<number> {
    return (this.creators.get(campaignId) || []).length;
  }

  async deleteAll(campaignId: string): Promise<number> {
    const count = (this.creators.get(campaignId) || []).length;
    this.creators.delete(campaignId);
    return count;
  }
}

export class FirestoreCreatorRepository implements ICreatorRepository {
  private db: Firestore;

  constructor(db?: Firestore) {
    this.db = db || getFirestoreDB();
  }

  private getCollection(campaignId: string) {
    return collection(this.db, `campaigns/${campaignId}/creators`);
  }

  async list(campaignId: string, options?: CreatorListOptions): Promise<CandidateCreator[]> {
    const colRef = this.getCollection(campaignId);
    const snap = await getDocs(colRef);
    let items = snap.docs.map((d) => d.data() as CandidateCreator);

    if (options?.status) {
      items = items.filter((c) => c.status === options.status);
    }

    if (options?.selected !== undefined) {
      items = items.filter((c) => c.selected === options.selected);
    }

    return items.sort((a, b) => {
      if (options?.sort === 'plannedPublishDate') {
        const da = a.plannedPublishDate || '9999';
        const db = b.plannedPublishDate || '9999';
        return da.localeCompare(db);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  async getById(campaignId: string, id: string): Promise<CandidateCreator | null> {
    const docRef = doc(this.db, `campaigns/${campaignId}/creators`, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as CandidateCreator;
  }

  async create(campaignId: string, rawInput: string): Promise<CandidateCreator> {
    const parsed = parseCreatorInput(rawInput);
    if (!parsed.valid) {
      throw AppError.badRequest(parsed.reason);
    }

    const currentList = await this.list(campaignId);
    if (currentList.length >= CONFIG.MAX_CREATORS_PER_CAMPAIGN) {
      throw AppError.badRequest(
        `Campaign limit reached: maximum ${CONFIG.MAX_CREATORS_PER_CAMPAIGN} creators allowed`
      );
    }

    const duplicate = currentList.find((c) => c.normalizedKey === parsed.normalizedKey);
    if (duplicate) {
      throw AppError.conflict(`Creator "${parsed.value}" is already in this campaign`);
    }

    const id = `cr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const newCreator: CandidateCreator = {
      id,
      campaignId,
      input: rawInput.trim(),
      inputType: parsed.inputType,
      normalizedKey: parsed.normalizedKey,
      status: 'pending',
      channel: null,
      metrics: null,
      scores: null,
      selected: false,
      plannedPublishDate: null,
      notes: '',
      tags: [],
      error: null,
      analyzedAt: null,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    const docRef = doc(this.db, `campaigns/${campaignId}/creators`, id);
    await setDoc(docRef, newCreator);
    return newCreator;
  }

  async bulkCreate(campaignId: string, inputs: string[]): Promise<BulkCreateCreatorsResponse> {
    const currentList = await this.list(campaignId);
    const results: BulkCreatorResultItem[] = [];
    const existingKeys = new Set(currentList.map((c) => c.normalizedKey));
    const toSave: CandidateCreator[] = [];

    let addedCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;

    for (const rawInput of inputs) {
      const trimmed = rawInput.trim();
      if (!trimmed) continue;

      const parsed = parseCreatorInput(trimmed);
      if (!parsed.valid) {
        results.push({
          input: trimmed,
          status: 'invalid',
          reason: parsed.reason,
        });
        invalidCount++;
        continue;
      }

      if (existingKeys.has(parsed.normalizedKey)) {
        results.push({
          input: trimmed,
          status: 'duplicate',
          reason: `Already in campaign (${parsed.value})`,
        });
        duplicateCount++;
        continue;
      }

      if (currentList.length + addedCount >= CONFIG.MAX_CREATORS_PER_CAMPAIGN) {
        results.push({
          input: trimmed,
          status: 'invalid',
          reason: `Limit reached: maximum ${CONFIG.MAX_CREATORS_PER_CAMPAIGN} creators per campaign`,
        });
        invalidCount++;
        continue;
      }

      const id = `cr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date().toISOString();

      const newCreator: CandidateCreator = {
        id,
        campaignId,
        input: trimmed,
        inputType: parsed.inputType,
        normalizedKey: parsed.normalizedKey,
        status: 'pending',
        channel: null,
        metrics: null,
        scores: null,
        selected: false,
        plannedPublishDate: null,
        notes: '',
        tags: [],
        error: null,
        analyzedAt: null,
        createdAt: now,
        updatedAt: now,
        version: 1,
      };

      toSave.push(newCreator);
      existingKeys.add(parsed.normalizedKey);
      addedCount++;
      results.push({
        input: trimmed,
        status: 'added',
        creator: newCreator,
      });
    }

    if (toSave.length > 0) {
      const batch = writeBatch(this.db);
      for (const c of toSave) {
        const docRef = doc(this.db, `campaigns/${campaignId}/creators`, c.id);
        batch.set(docRef, c);
      }
      await batch.commit();
    }

    return {
      results,
      addedCount,
      duplicateCount,
      invalidCount,
      totalCreatorsInCampaign: currentList.length + addedCount,
    };
  }

  async update(
    campaignId: string,
    id: string,
    updates: Partial<Pick<CandidateCreator, 'notes' | 'tags' | 'selected' | 'plannedPublishDate'>>,
    expectedVersion: number
  ): Promise<CandidateCreator> {
    const existing = await this.getById(campaignId, id);
    if (!existing) {
      throw AppError.notFound('Creator not found');
    }

    if (existing.version !== expectedVersion) {
      throw AppError.conflict(
        `Creator version conflict: expected ${expectedVersion}, found ${existing.version}`,
        { expectedVersion, currentVersion: existing.version }
      );
    }

    const now = new Date().toISOString();
    const updated: CandidateCreator = {
      ...existing,
      notes: updates.notes !== undefined ? updates.notes : existing.notes,
      tags: updates.tags !== undefined ? updates.tags : existing.tags,
      selected: updates.selected !== undefined ? updates.selected : existing.selected,
      plannedPublishDate:
        updates.plannedPublishDate !== undefined ? updates.plannedPublishDate : existing.plannedPublishDate,
      version: existing.version + 1,
      updatedAt: now,
    };

    const docRef = doc(this.db, `campaigns/${campaignId}/creators`, id);
    await setDoc(docRef, updated);
    return updated;
  }

  async delete(campaignId: string, id: string): Promise<boolean> {
    const existing = await this.getById(campaignId, id);
    if (!existing) {
      throw AppError.notFound('Creator not found');
    }
    const docRef = doc(this.db, `campaigns/${campaignId}/creators`, id);
    await deleteDoc(docRef);
    return true;
  }

  async count(campaignId: string): Promise<number> {
    const snap = await getDocs(this.getCollection(campaignId));
    return snap.size;
  }

  async deleteAll(campaignId: string): Promise<number> {
    const list = await this.list(campaignId);
    const batch = writeBatch(this.db);
    list.forEach((c) => {
      batch.delete(doc(this.db, `campaigns/${campaignId}/creators`, c.id));
    });
    await batch.commit();
    return list.length;
  }
}
