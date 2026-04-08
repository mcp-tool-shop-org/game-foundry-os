import fs from 'node:fs';

export interface ExtResource {
  id: string;
  type: string;
  path: string;
  uid?: string;
}

export interface SubResource {
  id: string;
  type: string;
}

export interface SceneNode {
  name: string;
  type?: string;
  parent?: string;
  instance?: string;
  groups?: string[];
  properties: Record<string, unknown>;
}

export interface SceneConnection {
  from: string;
  to: string;
  signal: string;
  method: string;
  flags?: number;
}

export interface ParsedScene {
  uid: string | null;
  format: number;
  ext_resources: ExtResource[];
  sub_resources: SubResource[];
  nodes: SceneNode[];
  connections: SceneConnection[];
}

/** Parse key=value attributes from a bracket header like [node name="Foo" type="Node2D"] */
function parseHeaderAttrs(header: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  // Match key="value" or key=number patterns
  const re = /(\w+)\s*=\s*(?:"([^"]*?)"|(\S+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(header)) !== null) {
    attrs[m[1]] = m[2] ?? m[3];
  }
  return attrs;
}

/** Parse the [gd_scene ...] header for uid and format */
function parseSceneHeader(header: string): { uid: string | null; format: number } {
  const attrs = parseHeaderAttrs(header);
  return {
    uid: attrs.uid ?? null,
    format: attrs.format ? parseInt(attrs.format, 10) : 0,
  };
}

/** Parse a .tscn file into structured scene data */
export function parseScene(filePath: string): ParsedScene {
  if (!fs.existsSync(filePath)) {
    return { uid: null, format: 0, ext_resources: [], sub_resources: [], nodes: [], connections: [] };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let uid: string | null = null;
  let format = 0;
  const extResources: ExtResource[] = [];
  const subResources: SubResource[] = [];
  const nodes: SceneNode[] = [];
  const connections: SceneConnection[] = [];

  let currentNode: SceneNode | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // [gd_scene ...] header
    if (line.startsWith('[gd_scene')) {
      const h = parseSceneHeader(line);
      uid = h.uid;
      format = h.format;
      currentNode = null;
      continue;
    }

    // [ext_resource ...]
    if (line.startsWith('[ext_resource')) {
      const attrs = parseHeaderAttrs(line);
      extResources.push({
        id: attrs.id ?? '',
        type: attrs.type ?? '',
        path: attrs.path ?? '',
        uid: attrs.uid,
      });
      currentNode = null;
      continue;
    }

    // [sub_resource ...]
    if (line.startsWith('[sub_resource')) {
      const attrs = parseHeaderAttrs(line);
      subResources.push({
        id: attrs.id ?? '',
        type: attrs.type ?? '',
      });
      currentNode = null;
      continue;
    }

    // [node ...]
    if (line.startsWith('[node')) {
      const attrs = parseHeaderAttrs(line);
      const node: SceneNode = {
        name: attrs.name ?? '',
        properties: {},
      };
      if (attrs.type) node.type = attrs.type;
      if (attrs.parent) node.parent = attrs.parent;
      if (attrs.instance) node.instance = attrs.instance;
      if (attrs.groups) {
        // groups are PackedStringArray in some formats, or just quoted
        node.groups = attrs.groups.split(',').map(g => g.trim().replace(/"/g, ''));
      }
      nodes.push(node);
      currentNode = node;
      continue;
    }

    // [connection ...]
    if (line.startsWith('[connection')) {
      const attrs = parseHeaderAttrs(line);
      const conn: SceneConnection = {
        signal: attrs.signal ?? '',
        from: attrs.from ?? '',
        to: attrs.to ?? '',
        method: attrs.method ?? '',
      };
      if (attrs.flags) conn.flags = parseInt(attrs.flags, 10);
      connections.push(conn);
      currentNode = null;
      continue;
    }

    // Property lines within a node block (key = value)
    if (currentNode && line.includes('=') && !line.startsWith('[')) {
      const eqIdx = line.indexOf('=');
      if (eqIdx > 0) {
        const key = line.slice(0, eqIdx).trim();
        const val = line.slice(eqIdx + 1).trim();
        currentNode.properties[key] = val;
      }
    }
  }

  return { uid, format, ext_resources: extResources, sub_resources: subResources, nodes, connections };
}
