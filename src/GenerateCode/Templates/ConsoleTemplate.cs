using System.Text;
using GenerateCode.Infrastructure;
using GenerateCode.Models;

namespace GenerateCode.Templates;

public sealed class ConsoleTemplate : IProjectTemplate
{
    public string Name => "console";

    public IReadOnlyList<GeneratedFile> Generate(ProjectDefinition definition)
    {
        return new List<GeneratedFile>
        {
            new($"{definition.ProjectName}.csproj", GenerateProjectFile(definition)),
            new("Program.cs", GenerateProgramFile(definition))
        };
    }

    private static string GenerateProjectFile(ProjectDefinition definition)
    {
        var sb = new StringBuilder();
        sb.AppendLine("<Project Sdk=\"Microsoft.NET.Sdk\">");
        sb.AppendLine();
        sb.AppendLine("  <PropertyGroup>");
        sb.AppendLine("    <OutputType>Exe</OutputType>");
        sb.AppendLine($"    <TargetFramework>{definition.TargetFramework}</TargetFramework>");
        sb.AppendLine("    <Nullable>enable</Nullable>");
        sb.AppendLine("    <ImplicitUsings>enable</ImplicitUsings>");
        sb.AppendLine($"    <RootNamespace>{definition.RootNamespace}</RootNamespace>");
        sb.AppendLine("  </PropertyGroup>");
        sb.AppendLine();
        sb.AppendLine("</Project>");
        return sb.ToString();
    }

    private static string GenerateProgramFile(ProjectDefinition definition)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Console.WriteLine(\"Hello from {definition.ProjectName}.\");");
        return sb.ToString();
    }
}
