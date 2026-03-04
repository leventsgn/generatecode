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
        if (_api.OptAuthPack)
        {
            sb.AppendLine("using Microsoft.AspNetCore.Authentication.JwtBearer;");
            sb.AppendLine("using Microsoft.IdentityModel.Tokens;");
            sb.AppendLine("using System.Text;");
        }
        if (_api.OptProductionPack)
        {
            sb.AppendLine($"using {_api.RootNamespace}.Middleware;");
        }
        sb.AppendLine();
        sb.AppendLine("var builder = WebApplication.CreateBuilder(args);");
        sb.AppendLine();
        sb.AppendLine("builder.Services.AddControllers();");
        if (_api.UseSwagger)
        {
            sb.AppendLine("builder.Services.AddEndpointsApiExplorer();");
            sb.AppendLine("builder.Services.AddSwaggerGen();");
        }
        if (_api.OptProductionPack)
        {
            sb.AppendLine("builder.Services.AddProblemDetails();");
        }
        sb.AppendLine();

        // Database configuration
        if (_api.DatabaseProvider.Equals("InMemory", StringComparison.OrdinalIgnoreCase))
        {
            sb.AppendLine($"builder.Services.AddDbContext<AppDbContext>(options =>");
            sb.AppendLine($"    options.UseInMemoryDatabase(\"{_api.ProjectName}Db\"));");
        }
        else if (_api.DatabaseProvider.Equals("PostgreSQL", StringComparison.OrdinalIgnoreCase))
        {
            sb.AppendLine($"builder.Services.AddDbContext<AppDbContext>(options =>");
            sb.AppendLine("    options.UseNpgsql(builder.Configuration.GetConnectionString(\"DefaultConnection\")));");
        }
        else if (_api.DatabaseProvider.Equals("MySQL", StringComparison.OrdinalIgnoreCase))
        {
            sb.AppendLine($"builder.Services.AddDbContext<AppDbContext>(options =>");
            sb.AppendLine("    options.UseMySql(");
            sb.AppendLine("        builder.Configuration.GetConnectionString(\"DefaultConnection\"),");
            sb.AppendLine("        ServerVersion.AutoDetect(builder.Configuration.GetConnectionString(\"DefaultConnection\"))));");
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
        if (_api.OptAuthPack)
        {
            sb.AppendLine("builder.Services.AddScoped<IAuthService, AuthService>();");
        }

        sb.AppendLine();
        if (_api.OptAuthPack)
        {
            sb.AppendLine("var jwtKey = builder.Configuration[\"Jwt:Key\"] ?? \"CHANGE_THIS_SUPER_SECRET_KEY_1234567890\";");
            sb.AppendLine("var jwtIssuer = builder.Configuration[\"Jwt:Issuer\"] ?? \"GenerateCode\";");
            sb.AppendLine("var jwtAudience = builder.Configuration[\"Jwt:Audience\"] ?? \"GenerateCodeClient\";");
            sb.AppendLine();
            sb.AppendLine("builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)");
            sb.AppendLine("    .AddJwtBearer(options =>");
            sb.AppendLine("    {");
            sb.AppendLine("        options.TokenValidationParameters = new TokenValidationParameters");
            sb.AppendLine("        {");
            sb.AppendLine("            ValidateIssuer = true,");
            sb.AppendLine("            ValidateAudience = true,");
            sb.AppendLine("            ValidateLifetime = true,");
            sb.AppendLine("            ValidateIssuerSigningKey = true,");
            sb.AppendLine("            ValidIssuer = jwtIssuer,");
            sb.AppendLine("            ValidAudience = jwtAudience,");
            sb.AppendLine("            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))");
            sb.AppendLine("        };");
            sb.AppendLine("    });");
            sb.AppendLine("builder.Services.AddAuthorization();");
            sb.AppendLine();
        }

        sb.AppendLine("var app = builder.Build();");
        sb.AppendLine();
        if (_api.UseSwagger)
        {
            sb.AppendLine("if (app.Environment.IsDevelopment())");
            sb.AppendLine("{");
            sb.AppendLine("    app.UseSwagger();");
            sb.AppendLine("    app.UseSwaggerUI();");
            sb.AppendLine("}");
            sb.AppendLine();
        }

        if (_api.OptProductionPack)
        {
            sb.AppendLine("app.UseMiddleware<GlobalExceptionMiddleware>();");
            sb.AppendLine();
        }

        sb.AppendLine("app.UseHttpsRedirection();");
        sb.AppendLine();
        if (_api.OptAuthPack)
        {
            sb.AppendLine("app.UseAuthentication();");
        }
        sb.AppendLine("app.UseAuthorization();");
        if (_api.OptEfMigrations)
        {
            sb.AppendLine();
            sb.AppendLine("using (var scope = app.Services.CreateScope())");
            sb.AppendLine("{");
            sb.AppendLine("    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();");
            sb.AppendLine("    if (dbContext.Database.IsRelational())");
            sb.AppendLine("    {");
            sb.AppendLine("        dbContext.Database.Migrate();");
            sb.AppendLine("    }");
            sb.AppendLine("    else");
            sb.AppendLine("    {");
            sb.AppendLine("        dbContext.Database.EnsureCreated();");
            sb.AppendLine("    }");
            sb.AppendLine("    SeedData.Initialize(dbContext);");
            sb.AppendLine("}");
        }
        sb.AppendLine();
        sb.AppendLine("app.MapControllers();");
        sb.AppendLine();
        sb.AppendLine("app.Run();");
        sb.AppendLine();
        sb.AppendLine("public partial class Program");
        sb.AppendLine("{");
        sb.AppendLine("}");

        return sb.ToString();
    }
}
