# Requirements Analysis - GenerateCode

Date: 2026-03-04

## 1) Product Goal
GenerateCode should let teams produce consistent .NET project skeletons (API and non-API) and generate design/requirements documents with optional LLM support.

## 2) Current State Summary
- Web UI generator supports: `webapi`, `worker`, `windowsservice`, `console`, `library`, `grpc`.
- CLI generator supports: `webapi`, `worker`, `windowsservice`, `console`, `library`, `grpc`.
- Web UI already includes: Auth Pack, API Production Pack, Test Scaffold, EF Migration/Seed scaffold, Postman export, design standard extraction, design doc generation, conformance/ADR/diagram/requirements outputs.
- LLM runtime config can be entered from UI (base URL, model, token).

## 3) Gap Analysis
1. Delivery confidence gap: feature matrix and end-to-end scenarios should be documented in one place.
2. UX operability gap: users need clearer staged workflow guidance for analysis -> generation -> download.
3. Planning output gap: requirements analysis exists, but implementation task planning should be generated in the same flow.

## 4) Functional Requirements (Prioritized)
- FR-1: CLI and Web UI must support the same core project templates.
- FR-2: Generated projects must compile with `dotnet build` (smoke level).
- FR-3: Standard profile and design standard outputs must remain reusable across sessions.
- FR-4: Requirements analysis output should be exportable as markdown.
- FR-5: LLM integration must allow per-session runtime override from UI.

## 5) Non-Functional Requirements
- NFR-1: Deterministic generation for same input.
- NFR-2: Validation before file write.
- NFR-3: Backward compatibility for legacy Web API JSON format.
- NFR-4: Security baseline: no token logging, sanitize LLM URL inputs.
- NFR-5: Maintainability: each new template covered by tests.

## 6) Development Start (This Iteration)
- Sprint item started: FR-4 task planning output.
- Scope:
  - Add LLM endpoint to generate actionable task plans from project summary + requirements markdown.
  - Add UI actions to generate/download task plan.
  - Add task board parsing from generated task plan with fallback parsing, checklist import, filtering/sorting, progress indicator, selection-based bulk status update, CSV and checklist export.
  - Add Turkish character-aware search/filter normalization in UI flows.
  - Add workspace export/import for save-and-resume flows.
  - Persist task plan output in workspace state.
  - Update docs for newly added endpoint and output type.

## 7) Acceptance Criteria for Started Work
- `POST /api/llm/generate-task-plan` returns markdown task plan when LLM config is valid.
- UI has task plan generate/download actions under requirements flow.
- Generated task plan preview is persisted and restored with workspace.
- Existing CLI/test suite remains green after changes.
