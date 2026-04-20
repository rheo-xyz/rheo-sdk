#!/usr/bin/env node
/**
 * Reads docs/AGENT_CONTEXT.md and emits src/agentContext.generated.ts
 * exporting the content as a string constant. Invoked as a prebuild step
 * so the generated file is always in sync with the markdown source.
 *
 * Idempotent and has no external dependencies.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "docs", "AGENT_CONTEXT.md");
const OUT = path.join(ROOT, "src", "agentContext.generated.ts");

const markdown = fs.readFileSync(SRC, "utf8");

const escaped = JSON.stringify(markdown);

const banner =
  "// This file is generated from docs/AGENT_CONTEXT.md by\n" +
  "// scripts/generate-agent-context.cjs — do not edit by hand.\n";

const body =
  "/**\n" +
  " * Markdown-formatted context for LLM tooling describing the Rheo SDK's\n" +
  " * composition contract. Mirrors docs/AGENT_CONTEXT.md verbatim.\n" +
  " */\n" +
  "export const agentContext: string = " +
  escaped +
  ";\n";

fs.writeFileSync(OUT, banner + body, "utf8");

console.log(
  `[generate-agent-context] wrote ${OUT} (${markdown.length} chars of markdown)`,
);
