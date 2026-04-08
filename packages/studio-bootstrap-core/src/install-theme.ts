import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export interface InstallThemeResult {
  files_created: number;
}

const TYPE_SYSTEM_GD = `class_name TypeSystem
extends RefCounted

## ─── FONT HIERARCHY ──────────────────────────────────────
## Defines the typographic scale and color tokens for the game UI.

## Font sizes (scaled from base 16px)
const FONT_SIZE_XS := 10
const FONT_SIZE_SM := 12
const FONT_SIZE_BASE := 16
const FONT_SIZE_LG := 20
const FONT_SIZE_XL := 28
const FONT_SIZE_TITLE := 36

## ─── COLOR TOKENS ────────────────────────────────────────

const COLOR_BG_PRIMARY := Color("#1a1a2e")
const COLOR_BG_SECONDARY := Color("#16213e")
const COLOR_BG_PANEL := Color("#0f3460")
const COLOR_TEXT_PRIMARY := Color("#e0e0e0")
const COLOR_TEXT_SECONDARY := Color("#a0a0a0")
const COLOR_TEXT_ACCENT := Color("#e94560")
const COLOR_HP_BAR := Color("#4ecca3")
const COLOR_GUARD_BAR := Color("#3498db")
const COLOR_DAMAGE := Color("#e94560")
const COLOR_HEAL := Color("#4ecca3")
const COLOR_CRIT := Color("#f1c40f")

## ─── FONT LOADING ────────────────────────────────────────

static func get_font(weight: String = "regular") -> Font:
	var font_path := "res://assets/fonts/%s.tres" % weight
	if ResourceLoader.exists(font_path):
		return load(font_path)
	return ThemeDB.fallback_font

static func get_label_settings(size: int, color: Color) -> LabelSettings:
	var settings := LabelSettings.new()
	settings.font_size = size
	settings.font_color = color
	return settings
`;

export function installThemeShell(
  _db: Database.Database,
  _projectId: string,
  godotRoot: string,
): InstallThemeResult {
  let files_created = 0;

  // Create theme directory
  const themeDir = path.join(godotRoot, 'assets', 'theme');
  if (!fs.existsSync(themeDir)) {
    fs.mkdirSync(themeDir, { recursive: true });
  }

  // Write type system
  const fontsDir = path.join(godotRoot, 'assets', 'fonts');
  if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
  }

  const typePath = path.join(fontsDir, 'type_system.gd');
  fs.writeFileSync(typePath, TYPE_SYSTEM_GD, 'utf-8');
  files_created++;

  return { files_created };
}
