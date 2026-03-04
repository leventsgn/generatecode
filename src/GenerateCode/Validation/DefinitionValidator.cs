using System.Text.RegularExpressions;
using GenerateCode.Models;
using GenerateCode.Templates;

namespace GenerateCode.Validation;

public sealed class ValidationResult
{
    public List<string> Errors { get; } = new();
    public bool Success => Errors.Count == 0;
}

public static class DefinitionValidator
{
    public static ValidationResult Validate(ProjectDefinition definition)
    {
        var result = new ValidationResult();

        if (string.IsNullOrWhiteSpace(definition.Template))
        {
            result.Errors.Add("Template is required.");
        }
        else if (!ProjectTemplateRegistry.TryResolve(definition.Template, out _))
        {
            var supported = string.Join(", ", ProjectTemplateRegistry.AvailableTemplates());
            result.Errors.Add($"Unsupported template '{definition.Template}'. Supported: {supported}");
        }

        if (!IsValidNamespace(definition.RootNamespace))
        {
            result.Errors.Add($"Invalid root namespace '{definition.RootNamespace}'.");
        }

        if (!IsValidIdentifier(definition.ProjectName))
        {
            result.Errors.Add($"Invalid project name '{definition.ProjectName}'.");
        }

        if (definition.Template.Equals("webapi", StringComparison.OrdinalIgnoreCase))
        {
            ValidateWebApiDefinition(definition, result);
        }

        return result;
    }

    private static void ValidateWebApiDefinition(ProjectDefinition definition, ValidationResult result)
    {
        var duplicateEntities = definition.Entities
            .GroupBy(entity => entity.Name, StringComparer.OrdinalIgnoreCase)
            .Where(group => !string.IsNullOrWhiteSpace(group.Key) && group.Count() > 1)
            .Select(group => group.Key);

        foreach (var entityName in duplicateEntities)
        {
            result.Errors.Add($"Duplicate entity name: '{entityName}'.");
        }

        foreach (var entity in definition.Entities)
        {
            if (!IsValidIdentifier(entity.Name))
            {
                result.Errors.Add($"Invalid entity name '{entity.Name}'.");
            }

            if (entity.Properties.Count == 0)
            {
                result.Errors.Add($"Entity '{entity.Name}' must define at least one property.");
                continue;
            }

            var duplicateProps = entity.Properties
                .GroupBy(property => property.Name, StringComparer.OrdinalIgnoreCase)
                .Where(group => !string.IsNullOrWhiteSpace(group.Key) && group.Count() > 1)
                .Select(group => group.Key);

            foreach (var propName in duplicateProps)
            {
                result.Errors.Add($"Entity '{entity.Name}' has duplicate property '{propName}'.");
            }

            var keyCount = entity.Properties.Count(property => property.IsKey);
            if (keyCount > 1)
            {
                result.Errors.Add($"Entity '{entity.Name}' has multiple key properties.");
            }

            if (entity.GenerateCrud && keyCount == 0)
            {
                result.Errors.Add($"Entity '{entity.Name}' requires a key property when CRUD generation is enabled.");
            }
        }
    }

    private static bool IsValidIdentifier(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return false;
        }

        return Regex.IsMatch(name, "^[A-Za-z_][A-Za-z0-9_]*$");
    }

    private static bool IsValidNamespace(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return false;
        }

        return name
            .Split('.', StringSplitOptions.RemoveEmptyEntries)
            .All(IsValidIdentifier);
    }
}
