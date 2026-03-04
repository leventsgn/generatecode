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

        if (_api.OptAuthPack)
        {
            sb.AppendLine("    public DbSet<AuthUser> Users { get; set; }");
            sb.AppendLine("    public DbSet<RefreshToken> RefreshTokens { get; set; }");
        }

        sb.AppendLine();
        sb.AppendLine("    protected override void OnModelCreating(ModelBuilder modelBuilder)");
        sb.AppendLine("    {");
        sb.AppendLine("        base.OnModelCreating(modelBuilder);");
        if (_api.OptAuthPack)
        {
            sb.AppendLine();
            sb.AppendLine("        modelBuilder.Entity<AuthUser>(entity =>");
            sb.AppendLine("        {");
            sb.AppendLine("            entity.HasIndex(x => x.Username).IsUnique();");
            sb.AppendLine("        });");
            sb.AppendLine();
            sb.AppendLine("        modelBuilder.Entity<RefreshToken>(entity =>");
            sb.AppendLine("        {");
            sb.AppendLine("            entity.HasIndex(x => x.Token).IsUnique();");
            sb.AppendLine("            entity.HasOne(x => x.User)");
            sb.AppendLine("                  .WithMany(x => x.RefreshTokens)");
            sb.AppendLine("                  .HasForeignKey(x => x.UserId);");
            sb.AppendLine("        });");
        }
        sb.AppendLine("    }");
        sb.AppendLine("}");
        return sb.ToString();
    }
}
