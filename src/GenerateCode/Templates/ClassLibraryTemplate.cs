using System.Text;
using GenerateCode.Infrastructure;
using GenerateCode.Models;

namespace GenerateCode.Templates;

public sealed class ClassLibraryTemplate : IProjectTemplate
{
    public string Name => "library";

    public IReadOnlyList<GeneratedFile> Generate(ProjectDefinition definition)
    {
        return new List<GeneratedFile>
        {
            new($"{definition.ProjectName}.csproj", GenerateProjectFile(definition)),
            new("Class1.cs", GenerateClassFile(definition))
        };
    }

    private static string GenerateProjectFile(ProjectDefinition definition)
    {
        var sb = new StringBuilder();
        sb.AppendLine("<Project Sdk=\"Microsoft.NET.Sdk\">");
        sb.AppendLine();
        sb.AppendLine("  <PropertyGroup>");
        sb.AppendLine($"    <TargetFramework>{definition.TargetFramework}</TargetFramework>");
        sb.AppendLine("    <Nullable>enable</Nullable>");
        sb.AppendLine("    <ImplicitUsings>enable</ImplicitUsings>");
        sb.AppendLine($"    <RootNamespace>{definition.RootNamespace}</RootNamespace>");
        sb.AppendLine("  </PropertyGroup>");
        sb.AppendLine();
        sb.AppendLine("</Project>");
        return sb.ToString();
    }

    private static string GenerateClassFile(ProjectDefinition definition)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"namespace {definition.RootNamespace};");
        sb.AppendLine();
        sb.AppendLine("public class Class1");
        sb.AppendLine("{");
        sb.AppendLine("}");
        return sb.ToString();
    }
}
