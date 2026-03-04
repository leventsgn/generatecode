using System.Text;
using GenerateCode.Models;

namespace GenerateCode.Generators;

public class ProgramFileGenerator : ICodeGenerator
{
    private readonly ApiDefinition _api;

    public ProgramFileGenerator(ApiDefinition api)
    {
        _api = api;
    }

    public string FileName => "Program.cs";

    public string Generate()
    {
        var sb = new StringBuilder();
        sb.AppendLine("using Microsoft.EntityFrameworkCore;");
        sb.AppendLine($"using {_api.RootNamespace}.Data;");
        sb.AppendLine($"using {_api.RootNamespace}.Services;");
        sb.AppendLine();
        sb.AppendLine("var builder = WebApplication.CreateBuilder(args);");
        sb.AppendLine();
        sb.AppendLine("builder.Services.AddControllers();");
        sb.AppendLine("builder.Services.AddEndpointsApiExplorer();");
        sb.AppendLine("builder.Services.AddSwaggerGen();");
        sb.AppendLine();

        // Database configuration
        if (_api.DatabaseProvider.Equals("InMemory", StringComparison.OrdinalIgnoreCase))
        {
            sb.AppendLine($"builder.Services.AddDbContext<AppDbContext>(options =>");
            sb.AppendLine($"    options.UseInMemoryDatabase(\"{_api.ProjectName}Db\"));");
        }
        else
        {
            sb.AppendLine($"builder.Services.AddDbContext<AppDbContext>(options =>");
            sb.AppendLine($"    options.UseSqlServer(builder.Configuration.GetConnectionString(\"DefaultConnection\")));");
        }

        sb.AppendLine();

        // Register services
        foreach (var entity in _api.Entities.Where(e => e.GenerateCrud))
        {
            sb.AppendLine($"builder.Services.AddScoped<{entity.Name}Service>();");
        }

        sb.AppendLine();
        sb.AppendLine("var app = builder.Build();");
        sb.AppendLine();
        sb.AppendLine("if (app.Environment.IsDevelopment())");
        sb.AppendLine("{");
        sb.AppendLine("    app.UseSwagger();");
        sb.AppendLine("    app.UseSwaggerUI();");
        sb.AppendLine("}");
        sb.AppendLine();
        sb.AppendLine("app.UseHttpsRedirection();");
        sb.AppendLine("app.UseAuthorization();");
        sb.AppendLine("app.MapControllers();");
        sb.AppendLine();
        sb.AppendLine("app.Run();");

        return sb.ToString();
    }
}
