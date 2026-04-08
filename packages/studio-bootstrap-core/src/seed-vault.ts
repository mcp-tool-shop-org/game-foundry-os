import type Database from 'better-sqlite3';
import type { BootstrapMode } from '@mcptoolshop/game-foundry-registry';
import fs from 'node:fs';
import path from 'node:path';

export interface SeedVaultResult {
  pages_created: number;
  paths: string[];
}

interface PageDef {
  relative: string;
  canon_id: string;
  kind: string;
  title: string;
  extra?: Record<string, string>;
  body?: string;
}

function buildFrontmatter(
  projectId: string,
  page: PageDef,
): string {
  const now = new Date().toISOString().slice(0, 10);
  const lines = ['---'];
  lines.push(`id: ${page.canon_id}`);
  lines.push(`kind: ${page.kind}`);
  lines.push(`project: ${projectId}`);
  lines.push(`title: "${page.title}"`);
  lines.push(`status: registered`);
  lines.push(`updated: ${now}`);
  if (page.extra) {
    for (const [k, v] of Object.entries(page.extra)) {
      lines.push(`${k}: ${v}`);
    }
  }
  lines.push('---');
  lines.push('');
  lines.push(`# ${page.title}`);
  lines.push('');
  lines.push(page.body ?? '<!-- Add content here -->');
  lines.push('');
  return lines.join('\n');
}

function getBasePages(projectId: string): PageDef[] {
  return [
    {
      relative: '00_Project/vision.md',
      canon_id: `${projectId}-vision`,
      kind: 'project',
      title: 'Project Vision',
      body: '## Core Fantasy\n\n## Target Audience\n\n## Key Differentiators\n',
    },
    {
      relative: '00_Project/production-roadmap.md',
      canon_id: `${projectId}-roadmap`,
      kind: 'project',
      title: 'Production Roadmap',
      body: '## Milestones\n\n## Current Sprint\n\n## Backlog\n',
    },
    {
      relative: '00_Project/freeze-matrix.md',
      canon_id: `${projectId}-freeze-matrix`,
      kind: 'project',
      title: 'Freeze Matrix',
      body: '## Freeze Status\n\n| Scope | Status | Date |\n|-------|--------|------|\n',
    },
    {
      relative: '01_Chapters/ch1.md',
      canon_id: `${projectId}-ch1`,
      kind: 'chapter',
      title: 'Chapter 1',
      extra: { chapter: '1' },
      body: '## Setting\n\n## Key Encounters\n\n## Characters Introduced\n',
    },
    {
      relative: '04_Combat/combat-doctrine.md',
      canon_id: `${projectId}-combat-doctrine`,
      kind: 'combat_doctrine',
      title: 'Combat Doctrine',
      body: '## Grid System\n\n## Turn Economy\n\n## Damage Model\n\n## Status Effects\n',
    },
    {
      relative: '04_Combat/ui-doctrine.md',
      canon_id: `${projectId}-ui-doctrine`,
      kind: 'combat_doctrine',
      title: 'UI Doctrine',
      body: '## HUD Layout\n\n## Action Menus\n\n## Feedback Systems\n',
    },
    {
      relative: '05_Art/art-doctrine.md',
      canon_id: `${projectId}-art-doctrine`,
      kind: 'art_doctrine',
      title: 'Art Doctrine',
      body: '## Sprite Standards\n\n## Color Palette\n\n## Animation Guidelines\n',
    },
  ];
}

function getCombatFirstPages(projectId: string): PageDef[] {
  return [
    {
      relative: '04_Combat/encounter-patterns.md',
      canon_id: `${projectId}-encounter-patterns`,
      kind: 'combat_doctrine',
      title: 'Encounter Patterns',
      body: '## Standard Formation\n\n## Boss Patterns\n\n## Reinforcement Triggers\n\n## Phase Transitions\n',
    },
  ];
}

export function seedVault(
  db: Database.Database,
  projectId: string,
  vaultPath: string,
  mode: BootstrapMode,
): SeedVaultResult {
  const pages = getBasePages(projectId);

  if (mode === 'combat_first') {
    pages.push(...getCombatFirstPages(projectId));
  }

  const paths: string[] = [];

  for (const page of pages) {
    const fullPath = path.join(vaultPath, page.relative);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const content = buildFrontmatter(projectId, page);
    fs.writeFileSync(fullPath, content, 'utf-8');
    paths.push(fullPath);
  }

  return { pages_created: paths.length, paths };
}
