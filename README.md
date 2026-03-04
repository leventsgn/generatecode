# GenerateCode - .NET API Code Generator

A CLI tool that generates complete .NET 8 Web API projects from a JSON definition file. Define your entities, properties, and controllers in a JSON file, and the tool generates a ready-to-run API project with models, services, controllers, Entity Framework DbContext, and Swagger support.

## Features

- Generates .NET 8 Web API projects from JSON definitions
- Automatic CRUD controller, service, and model generation
- Entity Framework Core integration (InMemory or SQL Server)
- Data annotation attributes (Key, Required, MaxLength)
- Swagger/OpenAPI documentation support
- Custom endpoint definitions

## Project Structure

```
src/GenerateCode/
  ├── Models/              # API definition models
  │   ├── ApiDefinition.cs
  │   ├── EntityDefinition.cs
  │   ├── PropertyDefinition.cs
  │   ├── ControllerDefinition.cs
  │   └── EndpointDefinition.cs
  ├── Generators/           # Code generation templates
  │   ├── ICodeGenerator.cs
  │   ├── ModelGenerator.cs
  │   ├── ServiceGenerator.cs
  │   ├── ControllerGenerator.cs
  │   ├── DbContextGenerator.cs
  │   ├── ProgramFileGenerator.cs
  │   └── ProjectFileGenerator.cs
  ├── Engine/
  │   └── ApiProjectGenerator.cs
  └── Program.cs
tests/GenerateCode.Tests/  # Unit tests
samples/                   # Sample API definitions
```

## Usage

```bash
dotnet run --project src/GenerateCode -- <input-file> [output-directory]
```

### Example

```bash
dotnet run --project src/GenerateCode -- samples/petstore-api.json ./output
```

This generates a complete API project at `./output/PetStoreApi/` with:
- Pet, Owner, and Appointment models with data annotations
- CRUD services for each entity
- REST controllers with GET, POST, PUT, DELETE endpoints
- Entity Framework InMemory database context
- Program.cs with Swagger and DI configuration

## API Definition Format

```json
{
  "projectName": "MyApi",
  "rootNamespace": "MyApi",
  "databaseProvider": "InMemory",
  "entities": [
    {
      "name": "Product",
      "generateCrud": true,
      "properties": [
        { "name": "Id", "type": "int", "isKey": true },
        { "name": "Name", "type": "string", "isRequired": true, "maxLength": 100 },
        { "name": "Price", "type": "decimal" }
      ]
    }
  ],
  "controllers": []
}
```

### Definition Fields

| Field | Description |
|-------|-------------|
| `projectName` | Name of the generated project |
| `rootNamespace` | Root C# namespace |
| `databaseProvider` | `InMemory` or `SqlServer` |
| `entities` | List of entity definitions |
| `controllers` | Custom controller definitions (optional) |

### Property Types

Supported types: `int`, `string`, `bool`, `decimal`, `double`, `float`, `DateTime`, `Guid`, and any custom type.

## Building

```bash
dotnet build
```

## Testing

```bash
dotnet test
```
