# GenerateCode - Template-based .NET Project Generator

GenerateCode is a CLI tool that scaffolds .NET projects from JSON definitions.

It supports both:
- legacy Web API definition format (`projectName`, `entities`, `controllers`)
- new template-based format (`template`, `projectName`, `rootNamespace`)

## Supported templates

- `webapi` (existing API generator)
- `worker`
- `console`
- `library`

## Features

- Deterministic code generation from JSON
- Definition validation before file write
- Preview / dry-run mode
- Safe file writing with overwrite strategy (`Overwrite`, `Skip`, `Error`)
- Optional smoke build (`dotnet build`) after generation

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

## Examples

Generate a Web API from legacy definition:

```bash
dotnet run --project src/GenerateCode -- samples/petstore-api.json ./output --template webapi
```

Generate a Worker Service:

```bash
dotnet run --project src/GenerateCode -- samples/worker-service.json ./output --smoke-build
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
