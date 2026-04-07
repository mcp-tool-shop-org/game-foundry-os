#!/usr/bin/env node

import { openDatabase } from '@mcptoolshop/game-foundry-registry';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

const db = openDatabase();
const server = createServer(db);
const transport = new StdioServerTransport();

await server.connect(transport);
