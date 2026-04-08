import fs from 'node:fs';
import path from 'node:path';
import { parseIniSections } from './godot-project.js';

export interface ImportFileData {
  source_file: string;
  dest_files: string[];
  importer: string;
  compress_mode: number;
  detect_3d: boolean;
  filter: string;
  mipmaps: boolean;
}

export interface ImportAuditIssue {
  file: string;
  issue: string;
  severity: 'warning' | 'error';
}

export interface ImportAuditResult {
  files_checked: number;
  issues: ImportAuditIssue[];
  pass: boolean;
}

/** Parse a single .import sidecar file */
export function parseImportFile(importPath: string): ImportFileData {
  if (!fs.existsSync(importPath)) {
    return {
      source_file: '',
      dest_files: [],
      importer: '',
      compress_mode: 0,
      detect_3d: false,
      filter: '',
      mipmaps: false,
    };
  }

  const content = fs.readFileSync(importPath, 'utf-8');
  const sections = parseIniSections(content);

  const remap = sections.get('remap');
  const params = sections.get('params');

  // dest might be a single string or array
  const destRaw = remap?.get('dest_files');
  let destFiles: string[] = [];
  if (Array.isArray(destRaw)) {
    destFiles = destRaw as string[];
  } else if (typeof destRaw === 'string') {
    destFiles = [destRaw];
  }

  return {
    source_file: typeof remap?.get('path') === 'string' ? remap.get('path') as string : '',
    dest_files: destFiles,
    importer: typeof remap?.get('importer') === 'string' ? remap.get('importer') as string : '',
    compress_mode: typeof params?.get('compress/mode') === 'number' ? params.get('compress/mode') as number : 0,
    detect_3d: params?.get('detect_3d/compress_to') !== undefined
      ? typeof params.get('detect_3d/compress_to') === 'string' && (params.get('detect_3d/compress_to') as string) !== 'disabled'
      : false,
    filter: typeof params?.get('process/fix_alpha_border') === 'boolean'
      ? 'default'
      : typeof params?.get('roughness/mode') === 'string'
        ? params.get('roughness/mode') as string
        : '',
    mipmaps: params?.get('mipmaps/generate') === true,
  };
}

/** Recursively find all .import files under a directory */
function findImportFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findImportFiles(full));
    } else if (entry.name.endsWith('.import')) {
      results.push(full);
    }
  }
  return results;
}

/** Audit all .import files under a directory for pixel-art violations */
export function auditImportSettings(projectRoot: string, assetGlob?: string): ImportAuditResult {
  const scanDir = assetGlob
    ? path.join(projectRoot, assetGlob)
    : path.join(projectRoot, 'assets');

  const importFiles = findImportFiles(scanDir);
  const issues: ImportAuditIssue[] = [];

  for (const importPath of importFiles) {
    const relPath = path.relative(projectRoot, importPath);
    const data = parseImportFile(importPath);

    // Check for VRAM compression (compress_mode > 0 means VRAM compressed, bad for pixel art)
    if (data.compress_mode > 0) {
      issues.push({
        file: relPath,
        issue: `VRAM compression enabled (compress_mode=${data.compress_mode}), should be Lossless (0) for pixel art`,
        severity: 'error',
      });
    }

    // Check for mipmaps (bad for pixel art)
    if (data.mipmaps) {
      issues.push({
        file: relPath,
        issue: 'Mipmaps enabled, should be disabled for pixel art',
        severity: 'error',
      });
    }

    // Check for detect_3d (wasteful for 2D assets)
    if (data.detect_3d) {
      issues.push({
        file: relPath,
        issue: 'Detect 3D enabled, should be disabled for 2D assets',
        severity: 'warning',
      });
    }
  }

  return {
    files_checked: importFiles.length,
    issues,
    pass: issues.filter(i => i.severity === 'error').length === 0,
  };
}
