using System.Text;
using GenerateCode.Models;

namespace GenerateCode.Generators;

public class ProjectFileGenerator : ICodeGenerator
{
    private readonly ApiDefinition _api;

    public ProjectFileGenerator(ApiDefinition api)
    {
        _api = api;
    }

    public string FileName => $"{_api.ProjectName}.csproj";

    public string Generate()
    {
        var sb = new StringBuilder();
        sb.AppendLine("<Project Sdk=\"Microsoft.NET.Sdk.Web\">");
        sb.AppendLine();
        sb.AppendLine("  <PropertyGroup>");
        sb.AppendLine("    <TargetFramework>net8.0</TargetFramework>");
        sb.AppendLine("    <Nullable>enable</Nullable>");
        sb.AppendLine("    <ImplicitUsings>enable</ImplicitUsings>");
        sb.AppendLine($"    <RootNamespace>{_api.RootNamespace}</RootNamespace>");
        sb.AppendLine("  </PropertyGroup>");
        sb.AppendLine();
        sb.AppendLine("  <ItemGroup>");

        if (_api.DatabaseProvider.Equals("InMemory", StringComparison.OrdinalIgnoreCase))
        {
            sb.AppendLine("    <PackageReference Include=\"Microsoft.EntityFrameworkCore.InMemory\" Version=\"8.0.0\" />");
        }
        else
        {
            sb.AppendLine("    <PackageReference Include=\"Microsoft.EntityFrameworkCore.SqlServer\" Version=\"8.0.0\" />");
        }

        sb.AppendLine("    <PackageReference Include=\"Microsoft.EntityFrameworkCore\" Version=\"8.0.0\" />");
        sb.AppendLine("    <PackageReference Include=\"Swashbuckle.AspNetCore\" Version=\"6.5.0\" />");
        sb.AppendLine("  </ItemGroup>");
        sb.AppendLine();
        sb.AppendLine("</Project>");

        return sb.ToString();
    }
}
