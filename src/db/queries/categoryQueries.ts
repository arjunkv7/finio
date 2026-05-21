import { v4 as uuidv4 } from 'uuid';
import { SQLiteBindValue } from 'expo-sqlite';
import { getDb } from '../database';
import {
  Category,
  CategoryType,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../../types/db';

const now = () => new Date().toISOString();

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  const db = await getDb();
  const id = uuidv4();
  const ts = now();
  await db.runAsync(
    `INSERT INTO categories (id, name, type, icon, color, is_system, is_deleted, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`,
    [id, input.name, input.type, input.icon, input.color, input.sort_order ?? 0, ts]
  );
  return getCategoryById(id) as Promise<Category>;
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const db = await getDb();
  return db.getFirstAsync<Category>(
    'SELECT * FROM categories WHERE id = ? AND is_deleted = 0',
    [id]
  );
}

export async function getAllCategories(): Promise<Category[]> {
  const db = await getDb();
  return db.getAllAsync<Category>(
    'SELECT * FROM categories WHERE is_deleted = 0 ORDER BY type ASC, sort_order ASC'
  );
}

export async function getCategoriesByType(type: CategoryType): Promise<Category[]> {
  const db = await getDb();
  return db.getAllAsync<Category>(
    'SELECT * FROM categories WHERE type = ? AND is_deleted = 0 ORDER BY sort_order ASC',
    [type]
  );
}

export async function updateCategory(id: string, input: UpdateCategoryInput): Promise<Category | null> {
  const db = await getDb();
  const fields = { ...input } as Record<string, SQLiteBindValue>;
  const keys = Object.keys(fields);
  if (keys.length === 0) return getCategoryById(id);

  // Prevent editing system categories' names and types
  const existing = await getCategoryById(id);
  if (existing?.is_system) {
    delete fields['name'];
    delete fields['type'];
  }

  const finalKeys = Object.keys(fields);
  if (finalKeys.length === 0) return existing;

  const setClause = finalKeys.map(k => `${k} = ?`).join(', ');
  await db.runAsync(
    `UPDATE categories SET ${setClause} WHERE id = ?`,
    [...Object.values(fields), id]
  );
  return getCategoryById(id);
}

// Soft delete — system categories cannot be deleted
export async function deleteCategory(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE categories SET is_deleted = 1 WHERE id = ? AND is_system = 0',
    [id]
  );
}
