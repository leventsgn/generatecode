using System.Text.Json;
using GenerateCode.Models;

namespace GenerateCode.Infrastructure;

public static class DefinitionParser
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };

    public static ProjectDefinition Parse(string json, string? templateOverride = null)
    {
        using var document = JsonDocument.Parse(json);

        ProjectDefinition definition;
        if (document.RootElement.TryGetProperty("template", out _))
        {
            definition = JsonSerializer.Deserialize<ProjectDefinition>(json, JsonOptions)
                ?? throw new JsonException("Failed to parse project definition.");
        }
        else
        {
            var api = JsonSerializer.Deserialize<ApiDefinition>(json, JsonOptions)
                ?? throw new JsonException("Failed to parse API definition.");
            definition = FromApiDefinition(api);
        }

        if (!string.IsNullOrWhiteSpace(templateOverride))
        {
            definition.Template = templateOverride;
        }

        return definition;
    }

    private static ProjectDefinition FromApiDefinition(ApiDefinition api)
    {
        return new ProjectDefinition
        {
            Template = "webapi",
            ProjectName = api.ProjectName,
            RootNamespace = api.RootNamespace,
            DatabaseProvider = api.DatabaseProvider,
            Entities = api.Entities,
            Controllers = api.Controllers,
            TargetFramework = "net8.0",
            UseSwagger = true
        };
    }
}
