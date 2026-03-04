using System.Text;
using GenerateCode.Models;

namespace GenerateCode.Generators;

public class ModelGenerator : ICodeGenerator
{
    private readonly EntityDefinition _entity;
    private readonly string _namespace;

    public ModelGenerator(EntityDefinition entity, string rootNamespace)
    {
        _entity = entity;
        _namespace = rootNamespace;
    }

    public string FileName => $"Models/{_entity.Name}.cs";

    public string Generate()
    {
        var sb = new StringBuilder();
        sb.AppendLine("using System.ComponentModel.DataAnnotations;");
        sb.AppendLine();
        sb.AppendLine($"namespace {_namespace}.Models;");
        sb.AppendLine();
        sb.AppendLine($"public class {_entity.Name}");
        sb.AppendLine("{");

        foreach (var prop in _entity.Properties)
        {
            var attributes = new List<string>();

            if (prop.IsKey)
                attributes.Add("[Key]");
            if (prop.IsRequired)
                attributes.Add("[Required]");
            if (prop.MaxLength.HasValue)
                attributes.Add($"[MaxLength({prop.MaxLength.Value})]");

            foreach (var attr in attributes)
            {
                sb.AppendLine($"    {attr}");
            }

            sb.AppendLine($"    public {prop.Type} {prop.Name} {{ get; set; }}{GetDefaultValue(prop)}");
            sb.AppendLine();
        }

        sb.AppendLine("}");
        return sb.ToString();
    }

    private static string GetDefaultValue(PropertyDefinition prop)
    {
        return prop.Type switch
        {
            "string" => " = string.Empty;",
            _ => ""
        };
    }
}
