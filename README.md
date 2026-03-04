# GenerateCode - Template-based .NET Project Generator

GenerateCode is a CLI tool that scaffolds .NET projects from JSON definitions.

It supports both:
- legacy Web API definition format (`projectName`, `entities`, `controllers`)
- new template-based format (`template`, `projectName`, `rootNamespace`)

## Supported templates

- `webapi` (existing API generator)
- `worker`
- `windowsservice`
- `console`
- `library`
- `grpc`

## Features

- Deterministic code generation from JSON
- Definition validation before file write
- Preview / dry-run mode
- Safe file writing with overwrite strategy (`Overwrite`, `Skip`, `Error`)
- Optional smoke build (`dotnet build`) after generation
- Turkish character support in UI search/filter flows (`ç, ğ, ı, İ, ö, ş, ü`)
- Workspace save/load support (`.workspace.json` export/import to continue later)
- Web API advanced packs:
  - Auth Pack (`JWT + Refresh Token + role/permission`)
  - Production Pack (`pagination/filter/sort + global exception middleware + ProblemDetails`)
  - Test scaffold (`xUnit + Moq`, EF InMemory unit tests + WebApplicationFactory integration tests)
  - EF scaffold (`seed data + AppDbContextFactory + migration starter files`)
  - Postman export (`postman collection json + .http request samples`)
- Web UI LLM outputs:
  - Project/design standard extraction and enhancement
  - Design document generation
  - Conformance report, ADR pack, Mermaid diagram pack
  - Requirements analysis and implementation task plan generation
  - Task plan to interactive task board parsing with fallback parsing, checklist import, filter/sort/progress, selection-based bulk update, CSV and checklist export

## Usage

```bash
dotnet run --project src/GenerateCode -- <input-file> [output-directory] [options]
```

Options:

- `--template <name>`: override template from input file
- `--output <path>`: output directory (alternative to positional output arg)
- `--overwrite <mode>`: `Overwrite`, `Skip`, or `Error`
- `--preview`: print generated file list before writing
- `--dry-run`: validate and render file list only (no writes)
- `--smoke-build`: run `dotnet build` in generated project
- `--auth-pack`: enable JWT + refresh token scaffold (webapi)
- `--production-pack`: enable pagination/filter + global exception middleware (webapi)
- `--test-generation`: generate xUnit + Moq test scaffold (webapi)
- `--ef-migrations`: generate migration + seed scaffold files (webapi)
- `--postman-export`: generate Postman collection JSON (webapi)

## Examples

Generate a Web API from legacy definition:

```bash
dotnet run --project src/GenerateCode -- samples/petstore-api.json ./output --template webapi
```

Generate a Worker Service:

```bash
dotnet run --project src/GenerateCode -- samples/worker-service.json ./output --smoke-build
```

Generate a gRPC service:

```bash
dotnet run --project src/GenerateCode -- samples/grpc-service.json ./output --smoke-build
```

Generate an advanced Web API package:

```bash
dotnet run --project src/GenerateCode -- samples/petstore-api.json ./output --template webapi --auth-pack --production-pack --test-generation --ef-migrations --postman-export
```

## Definition format

Legacy Web API format (still supported):

```json
{
  "projectName": "MyApi",
  "rootNamespace": "MyApi",
  "databaseProvider": "InMemory",
  "entities": [],
  "controllers": []
}
```

Template-based format:

```json
{
  "template": "worker",
  "projectName": "MyWorker",
  "rootNamespace": "MyWorker",
  "targetFramework": "net8.0"
}
```

Advanced Web API format (optional packs):

```json
{
  "template": "webapi",
  "projectName": "CommerceApi",
  "rootNamespace": "CommerceApi",
  "targetFramework": "net8.0",
  "databaseProvider": "PostgreSQL",
  "useSwagger": true,
  "optAuthPack": true,
  "optProductionPack": true,
  "optTestGeneration": true,
  "optEfMigrations": true,
  "optPostmanExport": true,
  "entities": [],
  "controllers": []
}
```

## Development

Build:

```bash
dotnet build src/GenerateCode/GenerateCode.csproj
```

Test:

```bash
dotnet test tests/GenerateCode.Tests/GenerateCode.Tests.csproj
```

## Render deployment (Web UI)

Repository includes [`render.yaml`](./render.yaml) for one-click deploy of the `web` app.

- Service type: `Web Service`
- Root directory: `web`
- Build command: `npm ci`
- Start command: `npm start`
- Health check path: `/health`

### LLM standard enhancement (Groq key, OpenAI-compatible API)

Web UI includes a standard-analysis tab where you can improve a selected standard profile via LLM.

Configure these environment variables on Render:

- `GROQ_API_KEY`: your Groq API key (required)
- `GROQ_MODEL`: model id (default: `openai/gpt-oss-120b`)
- `GROQ_BASE_URL`: API base URL (default: `https://api.groq.com/openai/v1`)

Backend endpoints:

- `GET /api/llm/status`: configuration/model status
- `POST /api/llm/enhance-standard`: improves a standard profile and document
- `POST /api/llm/derive-design-standard`: derives a reusable design standard from uploaded project files
- `POST /api/llm/generate-design-document`: generates design document markdown
- `POST /api/llm/generate-conformance-report`: generates conformance report markdown
- `POST /api/llm/generate-adr-pack`: generates ADR markdown pack
- `POST /api/llm/generate-diagram-pack`: generates Mermaid diagram pack
- `POST /api/llm/analyze-requirements`: generates requirements analysis markdown
- `POST /api/llm/generate-task-plan`: generates actionable implementation task plan markdown
