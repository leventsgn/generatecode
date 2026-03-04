using System.Text.Json;
using GenerateCode.Models;

namespace GenerateCode.Generators;

public class PostmanCollectionGenerator : ICodeGenerator
{
    private readonly ApiDefinition _api;

    public PostmanCollectionGenerator(ApiDefinition api)
    {
        _api = api;
    }

    public string FileName => $"postman/{_api.ProjectName}.postman_collection.json";

    public string Generate()
    {
        var items = new List<object>();

        foreach (var entity in _api.Entities.Where(x => x.GenerateCrud))
        {
            var routeSegment = $"{entity.Name.ToLowerInvariant()}s";
            var basePath = $"{{{{baseUrl}}}}/api/{routeSegment}";

            items.Add(CreateItem($"{entity.Name} - GetAll", "GET", basePath));
            items.Add(CreateItem($"{entity.Name} - GetById", "GET", $"{basePath}/{{id}}"));
            items.Add(CreateItem($"{entity.Name} - Create", "POST", basePath, BuildCreateBody(entity)));
            items.Add(CreateItem($"{entity.Name} - Update", "PUT", $"{basePath}/{{id}}", BuildCreateBody(entity)));
            items.Add(CreateItem($"{entity.Name} - Delete", "DELETE", $"{basePath}/{{id}}"));
        }

        if (_api.OptAuthPack)
        {
            items.Add(CreateItem(
                "Auth - Login",
                "POST",
                "{{baseUrl}}/api/auth/login",
                "{\n  \"username\": \"admin\",\n  \"password\": \"admin123\"\n}"));
            items.Add(CreateItem(
                "Auth - Refresh",
                "POST",
                "{{baseUrl}}/api/auth/refresh",
                "{\n  \"refreshToken\": \"<refresh-token>\"\n}"));
        }

        var collection = new
        {
            info = new
            {
                name = $"{_api.ProjectName} API",
                schema = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
            },
            item = items,
            variable = new[]
            {
                new { key = "baseUrl", value = "http://localhost:5000" }
            }
        };

        return JsonSerializer.Serialize(collection, new JsonSerializerOptions { WriteIndented = true }) + Environment.NewLine;
    }

    private static object CreateItem(string name, string method, string rawUrl, string? rawBody = null)
    {
        var normalized = rawUrl.Replace("{{baseUrl}}", string.Empty).TrimStart('/');
        var pathSegments = normalized
            .Split('/', StringSplitOptions.RemoveEmptyEntries)
            .Select(segment => segment.Trim())
            .ToArray();

        return new
        {
            name,
            request = new
            {
                method,
                header = rawBody == null
                    ? Array.Empty<object>()
                    : new[] { new { key = "Content-Type", value = "application/json" } },
                body = rawBody == null
                    ? null
                    : new
                    {
                        mode = "raw",
                        raw = rawBody
                    },
                url = new
                {
                    raw = rawUrl,
                    host = new[] { "{{baseUrl}}" },
                    path = pathSegments
                }
            }
        };
    }

    private static string BuildCreateBody(EntityDefinition entity)
    {
        var lines = entity.Properties
            .Where(p => !p.IsKey)
            .Select(property => $"  \"{char.ToLowerInvariant(property.Name[0]) + property.Name[1..]}\": {ToJsonValue(property.Type)}")
            .ToList();

        return lines.Count == 0
            ? "{}"
            : "{\n" + string.Join(",\n", lines) + "\n}";
    }

    private static string ToJsonValue(string propertyType)
    {
        return propertyType.ToLowerInvariant() switch
        {
            "string" => "\"example\"",
            "guid" => "\"00000000-0000-0000-0000-000000000000\"",
            "bool" or "boolean" => "true",
            "datetime" or "datetimeoffset" => "\"2026-01-01T00:00:00Z\"",
            "decimal" or "double" or "float" => "0.0",
            _ => "0"
        };
    }
}
