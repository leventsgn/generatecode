using System.Text;
using GenerateCode.Models;

namespace GenerateCode.Generators;

public class DbContextGenerator : ICodeGenerator
{
    private readonly ApiDefinition _api;

    public DbContextGenerator(ApiDefinition api)
    {
        _api = api;
    }

    public string FileName => "Data/AppDbContext.cs";

    public string Generate()
    {
        var sb = new StringBuilder();
        sb.AppendLine("using Microsoft.EntityFrameworkCore;");
        sb.AppendLine($"using {_api.RootNamespace}.Models;");
        sb.AppendLine();
        sb.AppendLine($"namespace {_api.RootNamespace}.Data;");
        sb.AppendLine();
        sb.AppendLine("public class AppDbContext : DbContext");
        sb.AppendLine("{");
        sb.AppendLine("    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)");
        sb.AppendLine("    {");
        sb.AppendLine("    }");
        sb.AppendLine();

        foreach (var entity in _api.Entities)
        {
            sb.AppendLine($"    public DbSet<{entity.Name}> {entity.Name}s {{ get; set; }}");
        }

        sb.AppendLine("}");
        return sb.ToString();
    }
}
