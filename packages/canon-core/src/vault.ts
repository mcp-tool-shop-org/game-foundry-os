import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface ParsedFrontmatter {
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface VaultSyncResult {
  scanned: number;
  registered: number;
  updated: number;
  invalid: Array<{ path: string; reason: string }>;
}

/**
 * Parse YAML-like frontmatter from markdown content.
 * Handles strings, arrays (- item syntax), and simple key: value pairs.
 * Does not import a YAML library — uses line-by-line parsing.
 */
export function parseMarkdownFrontmatter(content: string): ParsedFrontmatter | null {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) return null;

  const firstDelim = trimmed.indexOf('---');
  const secondDelim = trimmed.indexOf('---', firstDelim + 3);
  if (secondDelim === -1) return null;

  const yamlBlock = trimmed.slice(firstDelim + 3, secondDelim).trim();
  const body = trimmed.slice(secondDelim + 3).trim();

  if (yamlBlock.length === 0) {
    return { frontmatter: {}, body };
  }

  const frontmatter: Record<string, unknown> = {};
  const lines = yamlBlock.split('\n');
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    const trimLine = line.trimEnd();

    // Array item
    if (trimLine.match(/^\s+-\s+/) && currentKey) {
      const value = trimLine.replace(/^\s+-\s+/, '').trim();
      if (!currentArray) {
        currentArray = [];
      }
      currentArray.push(stripQuotes(value));
      frontmatter[currentKey] = currentArray;
      continue;
    }

    // Flush any pending array
    if (currentArray) {
      currentArray = null;
    }

    // Key: value pair
    const kvMatch = trimLine.match(/^(\w[\w_-]*)\s*:\s*(.*)/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const rawValue = kvMatch[2].trim();

      if (rawValue === '' || rawValue === '[]') {
        // Could be an array on following lines, or empty value
        frontmatter[currentKey] = rawValue === '[]' ? [] : '';
        currentArray = rawValue === '' ? null : null;
        continue;
      }

      // Inline array: [a, b, c]
      if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
        const inner = rawValue.slice(1, -1);
        frontmatter[currentKey] = inner
          .split(',')
          .map((s) => stripQuotes(s.trim()))
          .filter((s) => s.length > 0);
        continue;
      }

      // Boolean
      if (rawValue === 'true') {
        frontmatter[currentKey] = true;
        continue;
      }
      if (rawValue === 'false') {
        frontmatter[currentKey] = false;
        continue;
      }

      // Number
      if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
        frontmatter[currentKey] = Number(rawValue);
        continue;
      }

      // String (strip quotes if present)
      frontmatter[currentKey] = stripQuotes(rawValue);
    }
  }

  return { frontmatter, body };
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * Walk a vault directory recursively, find all .md files, parse frontmatter,
 * and register/update canon_pages in the database.
 */
export function syncVault(
  db: Database.Database,
  projectId: string,
  vaultRoot: string,
): VaultSyncResult {
  const result: VaultSyncResult = { scanned: 0, registered: 0, updated: 0, invalid: [] };

  const mdFiles = walkMdFiles(vaultRoot);

  for (const filePath of mdFiles) {
    result.scanned++;
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseMarkdownFrontmatter(content);

    if (!parsed) {
      result.invalid.push({ path: filePath, reason: 'No frontmatter found' });
      continue;
    }

    const fm = parsed.frontmatter;
    const canonId = fm.canon_id as string | undefined;
    const kind = fm.kind as string | undefined;
    const title = fm.title as string | undefined;

    if (!canonId || !kind || !title) {
      result.invalid.push({
        path: filePath,
        reason: `Missing required frontmatter fields: ${[
          !canonId && 'canon_id',
          !kind && 'kind',
          !title && 'title',
        ].filter(Boolean).join(', ')}`,
      });
      continue;
    }

    const contentHash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
    const relativePath = path.relative(vaultRoot, filePath).replace(/\\/g, '/');

    const existing = db.prepare('SELECT * FROM canon_pages WHERE canon_id = ?').get(canonId) as
      | { id: string; content_hash: string | null }
      | undefined;

    if (existing) {
      if (existing.content_hash !== contentHash) {
        db.prepare(`
          UPDATE canon_pages SET
            kind = ?, title = ?, vault_path = ?, content_hash = ?,
            frontmatter_json = ?, updated_at = datetime('now')
          WHERE canon_id = ?
        `).run(kind, title, relativePath, contentHash, JSON.stringify(fm), canonId);
        result.updated++;
      }
    } else {
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO canon_pages (id, project_id, canon_id, kind, title, vault_path, content_hash, frontmatter_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, projectId, canonId, kind, title, relativePath, contentHash, JSON.stringify(fm));
      result.registered++;
    }
  }

  // Record sync event
  db.prepare(`
    INSERT INTO state_events (project_id, entity_type, entity_id, from_state, to_state, reason, tool_name, payload_json)
    VALUES (?, 'vault', ?, 'idle', 'synced', ?, 'canon_sync_vault', ?)
  `).run(
    projectId,
    projectId,
    `Synced ${result.scanned} files`,
    JSON.stringify(result),
  );

  return result;
}

function walkMdFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMdFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}
