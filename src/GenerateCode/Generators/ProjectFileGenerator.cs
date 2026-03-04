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
        var targetFramework = string.IsNullOrWhiteSpace(_api.TargetFramework) ? "net8.0" : _api.TargetFramework;
        var sb = new StringBuilder();
        sb.AppendLine("<Project Sdk=\"Microsoft.NET.Sdk.Web\">");
        sb.AppendLine();
        sb.AppendLine("  <PropertyGroup>");
        sb.AppendLine($"    <TargetFramework>{targetFramework}</TargetFramework>");
        sb.AppendLine("    <Nullable>enable</Nullable>");
        sb.AppendLine("    <ImplicitUsings>enable</ImplicitUsings>");
        sb.AppendLine($"    <RootNamespace>{_api.RootNamespace}</RootNamespace>");
        sb.AppendLine("  </PropertyGroup>");
        sb.AppendLine();
        sb.AppendLine("  <ItemGroup>");
        sb.AppendLine("    <PackageReference Include=\"Microsoft.EntityFrameworkCore\" Version=\"8.0.0\" />");

        if (_api.DatabaseProvider.Equals("InMemory", StringComparison.OrdinalIgnoreCase))
        {
            sb.AppendLine("    <PackageReference Include=\"Microsoft.EntityFrameworkCore.InMemory\" Version=\"8.0.0\" />");
        }
        else if (_api.DatabaseProvider.Equals("PostgreSQL", StringComparison.OrdinalIgnoreCase))
        {
            sb.AppendLine("    <PackageReference Include=\"Npgsql.EntityFrameworkCore.PostgreSQL\" Version=\"8.0.0\" />");
        }
        else if (_api.DatabaseProvider.Equals("MySQL", StringComparison.OrdinalIgnoreCase))
        {
            sb.AppendLine("    <PackageReference Include=\"Pomelo.EntityFrameworkCore.MySql\" Version=\"8.0.2\" />");
        }
        else
        {
            sb.AppendLine("    <PackageReference Include=\"Microsoft.EntityFrameworkCore.SqlServer\" Version=\"8.0.0\" />");
        }

        if (_api.UseSwagger)
        {
            sb.AppendLine("    <PackageReference Include=\"Swashbuckle.AspNetCore\" Version=\"6.5.0\" />");
        }

        if (_api.OptAuthPack)
        {
            sb.AppendLine("    <PackageReference Include=\"Microsoft.AspNetCore.Authentication.JwtBearer\" Version=\"8.0.7\" />");
        }

        if (_api.OptEfMigrations)
        {
            sb.AppendLine("    <PackageReference Include=\"Microsoft.EntityFrameworkCore.Design\" Version=\"8.0.0\">");
            sb.AppendLine("      <PrivateAssets>all</PrivateAssets>");
            sb.AppendLine("      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>");
            sb.AppendLine("    </PackageReference>");
        }

        sb.AppendLine("  </ItemGroup>");

        if (_api.OptTestGeneration)
        {
            sb.AppendLine();
            sb.AppendLine("  <ItemGroup>");
            sb.AppendLine("    <Compile Remove=\"Tests/**/*.cs\" />");
            sb.AppendLine("    <EmbeddedResource Remove=\"Tests/**/*\" />");
            sb.AppendLine("    <None Remove=\"Tests/**/*\" />");
            sb.AppendLine("  </ItemGroup>");
        }

        sb.AppendLine();
        sb.AppendLine("</Project>");

        return sb.ToString();
    }
}
