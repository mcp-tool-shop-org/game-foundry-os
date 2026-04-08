import type Database from 'better-sqlite3';
import type {
  BattleSceneContractRow,
  CombatUILayerRow,
  BattleSceneSnapshotRow,
  HudZone,
  AssertionStatus,
} from '@mcptoolshop/game-foundry-registry';
import {
  getSceneContract,
  getEncounter,
  getEncounterEnemies,
  getLayersByContract,
  getSnapshotsByContract,
} from '@mcptoolshop/game-foundry-registry';
import crypto from 'node:crypto';

/** A single proof assertion result */
export interface SceneProofAssertion {
  key: string;
  status: AssertionStatus;
  message: string;
  details?: Record<string, unknown>;
}

/** Full proof run result */
export interface SceneProofResult {
  proof_run_id: string;
  contract_id: string;
  result: 'pass' | 'fail' | 'partial';
  assertions: SceneProofAssertion[];
  blocking_failures: number;
  warning_count: number;
  receipt_hash: string;
}

/** Optional sprite metrics for per-unit checks (injected from visual-proof or mocked) */
export interface SpriteMetrics {
  variant_id: string;
  width: number;
  height: number;
  avg_luminance: number;
}

const ALL_SNAPSHOT_KEYS: string[] = ['neutral', 'threat_on', 'forecast', 'enemy_turn', 'pre_commit'];

/**
 * Run the 13-assertion battle scene proof suite.
 *
 * @param spriteMetrics Optional sprite metrics per variant (from visual-proof's checkSprite).
 *   If not provided, sprite-dependent assertions (ratio, contrast) will warn instead of fail.
 */
export function runSceneProof(
  db: Database.Database,
  contractId: string,
  spriteMetrics?: SpriteMetrics[],
): SceneProofResult {
  const contract = getSceneContract(db, contractId);
  if (!contract) throw new Error(`Scene contract not found: ${contractId}`);

  const encounter = getEncounter(db, contract.encounter_id);
  if (!encounter) throw new Error(`Encounter not found: ${contract.encounter_id}`);

  const enemies = getEncounterEnemies(db, contract.encounter_id);
  const layers = getLayersByContract(db, contractId);
  const snapshots = getSnapshotsByContract(db, contractId);

  const assertions: SceneProofAssertion[] = [];

  // ─── 1. board_fits_viewport ─────────────────────────────
  const boardRight = contract.board_origin_x + contract.board_cols * contract.tile_size_px;
  const boardBottom = contract.board_origin_y + contract.board_rows * contract.tile_size_px;
  const boardFits = boardRight <= contract.viewport_width && boardBottom <= contract.viewport_height;
  assertions.push({
    key: 'board_fits_viewport',
    status: boardFits ? 'pass' : 'fail',
    message: boardFits
      ? `Board ${boardRight}x${boardBottom} fits viewport ${contract.viewport_width}x${contract.viewport_height}`
      : `Board ${boardRight}x${boardBottom} exceeds viewport ${contract.viewport_width}x${contract.viewport_height}`,
  });

  // ─── 2. tile_size_consistent ────────────────────────────
  const tileConsistent = contract.tile_size_px === 64; // matches battle_scene.gd cell_size
  assertions.push({
    key: 'tile_size_consistent',
    status: tileConsistent ? 'pass' : 'warn',
    message: tileConsistent
      ? 'Tile size 64px matches battle_scene.gd cell_size'
      : `Tile size ${contract.tile_size_px}px differs from battle_scene.gd cell_size (64)`,
  });

  // ─── 3. sprite_to_tile_ratio ────────────────────────────
  if (spriteMetrics && spriteMetrics.length > 0) {
    const ratioIssues: string[] = [];
    for (const sm of spriteMetrics) {
      const maxDim = Math.max(sm.width, sm.height);
      const ratio = maxDim / contract.tile_size_px;
      if (ratio < contract.unit_tile_ratio_min || ratio > contract.unit_tile_ratio_max) {
        ratioIssues.push(`${sm.variant_id}: ${maxDim}px/${contract.tile_size_px}px = ${ratio.toFixed(2)}`);
      }
    }
    assertions.push({
      key: 'sprite_to_tile_ratio',
      status: ratioIssues.length === 0 ? 'pass' : 'fail',
      message: ratioIssues.length === 0
        ? 'All sprites within tile ratio range'
        : `${ratioIssues.length} sprite(s) out of ratio: ${ratioIssues.join('; ')}`,
      details: { issues: ratioIssues },
    });
  } else {
    assertions.push({
      key: 'sprite_to_tile_ratio',
      status: 'warn',
      message: 'No sprite metrics provided — cannot verify sprite-to-tile ratio',
    });
  }

  // ─── 4. unit_occupancy_on_board ─────────────────────────
  const boardLeft = contract.board_origin_x;
  const boardTop = contract.board_origin_y;
  const occupancyIssues: string[] = [];
  for (const enemy of enemies) {
    const px = boardLeft + enemy.grid_col * contract.tile_size_px;
    const py = boardTop + enemy.grid_row * contract.tile_size_px;
    if (px < boardLeft || px >= boardRight || py < boardTop || py >= boardBottom) {
      occupancyIssues.push(`${enemy.display_name} at (${enemy.grid_row},${enemy.grid_col}) = pixel (${px},${py}) outside board`);
    }
  }
  assertions.push({
    key: 'unit_occupancy_on_board',
    status: occupancyIssues.length === 0 ? 'pass' : 'fail',
    message: occupancyIssues.length === 0
      ? `All ${enemies.length} units on board`
      : `${occupancyIssues.length} unit(s) off board`,
    details: { issues: occupancyIssues },
  });

  // ─── 5. contrast_vs_background ──────────────────────────
  if (spriteMetrics && spriteMetrics.length > 0) {
    const contrastIssues: string[] = [];
    for (const sm of spriteMetrics) {
      if (sm.avg_luminance < contract.min_unit_contrast) {
        contrastIssues.push(`${sm.variant_id}: luminance ${sm.avg_luminance.toFixed(1)} < ${contract.min_unit_contrast}`);
      }
    }
    assertions.push({
      key: 'contrast_vs_background',
      status: contrastIssues.length === 0 ? 'pass' : 'fail',
      message: contrastIssues.length === 0
        ? 'All sprites above contrast threshold'
        : `${contrastIssues.length} sprite(s) below contrast`,
      details: { issues: contrastIssues },
    });
  } else {
    assertions.push({
      key: 'contrast_vs_background',
      status: 'warn',
      message: 'No sprite metrics provided — cannot verify contrast',
    });
  }

  // ─── 6. hud_overlap_pressure ────────────────────────────
  const hudZones: HudZone[] = contract.hud_zones_json ? JSON.parse(contract.hud_zones_json) : [];
  const boardArea = (boardRight - boardLeft) * (boardBottom - boardTop);
  let hudOverlapArea = 0;
  for (const z of hudZones) {
    const oL = Math.max(z.x, boardLeft);
    const oT = Math.max(z.y, boardTop);
    const oR = Math.min(z.x + z.w, boardRight);
    const oB = Math.min(z.y + z.h, boardBottom);
    if (oR > oL && oB > oT) hudOverlapArea += (oR - oL) * (oB - oT);
  }
  const overlapPct = boardArea > 0 ? hudOverlapArea / boardArea : 0;
  assertions.push({
    key: 'hud_overlap_pressure',
    status: overlapPct <= contract.max_hud_overlap_pct ? 'pass' : 'fail',
    message: `HUD overlap ${(overlapPct * 100).toFixed(1)}% (max ${(contract.max_hud_overlap_pct * 100).toFixed(1)}%)`,
  });

  // ─── 7. hud_no_unit_occlusion ───────────────────────────
  const occludedUnits: string[] = [];
  for (const enemy of enemies) {
    const ux = boardLeft + enemy.grid_col * contract.tile_size_px + contract.tile_size_px / 2;
    const uy = boardTop + enemy.grid_row * contract.tile_size_px + contract.tile_size_px / 2;
    for (const z of hudZones) {
      if (ux >= z.x && ux <= z.x + z.w && uy >= z.y && uy <= z.y + z.h) {
        occludedUnits.push(`${enemy.display_name} center (${ux},${uy}) inside HUD zone '${z.name}'`);
      }
    }
  }
  assertions.push({
    key: 'hud_no_unit_occlusion',
    status: occludedUnits.length === 0 ? 'pass' : 'fail',
    message: occludedUnits.length === 0
      ? 'No units occluded by HUD'
      : `${occludedUnits.length} unit(s) under HUD zones`,
    details: { occluded: occludedUnits },
  });

  // ─── 8. overlay_z_order_valid ───────────────────────────
  const zOrders = layers.map(l => l.z_order);
  const uniqueZ = new Set(zOrders);
  const zValid = uniqueZ.size === zOrders.length;
  assertions.push({
    key: 'overlay_z_order_valid',
    status: zValid ? 'pass' : 'fail',
    message: zValid
      ? `All ${layers.length} layers have unique z-order`
      : 'Duplicate z-order values detected',
  });

  // ─── 9-11. layer data completeness ──────────────────────
  const layerChecks: Array<{ key: string; layerKey: string }> = [
    { key: 'intent_layer_data_complete', layerKey: 'intent' },
    { key: 'threat_layer_data_complete', layerKey: 'threat' },
    { key: 'forecast_layer_data_complete', layerKey: 'forecast' },
  ];

  for (const lc of layerChecks) {
    const layer = layers.find(l => l.layer_key === lc.layerKey);
    if (!layer) {
      assertions.push({
        key: lc.key,
        status: 'fail',
        message: `${lc.layerKey} layer not configured`,
      });
      continue;
    }
    const requiredFields: string[] = layer.required_data_fields
      ? JSON.parse(layer.required_data_fields)
      : [];
    const missing: string[] = [];
    for (const enemy of enemies) {
      for (const field of requiredFields) {
        const value = (enemy as unknown as Record<string, unknown>)[field];
        if (value === null || value === undefined) {
          missing.push(`${enemy.display_name}.${field}`);
        }
      }
    }
    assertions.push({
      key: lc.key,
      status: missing.length === 0 ? 'pass' : 'fail',
      message: missing.length === 0
        ? `${lc.layerKey} layer data complete for all ${enemies.length} enemies`
        : `Missing: ${missing.join(', ')}`,
    });
  }

  // ─── 12. layer_legibility_space ─────────────────────────
  const legibilityIssues: string[] = [];
  for (const layer of layers) {
    if (layer.legibility_min_size > 0 && layer.legibility_min_size > contract.tile_size_px) {
      legibilityIssues.push(`${layer.layer_key}: min_size ${layer.legibility_min_size}px > tile ${contract.tile_size_px}px`);
    }
  }
  assertions.push({
    key: 'layer_legibility_space',
    status: legibilityIssues.length === 0 ? 'pass' : 'fail',
    message: legibilityIssues.length === 0
      ? 'All layer indicators fit within tiles'
      : `${legibilityIssues.length} legibility issue(s)`,
  });

  // ─── 13. snapshot_completeness ──────────────────────────
  const capturedKeys = new Set(snapshots.map(s => s.snapshot_key as string));
  const missingSnapshots = ALL_SNAPSHOT_KEYS.filter(k => !capturedKeys.has(k));
  assertions.push({
    key: 'snapshot_completeness',
    status: missingSnapshots.length === 0 ? 'pass' : 'warn',
    message: missingSnapshots.length === 0
      ? 'All 5 canonical snapshots present'
      : `Missing snapshots: ${missingSnapshots.join(', ')}`,
  });

  // ─── Compute result ────────────────────────────────────
  const failures = assertions.filter(a => a.status === 'fail');
  const warnings = assertions.filter(a => a.status === 'warn');
  const result = failures.length === 0
    ? (warnings.length === 0 ? 'pass' : 'partial')
    : 'fail';

  const runId = `pr_${crypto.randomUUID().slice(0, 16)}`;
  const receiptHash = crypto.createHash('sha256')
    .update(JSON.stringify(assertions))
    .digest('hex')
    .slice(0, 16);

  // Persist proof run
  db.prepare(`
    INSERT INTO proof_runs (id, project_id, suite_id, scope_type, scope_id, result, blocking_failures, warning_count, receipt_hash, summary, tool_name)
    VALUES (?, ?, NULL, 'battle_scene', ?, ?, ?, ?, ?, ?, 'battle_run_scene_proof')
  `).run(
    runId, contract.project_id, contractId, result,
    failures.length, warnings.length, receiptHash,
    `Battle scene proof: ${failures.length} failures, ${warnings.length} warnings`,
  );

  // Persist assertions
  const insertAssertion = db.prepare(`
    INSERT INTO proof_assertions (proof_run_id, assertion_key, status, message, details_json)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const a of assertions) {
    insertAssertion.run(runId, a.key, a.status, a.message, a.details ? JSON.stringify(a.details) : null);
  }

  return {
    proof_run_id: runId,
    contract_id: contractId,
    result,
    assertions,
    blocking_failures: failures.length,
    warning_count: warnings.length,
    receipt_hash: receiptHash,
  };
}
