import type Database from 'better-sqlite3';
import type { ProjectTemplateRow } from '@mcptoolshop/game-foundry-registry';
import crypto from 'node:crypto';

export interface RegisterTemplateInput {
  template_key: string;
  display_name: string;
  engine: string;
  genre_profile?: string;
  version?: string;
  description?: string;
}

export function registerTemplate(db: Database.Database, input: RegisterTemplateInput): ProjectTemplateRow {
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO project_templates (id, template_key, display_name, engine, genre_profile, version, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(template_key) DO UPDATE SET
      display_name = excluded.display_name,
      engine = excluded.engine,
      genre_profile = excluded.genre_profile,
      version = excluded.version,
      description = excluded.description
  `).run(
    id,
    input.template_key,
    input.display_name,
    input.engine,
    input.genre_profile ?? null,
    input.version ?? '1.0.0',
    input.description ?? null,
  );

  return db.prepare('SELECT * FROM project_templates WHERE template_key = ?').get(input.template_key) as ProjectTemplateRow;
}

export function getTemplate(db: Database.Database, templateKey: string): ProjectTemplateRow | undefined {
  return db.prepare('SELECT * FROM project_templates WHERE template_key = ?').get(templateKey) as ProjectTemplateRow | undefined;
}

export function listTemplates(db: Database.Database): ProjectTemplateRow[] {
  return db.prepare('SELECT * FROM project_templates ORDER BY display_name').all() as ProjectTemplateRow[];
}

export function registerDefaultTemplates(db: Database.Database): ProjectTemplateRow {
  return registerTemplate(db, {
    template_key: 'godot-tactics-template',
    display_name: 'Godot Tactics RPG Template',
    engine: 'godot',
    genre_profile: 'combat-forward 2D tactics / party RPG',
    version: '1.0.0',
    description: 'Full bootstrap template for Godot 4 tactical RPGs. Includes combat-first project scaffolding with encounter doctrine, sprite foundry integration, proof lab verification, and canon vault for design documentation. Optimized for party-based 2D tactics games with grid combat, sprite sheet pipelines, and production freeze governance.',
  });
}
