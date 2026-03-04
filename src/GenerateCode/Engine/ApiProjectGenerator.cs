using System.Text;
using System.Text.Json;
using GenerateCode.Generators;
using GenerateCode.Models;

namespace GenerateCode.Engine;

public class ApiProjectGenerator
{
    private readonly ApiDefinition _api;
    private readonly string _outputPath;

    public ApiProjectGenerator(ApiDefinition api, string outputPath)
    {
        _api = api;
        _outputPath = outputPath;
    }

    public GenerationResult Generate()
    {
        var result = new GenerationResult();
        var generators = BuildGenerators();

        foreach (var generator in generators)
        {
            var filePath = Path.Combine(_outputPath, generator.FileName);
            var directory = Path.GetDirectoryName(filePath);

            if (!string.IsNullOrEmpty(directory))
            {
                Directory.CreateDirectory(directory);
            }

            var content = generator.Generate();
            File.WriteAllText(filePath, content);
            result.GeneratedFiles.Add(filePath);
        }

        result.Success = true;
        return result;
    }

    public List<ICodeGenerator> BuildGenerators()
    {
        var generators = new List<ICodeGenerator>();
        var features = GenerationFeatureSet.FromApi(_api);

        generators.Add(new ProjectFileGenerator(_api));
        generators.Add(new ProgramFileGenerator(_api));
        generators.Add(new RawFileGenerator("appsettings.json", BuildAppSettingsJson()));

        if (_api.Entities.Count > 0 || features.OptAuthPack || features.OptEfMigrations)
        {
            generators.Add(new DbContextGenerator(_api));
        }

        foreach (var entity in _api.Entities)
        {
            generators.Add(new ModelGenerator(entity, _api.RootNamespace));

            if (entity.GenerateCrud)
            {
                generators.Add(new ServiceGenerator(entity, _api.RootNamespace, features.OptProductionPack));
            }
        }

        foreach (var controller in _api.Controllers)
        {
            var entity = _api.Entities.FirstOrDefault(e => e.Name == controller.EntityName);
            generators.Add(new ControllerGenerator(
                controller,
                entity,
                _api.RootNamespace,
                features.OptProductionPack,
                features.OptAuthPack));
        }

        foreach (var entity in _api.Entities.Where(e => e.GenerateCrud))
        {
            var hasController = _api.Controllers.Any(c => c.EntityName == entity.Name);
            if (!hasController)
            {
                var controller = new ControllerDefinition
                {
                    Name = entity.Name,
                    EntityName = entity.Name
                };
                generators.Add(new ControllerGenerator(
                    controller,
                    entity,
                    _api.RootNamespace,
                    features.OptProductionPack,
                    features.OptAuthPack));
            }
        }

        if (features.OptAuthPack)
        {
            AddAuthPack(generators);
        }

        if (features.OptProductionPack)
        {
            AddProductionPack(generators);
        }

        if (features.OptEfMigrations)
        {
            AddEfScaffoldPack(generators);
        }

        if (features.OptTestGeneration)
        {
            AddTestScaffoldPack(generators);
        }

        if (features.OptPostmanExport)
        {
            generators.Add(new PostmanCollectionGenerator(_api));
            AddPostmanHttpSamples(generators);
        }

        return generators;
    }

    private void AddAuthPack(List<ICodeGenerator> generators)
    {
        generators.Add(new RawFileGenerator("Models/AuthUser.cs", NormalizeGeneratedBraces(GenerateAuthUserModel())));
        generators.Add(new RawFileGenerator("Models/RefreshToken.cs", NormalizeGeneratedBraces(GenerateRefreshTokenModel())));
        generators.Add(new RawFileGenerator("Models/RolePermission.cs", NormalizeGeneratedBraces(GenerateRolePermissionModel())));
        generators.Add(new RawFileGenerator("DTOs/Requests/LoginRequest.cs", NormalizeGeneratedBraces(GenerateLoginRequestDto())));
        generators.Add(new RawFileGenerator("DTOs/Requests/RefreshTokenRequest.cs", NormalizeGeneratedBraces(GenerateRefreshTokenRequestDto())));
        generators.Add(new RawFileGenerator("DTOs/Responses/LoginResponse.cs", NormalizeGeneratedBraces(GenerateLoginResponseDto())));
        generators.Add(new RawFileGenerator("Services/IAuthService.cs", NormalizeGeneratedBraces(GenerateAuthServiceInterface())));
        generators.Add(new RawFileGenerator("Services/AuthService.cs", NormalizeGeneratedBraces(GenerateAuthService())));
        generators.Add(new RawFileGenerator("Controllers/AuthController.cs", NormalizeGeneratedBraces(GenerateAuthController())));
    }

    private void AddProductionPack(List<ICodeGenerator> generators)
    {
        generators.Add(new RawFileGenerator("Infrastructure/Pagination/PageRequest.cs", NormalizeGeneratedBraces(GeneratePageRequestModel())));
        generators.Add(new RawFileGenerator("Infrastructure/Pagination/PagedResult.cs", NormalizeGeneratedBraces(GeneratePagedResultModel())));
        generators.Add(new RawFileGenerator("Middleware/GlobalExceptionMiddleware.cs", NormalizeGeneratedBraces(GenerateGlobalExceptionMiddleware())));
    }

    private void AddEfScaffoldPack(List<ICodeGenerator> generators)
    {
        generators.Add(new RawFileGenerator("Data/SeedData.cs", GenerateSeedData()));
        generators.Add(new RawFileGenerator("Data/AppDbContextFactory.cs", GenerateDbContextFactory()));
        generators.Add(new RawFileGenerator("Migrations/0001_InitialScaffold.cs", GenerateInitialMigrationFile()));
        generators.Add(new RawFileGenerator("Migrations/README.md", GenerateMigrationReadme()));
    }

    private void AddTestScaffoldPack(List<ICodeGenerator> generators)
    {
        var testProjectName = $"{_api.ProjectName}.Tests";
        var baseDir = $"Tests/{testProjectName}";

        generators.Add(new RawFileGenerator($"{baseDir}/{testProjectName}.csproj", NormalizeGeneratedBraces(GenerateTestProjectFile(testProjectName))));
        generators.Add(new RawFileGenerator($"{baseDir}/Integration/ApiSmokeTests.cs", GenerateIntegrationTestFile()));

        foreach (var entity in _api.Entities.Where(x => x.GenerateCrud))
        {
            generators.Add(new RawFileGenerator(
                $"{baseDir}/Unit/Services/{entity.Name}ServiceTests.cs",
                GenerateServiceTestFile(entity)));
        }
    }

    private void AddPostmanHttpSamples(List<ICodeGenerator> generators)
    {
        foreach (var entity in _api.Entities.Where(x => x.GenerateCrud))
        {
            generators.Add(new RawFileGenerator($"http/{entity.Name}.http", GenerateEntityHttpSample(entity)));
        }

        if (_api.OptAuthPack)
        {
            generators.Add(new RawFileGenerator("http/Auth.http", GenerateAuthHttpSample()));
        }
    }

    private static string NormalizeGeneratedBraces(string content)
    {
        return content
            .Replace("{{", "{")
            .Replace("}}", "}");
    }

    private string BuildAppSettingsJson()
    {
        var settings = new Dictionary<string, object?>
        {
            ["Logging"] = new Dictionary<string, object?>
            {
                ["LogLevel"] = new Dictionary<string, string>
                {
                    ["Default"] = "Information",
                    ["Microsoft.AspNetCore"] = "Warning"
                }
            },
            ["AllowedHosts"] = "*"
        };

        if (!_api.DatabaseProvider.Equals("InMemory", StringComparison.OrdinalIgnoreCase))
        {
            settings["ConnectionStrings"] = new Dictionary<string, string>
            {
                ["DefaultConnection"] = BuildConnectionString()
            };
        }

        if (_api.OptAuthPack)
        {
            settings["Jwt"] = new Dictionary<string, object?>
            {
                ["Key"] = "CHANGE_THIS_SUPER_SECRET_KEY_1234567890",
                ["Issuer"] = "GenerateCode",
                ["Audience"] = "GenerateCodeClient",
                ["AccessTokenMinutes"] = 30,
                ["RefreshTokenDays"] = 7
            };
        }

        return JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true }) + Environment.NewLine;
    }

    private string BuildConnectionString()
    {
        if (_api.DatabaseProvider.Equals("PostgreSQL", StringComparison.OrdinalIgnoreCase))
        {
            return "Host=localhost;Database=MyDb;Username=postgres;Password=yourpassword";
        }

        if (_api.DatabaseProvider.Equals("MySQL", StringComparison.OrdinalIgnoreCase))
        {
            return "Server=localhost;Database=MyDb;User=root;Password=yourpassword;";
        }

        return "Server=localhost;Database=MyDb;Trusted_Connection=true;TrustServerCertificate=true;";
    }

    private string GenerateAuthUserModel()
    {
        return $$$"""
using System.ComponentModel.DataAnnotations;

namespace {{{_api.RootNamespace}}}.Models;

public class AuthUser
{{
    [Key]
    public int Id {{ get; set; }}

    [Required]
    [MaxLength(80)]
    public string Username {{ get; set; }} = string.Empty;

    [Required]
    public string PasswordHash {{ get; set; }} = string.Empty;

    [Required]
    [MaxLength(40)]
    public string Role {{ get; set; }} = RolePermission.Roles.User;

    public ICollection<RefreshToken> RefreshTokens {{ get; set; }} = new List<RefreshToken>();
}}
""";
    }

    private string GenerateRefreshTokenModel()
    {
        return $$$"""
using System.ComponentModel.DataAnnotations;

namespace {{{_api.RootNamespace}}}.Models;

public class RefreshToken
{{
    [Key]
    public int Id {{ get; set; }}

    [Required]
    [MaxLength(200)]
    public string Token {{ get; set; }} = string.Empty;

    public DateTime ExpiresAtUtc {{ get; set; }}

    public DateTime? RevokedAtUtc {{ get; set; }}

    public int UserId {{ get; set; }}
    public AuthUser? User {{ get; set; }}

    public bool IsActive => RevokedAtUtc == null && ExpiresAtUtc > DateTime.UtcNow;
}}
""";
    }

    private string GenerateRolePermissionModel()
    {
        return $$$"""
namespace {{{_api.RootNamespace}}}.Models;

public static class RolePermission
{{
    public static class Roles
    {{
        public const string Admin = "Admin";
        public const string User = "User";
    }}

    public static IReadOnlyList<string> GetPermissions(string role)
    {{
        return role switch
        {{
            Roles.Admin => new[] {{ "entity.read", "entity.write", "entity.delete", "system.manage" }},
            _ => new[] {{ "entity.read" }}
        }};
    }}
}}
""";
    }

    private string GenerateLoginRequestDto()
    {
        return $$$"""
using System.ComponentModel.DataAnnotations;

namespace {{{_api.RootNamespace}}}.DTOs.Requests;

public class LoginRequest
{{
    [Required]
    public string Username {{ get; set; }} = string.Empty;

    [Required]
    public string Password {{ get; set; }} = string.Empty;
}}
""";
    }

    private string GenerateRefreshTokenRequestDto()
    {
        return $$$"""
using System.ComponentModel.DataAnnotations;

namespace {{{_api.RootNamespace}}}.DTOs.Requests;

public class RefreshTokenRequest
{{
    [Required]
    public string RefreshToken {{ get; set; }} = string.Empty;
}}
""";
    }

    private string GenerateLoginResponseDto()
    {
        return $$$"""
namespace {{{_api.RootNamespace}}}.DTOs.Responses;

public class LoginResponse
{{
    public string AccessToken {{ get; set; }} = string.Empty;
    public DateTime AccessTokenExpiresAtUtc {{ get; set; }}
    public string RefreshToken {{ get; set; }} = string.Empty;
    public DateTime RefreshTokenExpiresAtUtc {{ get; set; }}
    public string Username {{ get; set; }} = string.Empty;
    public string Role {{ get; set; }} = string.Empty;
    public IReadOnlyCollection<string> Permissions {{ get; set; }} = Array.Empty<string>();
}}
""";
    }

    private string GenerateAuthServiceInterface()
    {
        return $$$"""
using {{{_api.RootNamespace}}}.DTOs.Requests;
using {{{_api.RootNamespace}}}.DTOs.Responses;

namespace {{{_api.RootNamespace}}}.Services;

public interface IAuthService
{{
    Task<LoginResponse?> LoginAsync(LoginRequest request);
    Task<LoginResponse?> RefreshTokenAsync(RefreshTokenRequest request);
}}
""";
    }

    private string GenerateAuthService()
    {
        return $$$"""
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using {{{_api.RootNamespace}}}.Data;
using {{{_api.RootNamespace}}}.DTOs.Requests;
using {{{_api.RootNamespace}}}.DTOs.Responses;
using {{{_api.RootNamespace}}}.Models;

namespace {{{_api.RootNamespace}}}.Services;

public class AuthService : IAuthService
{{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;

    public AuthService(AppDbContext context, IConfiguration configuration)
    {{
        _context = context;
        _configuration = configuration;
    }}

    public async Task<LoginResponse?> LoginAsync(LoginRequest request)
    {{
        var user = await _context.Users.FirstOrDefaultAsync(x => x.Username == request.Username);
        if (user == null || user.PasswordHash != request.Password)
        {{
            return null;
        }}

        return await IssueTokensAsync(user);
    }}

    public async Task<LoginResponse?> RefreshTokenAsync(RefreshTokenRequest request)
    {{
        var token = await _context.RefreshTokens
            .Include(x => x.User)
            .FirstOrDefaultAsync(x => x.Token == request.RefreshToken);

        if (token == null || !token.IsActive || token.User == null)
        {{
            return null;
        }}

        token.RevokedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return await IssueTokensAsync(token.User);
    }}

    private async Task<LoginResponse> IssueTokensAsync(AuthUser user)
    {{
        var accessTokenMinutes = int.TryParse(_configuration["Jwt:AccessTokenMinutes"], out var m) ? m : 30;
        var refreshTokenDays = int.TryParse(_configuration["Jwt:RefreshTokenDays"], out var d) ? d : 7;

        var accessTokenExpires = DateTime.UtcNow.AddMinutes(accessTokenMinutes);
        var refreshTokenExpires = DateTime.UtcNow.AddDays(refreshTokenDays);
        var accessToken = BuildAccessToken(user, accessTokenExpires);
        var refreshTokenValue = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

        _context.RefreshTokens.Add(new RefreshToken
        {{
            UserId = user.Id,
            Token = refreshTokenValue,
            ExpiresAtUtc = refreshTokenExpires
        }});
        await _context.SaveChangesAsync();

        return new LoginResponse
        {{
            AccessToken = accessToken,
            AccessTokenExpiresAtUtc = accessTokenExpires,
            RefreshToken = refreshTokenValue,
            RefreshTokenExpiresAtUtc = refreshTokenExpires,
            Username = user.Username,
            Role = user.Role,
            Permissions = RolePermission.GetPermissions(user.Role)
        }};
    }}

    private string BuildAccessToken(AuthUser user, DateTime expiresAtUtc)
    {{
        var key = _configuration["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key missing");
        var issuer = _configuration["Jwt:Issuer"] ?? "GenerateCode";
        var audience = _configuration["Jwt:Audience"] ?? "GenerateCodeClient";
        var permissions = RolePermission.GetPermissions(user.Role);

        var claims = new List<Claim>
        {{
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.UniqueName, user.Username),
            new(ClaimTypes.Role, user.Role)
        }};
        claims.AddRange(permissions.Select(permission => new Claim("permission", permission)));

        var signingCredentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: expiresAtUtc,
            signingCredentials: signingCredentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }}
}}
""";
    }

    private string GenerateAuthController()
    {
        return $$$"""
using Microsoft.AspNetCore.Mvc;
using {{{_api.RootNamespace}}}.DTOs.Requests;
using {{{_api.RootNamespace}}}.Services;

namespace {{{_api.RootNamespace}}}.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {{
        _authService = authService;
    }}

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {{
        var result = await _authService.LoginAsync(request);
        if (result == null) return Unauthorized();
        return Ok(result);
    }}

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequest request)
    {{
        var result = await _authService.RefreshTokenAsync(request);
        if (result == null) return Unauthorized();
        return Ok(result);
    }}
}}
""";
    }

    private string GeneratePageRequestModel()
    {
        return $$$"""
namespace {{{_api.RootNamespace}}}.Infrastructure.Pagination;

public class PageRequest
{{
    private int _pageNumber = 1;
    private int _pageSize = 20;

    public int PageNumber
    {{
        get => _pageNumber;
        set => _pageNumber = value < 1 ? 1 : value;
    }}

    public int PageSize
    {{
        get => _pageSize;
        set => _pageSize = value < 1 ? 1 : value > 200 ? 200 : value;
    }}

    public string? Filter {{ get; set; }}
    public string? SortBy {{ get; set; }}
    public bool Desc {{ get; set; }}
}}
""";
    }

    private string GeneratePagedResultModel()
    {
        return $$$"""
namespace {{{_api.RootNamespace}}}.Infrastructure.Pagination;

public class PagedResult<T>
{{
    public IReadOnlyCollection<T> Items {{ get; set; }} = Array.Empty<T>();
    public int TotalCount {{ get; set; }}
    public int PageNumber {{ get; set; }}
    public int PageSize {{ get; set; }}

    public PagedResult() {{ }}

    public PagedResult(IReadOnlyCollection<T> items, int totalCount, int pageNumber, int pageSize)
    {{
        Items = items;
        TotalCount = totalCount;
        PageNumber = pageNumber;
        PageSize = pageSize;
    }}
}}
""";
    }

    private string GenerateGlobalExceptionMiddleware()
    {
        return $$$"""
using Microsoft.AspNetCore.Mvc;

namespace {{{_api.RootNamespace}}}.Middleware;

public class GlobalExceptionMiddleware
{{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
    {{
        _next = next;
        _logger = logger;
    }}

    public async Task Invoke(HttpContext context)
    {{
        try
        {{
            await _next(context);
        }}
        catch (Exception ex)
        {{
            _logger.LogError(ex, "Unhandled exception");
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/problem+json";

            var problem = new ProblemDetails
            {{
                Title = "Unexpected error",
                Detail = "An unexpected error occurred while processing the request.",
                Status = StatusCodes.Status500InternalServerError,
                Instance = context.Request.Path
            }};
            problem.Extensions["traceId"] = context.TraceIdentifier;

            await context.Response.WriteAsJsonAsync(problem);
        }}
    }}
}}
""";
    }

    private string GenerateSeedData()
    {
        var sb = new StringBuilder();
        sb.AppendLine($"using {_api.RootNamespace}.Models;");
        sb.AppendLine();
        sb.AppendLine($"namespace {_api.RootNamespace}.Data;");
        sb.AppendLine();
        sb.AppendLine("public static class SeedData");
        sb.AppendLine("{");
        sb.AppendLine("    public static void Initialize(AppDbContext context)");
        sb.AppendLine("    {");

        if (_api.OptAuthPack)
        {
            sb.AppendLine("        if (!context.Users.Any())");
            sb.AppendLine("        {");
            sb.AppendLine("            context.Users.Add(new AuthUser");
            sb.AppendLine("            {");
            sb.AppendLine("                Username = \"admin\",");
            sb.AppendLine("                PasswordHash = \"admin123\",");
            sb.AppendLine("                Role = RolePermission.Roles.Admin");
            sb.AppendLine("            });");
            sb.AppendLine("        }");
            sb.AppendLine();
        }

        foreach (var entity in _api.Entities)
        {
            sb.AppendLine($"        if (!context.{entity.Name}s.Any())");
            sb.AppendLine("        {");
            sb.AppendLine($"            context.{entity.Name}s.Add(new {entity.Name}");
            sb.AppendLine("            {");

            var assignments = entity.Properties
                .Where(property => !property.IsKey)
                .Select(property => $"                {property.Name} = {GetSeedValue(property.Type)}")
                .ToList();
            if (assignments.Count > 0)
            {
                sb.AppendLine(string.Join("," + Environment.NewLine, assignments));
            }

            sb.AppendLine("            });");
            sb.AppendLine("        }");
            sb.AppendLine();
        }

        sb.AppendLine("        context.SaveChanges();");
        sb.AppendLine("    }");
        sb.AppendLine("}");
        return sb.ToString();
    }

    private static string GetSeedValue(string type)
    {
        return type.ToLowerInvariant() switch
        {
            "string" => "\"sample\"",
            "guid" => "Guid.NewGuid()",
            "bool" or "boolean" => "true",
            "datetime" or "datetimeoffset" => "DateTime.UtcNow",
            "decimal" => "1.0m",
            "double" => "1.0d",
            "float" => "1.0f",
            _ => "1"
        };
    }

    private static string GenerateInitialMigrationFile()
    {
        return """
namespace Migrations;

public static class InitialScaffold
{
    public const string Name = "0001_InitialScaffold";
    public const string Description = "Placeholder migration scaffold generated by GenerateCode.";
}
""";
    }

    private static string GenerateMigrationReadme()
    {
        return """
# Migration Scaffold

This folder is generated as an EF migration starter pack.

## Next steps

1. Review generated models and DbContext.
2. Add provider-specific package/connection string if needed.
3. Run:
   - dotnet ef migrations add InitialCreate
   - dotnet ef database update
4. Update `SeedData` with domain-specific records.
""";
    }

    private string GenerateDbContextFactory()
    {
        var sb = new StringBuilder();
        sb.AppendLine("using Microsoft.EntityFrameworkCore;");
        sb.AppendLine("using Microsoft.EntityFrameworkCore.Design;");
        sb.AppendLine();
        sb.AppendLine($"namespace {_api.RootNamespace}.Data;");
        sb.AppendLine();
        sb.AppendLine("public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>");
        sb.AppendLine("{");
        sb.AppendLine("    public AppDbContext CreateDbContext(string[] args)");
        sb.AppendLine("    {");
        sb.AppendLine("        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();");

        if (_api.DatabaseProvider.Equals("InMemory", StringComparison.OrdinalIgnoreCase))
        {
            sb.AppendLine($"        optionsBuilder.UseInMemoryDatabase(\"{_api.ProjectName}Db\");");
        }
        else if (_api.DatabaseProvider.Equals("PostgreSQL", StringComparison.OrdinalIgnoreCase))
        {
            sb.AppendLine("        var connectionString = Environment.GetEnvironmentVariable(\"DEFAULT_CONNECTION\")");
            sb.AppendLine("            ?? \"Host=localhost;Database=MyDb;Username=postgres;Password=yourpassword\";");
            sb.AppendLine("        optionsBuilder.UseNpgsql(connectionString);");
        }
        else if (_api.DatabaseProvider.Equals("MySQL", StringComparison.OrdinalIgnoreCase))
        {
            sb.AppendLine("        var connectionString = Environment.GetEnvironmentVariable(\"DEFAULT_CONNECTION\")");
            sb.AppendLine("            ?? \"Server=localhost;Database=MyDb;User=root;Password=yourpassword;\";");
            sb.AppendLine("        optionsBuilder.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString));");
        }
        else
        {
            sb.AppendLine("        var connectionString = Environment.GetEnvironmentVariable(\"DEFAULT_CONNECTION\")");
            sb.AppendLine("            ?? \"Server=localhost;Database=MyDb;Trusted_Connection=true;TrustServerCertificate=true;\";");
            sb.AppendLine("        optionsBuilder.UseSqlServer(connectionString);");
        }

        sb.AppendLine("        return new AppDbContext(optionsBuilder.Options);");
        sb.AppendLine("    }");
        sb.AppendLine("}");
        return sb.ToString();
    }

    private string GenerateTestProjectFile(string testProjectName)
    {
        return $$$"""
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>{{{_api.TargetFramework}}}</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <IsPackable>false</IsPackable>
    <BaseOutputPath>bin\</BaseOutputPath>
    <OutputPath>bin\$(Configuration)\$(TargetFramework)\</OutputPath>
    <BaseIntermediateOutputPath>obj\</BaseIntermediateOutputPath>
    <IntermediateOutputPath>obj\$(Configuration)\$(TargetFramework)\</IntermediateOutputPath>
    <MSBuildWarningsAsMessages>$(MSBuildWarningsAsMessages);MSB3026</MSBuildWarningsAsMessages>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.11.1" />
    <PackageReference Include="xunit" Version="2.9.0" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.8.2" />
    <PackageReference Include="Moq" Version="4.20.70" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.InMemory" Version="8.0.0" />
    <PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="8.0.0" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="../../{{{_api.ProjectName}}}.csproj" GlobalPropertiesToRemove="OutDir;OutputPath;BaseOutputPath;BaseIntermediateOutputPath;PublishDir" />
  </ItemGroup>

</Project>
""";
    }

    private string GenerateIntegrationTestFile()
    {
        var hasDbContext = _api.Entities.Count > 0 || _api.OptAuthPack || _api.OptEfMigrations;
        var firstCrudEntity = _api.Entities.FirstOrDefault(entity => entity.GenerateCrud);
        var firstCrudRoute = firstCrudEntity == null
            ? string.Empty
            : $"/api/{firstCrudEntity.Name.ToLowerInvariant()}s";
        var routeKeySegment = firstCrudEntity == null
            ? "1"
            : BuildIntegrationRouteKeySegment(firstCrudEntity, 1);
        var createPayload = firstCrudEntity == null
            ? "{}"
            : BuildIntegrationCreateBody(firstCrudEntity, 1);
        var updatePayload = firstCrudEntity == null
            ? "{}"
            : BuildIntegrationUpdateBody(firstCrudEntity, 1);
        var authCreatePayload = firstCrudEntity == null
            ? "{}"
            : BuildIntegrationCreateBody(firstCrudEntity, 101);
        var authUpdateCreatePayload = firstCrudEntity == null
            ? "{}"
            : BuildIntegrationCreateBody(firstCrudEntity, 201);
        var authDeleteCreatePayload = firstCrudEntity == null
            ? "{}"
            : BuildIntegrationCreateBody(firstCrudEntity, 301);
        var authUpdatePayload = firstCrudEntity == null
            ? "{}"
            : BuildIntegrationUpdateBody(firstCrudEntity, 201);
        var authUpdateRouteKeySegment = firstCrudEntity == null
            ? "1"
            : BuildIntegrationRouteKeySegment(firstCrudEntity, 201);
        var authDeleteRouteKeySegment = firstCrudEntity == null
            ? "1"
            : BuildIntegrationRouteKeySegment(firstCrudEntity, 301);
        var escapedCreatePayload = createPayload
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\r", string.Empty)
            .Replace("\n", "\\n");
        var escapedUpdatePayload = updatePayload
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\r", string.Empty)
            .Replace("\n", "\\n");
        var escapedAuthCreatePayload = authCreatePayload
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\r", string.Empty)
            .Replace("\n", "\\n");
        var escapedAuthUpdateCreatePayload = authUpdateCreatePayload
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\r", string.Empty)
            .Replace("\n", "\\n");
        var escapedAuthDeleteCreatePayload = authDeleteCreatePayload
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\r", string.Empty)
            .Replace("\n", "\\n");
        var escapedAuthUpdatePayload = authUpdatePayload
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\r", string.Empty)
            .Replace("\n", "\\n");

        var sb = new StringBuilder();
        sb.AppendLine("using System.Net;");
        sb.AppendLine("using System.Net.Http.Headers;");
        sb.AppendLine("using System.Text;");
        sb.AppendLine("using System.Text.Json;");
        sb.AppendLine("using Microsoft.AspNetCore.Hosting;");
        sb.AppendLine("using Microsoft.AspNetCore.Mvc.Testing;");
        if (hasDbContext)
        {
            sb.AppendLine("using Microsoft.EntityFrameworkCore;");
            sb.AppendLine("using Microsoft.Extensions.DependencyInjection;");
            sb.AppendLine("using Microsoft.Extensions.DependencyInjection.Extensions;");
            sb.AppendLine($"using {_api.RootNamespace}.Data;");
            if (_api.OptAuthPack)
            {
                sb.AppendLine($"using {_api.RootNamespace}.Models;");
            }
        }
        sb.AppendLine("using Xunit;");
        sb.AppendLine();
        sb.AppendLine("namespace Integration;");
        sb.AppendLine();
        sb.AppendLine("public partial class ApiSmokeTests : IClassFixture<CustomWebApplicationFactory>");
        sb.AppendLine("{");
        sb.AppendLine("    private readonly HttpClient _client;");
        sb.AppendLine();
        sb.AppendLine("    public ApiSmokeTests(CustomWebApplicationFactory factory)");
        sb.AppendLine("    {");
        sb.AppendLine("        _client = factory.CreateClient();");
        if (_api.OptAuthPack)
        {
            sb.AppendLine("        factory.EnsureAuthSeed();");
        }
        sb.AppendLine("    }");
        sb.AppendLine();
        sb.AppendLine("    [Fact]");
        sb.AppendLine("    public async Task Root_ShouldNotReturnServerError()");
        sb.AppendLine("    {");
        sb.AppendLine("        var response = await _client.GetAsync(\"/\");");
        sb.AppendLine("        Assert.NotEqual(HttpStatusCode.InternalServerError, response.StatusCode);");
        sb.AppendLine("    }");

        if (!string.IsNullOrWhiteSpace(firstCrudRoute))
        {
            sb.AppendLine();
            sb.AppendLine("    [Fact]");
            sb.AppendLine("    public async Task CrudEndpoint_ShouldReturnExpectedStatus()");
            sb.AppendLine("    {");
            sb.AppendLine($"        var response = await _client.GetAsync(\"{firstCrudRoute}\");");
            if (_api.OptAuthPack)
            {
                sb.AppendLine("        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);");
            }
            else
            {
                sb.AppendLine("        Assert.Equal(HttpStatusCode.OK, response.StatusCode);");
            }
            sb.AppendLine("    }");

            sb.AppendLine();
            sb.AppendLine("    [Fact]");
            sb.AppendLine("    public async Task CrudCreate_ShouldReturnExpectedStatus()");
            sb.AppendLine("    {");
            sb.AppendLine($"        var payload = \"{escapedCreatePayload}\";");
            sb.AppendLine("        using var content = new StringContent(payload, Encoding.UTF8, \"application/json\");");
            sb.AppendLine($"        var response = await _client.PostAsync(\"{firstCrudRoute}\", content);");
            if (_api.OptAuthPack)
            {
                sb.AppendLine("        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);");
            }
            else
            {
                sb.AppendLine("        Assert.Equal(HttpStatusCode.Created, response.StatusCode);");
            }
            sb.AppendLine("    }");

            sb.AppendLine();
            sb.AppendLine("    [Fact]");
            sb.AppendLine("    public async Task CrudUpdate_ShouldReturnExpectedStatus()");
            sb.AppendLine("    {");
            sb.AppendLine($"        var payload = \"{escapedUpdatePayload}\";");
            sb.AppendLine("        using var content = new StringContent(payload, Encoding.UTF8, \"application/json\");");
            sb.AppendLine($"        var response = await _client.PutAsync(\"{firstCrudRoute}/{routeKeySegment}\", content);");
            if (_api.OptAuthPack)
            {
                sb.AppendLine("        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);");
            }
            else
            {
                sb.AppendLine("        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);");
            }
            sb.AppendLine("    }");

            sb.AppendLine();
            sb.AppendLine("    [Fact]");
            sb.AppendLine("    public async Task CrudDelete_ShouldReturnExpectedStatus()");
            sb.AppendLine("    {");
            sb.AppendLine($"        var response = await _client.DeleteAsync(\"{firstCrudRoute}/{routeKeySegment}\");");
            if (_api.OptAuthPack)
            {
                sb.AppendLine("        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);");
            }
            else
            {
                sb.AppendLine("        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);");
            }
            sb.AppendLine("    }");

            if (_api.OptAuthPack)
            {
                sb.AppendLine();
                sb.AppendLine("    [Fact]");
                sb.AppendLine("    public async Task AuthLogin_ShouldReturnAccessToken()");
                sb.AppendLine("    {");
                sb.AppendLine("        var token = await LoginAsAdminAsync();");
                sb.AppendLine("        Assert.False(string.IsNullOrWhiteSpace(token));");
                sb.AppendLine("    }");

                sb.AppendLine();
                sb.AppendLine("    [Fact]");
                sb.AppendLine("    public async Task CrudEndpoint_WithToken_ShouldReturnOk()");
                sb.AppendLine("    {");
                sb.AppendLine("        var token = await LoginAsAdminAsync();");
                sb.AppendLine("        using var request = new HttpRequestMessage(HttpMethod.Get, \"" + firstCrudRoute + "\");");
                sb.AppendLine("        request.Headers.Authorization = new AuthenticationHeaderValue(\"Bearer\", token);");
                sb.AppendLine("        var response = await _client.SendAsync(request);");
                sb.AppendLine("        Assert.Equal(HttpStatusCode.OK, response.StatusCode);");
                sb.AppendLine("    }");

                sb.AppendLine();
                sb.AppendLine("    [Fact]");
                sb.AppendLine("    public async Task CrudCreate_WithToken_ShouldReturnCreated()");
                sb.AppendLine("    {");
                sb.AppendLine("        var token = await LoginAsAdminAsync();");
                sb.AppendLine($"        var payload = \"{escapedAuthCreatePayload}\";");
                sb.AppendLine("        using var request = new HttpRequestMessage(HttpMethod.Post, \"" + firstCrudRoute + "\")");
                sb.AppendLine("        {");
                sb.AppendLine("            Content = new StringContent(payload, Encoding.UTF8, \"application/json\")");
                sb.AppendLine("        };");
                sb.AppendLine("        request.Headers.Authorization = new AuthenticationHeaderValue(\"Bearer\", token);");
                sb.AppendLine("        var response = await _client.SendAsync(request);");
                sb.AppendLine("        Assert.Equal(HttpStatusCode.Created, response.StatusCode);");
                sb.AppendLine("    }");

                sb.AppendLine();
                sb.AppendLine("    [Fact]");
                sb.AppendLine("    public async Task CrudUpdate_WithToken_ShouldReturnOk()");
                sb.AppendLine("    {");
                sb.AppendLine("        var token = await LoginAsAdminAsync();");
                sb.AppendLine($"        var createPayload = \"{escapedAuthUpdateCreatePayload}\";");
                sb.AppendLine("        using (var createRequest = new HttpRequestMessage(HttpMethod.Post, \"" + firstCrudRoute + "\")");
                sb.AppendLine("        {");
                sb.AppendLine("            Content = new StringContent(createPayload, Encoding.UTF8, \"application/json\")");
                sb.AppendLine("        })");
                sb.AppendLine("        {");
                sb.AppendLine("            createRequest.Headers.Authorization = new AuthenticationHeaderValue(\"Bearer\", token);");
                sb.AppendLine("            var createResponse = await _client.SendAsync(createRequest);");
                sb.AppendLine("            Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);");
                sb.AppendLine("        }");
                sb.AppendLine();
                sb.AppendLine($"        var updatePayload = \"{escapedAuthUpdatePayload}\";");
                sb.AppendLine("        using var updateRequest = new HttpRequestMessage(HttpMethod.Put, \"" + firstCrudRoute + "/" + authUpdateRouteKeySegment + "\")");
                sb.AppendLine("        {");
                sb.AppendLine("            Content = new StringContent(updatePayload, Encoding.UTF8, \"application/json\")");
                sb.AppendLine("        };");
                sb.AppendLine("        updateRequest.Headers.Authorization = new AuthenticationHeaderValue(\"Bearer\", token);");
                sb.AppendLine("        var response = await _client.SendAsync(updateRequest);");
                sb.AppendLine("        Assert.Equal(HttpStatusCode.OK, response.StatusCode);");
                sb.AppendLine("    }");

                sb.AppendLine();
                sb.AppendLine("    [Fact]");
                sb.AppendLine("    public async Task CrudDelete_WithToken_ShouldReturnNoContent()");
                sb.AppendLine("    {");
                sb.AppendLine("        var token = await LoginAsAdminAsync();");
                sb.AppendLine($"        var createPayload = \"{escapedAuthDeleteCreatePayload}\";");
                sb.AppendLine("        using (var createRequest = new HttpRequestMessage(HttpMethod.Post, \"" + firstCrudRoute + "\")");
                sb.AppendLine("        {");
                sb.AppendLine("            Content = new StringContent(createPayload, Encoding.UTF8, \"application/json\")");
                sb.AppendLine("        })");
                sb.AppendLine("        {");
                sb.AppendLine("            createRequest.Headers.Authorization = new AuthenticationHeaderValue(\"Bearer\", token);");
                sb.AppendLine("            var createResponse = await _client.SendAsync(createRequest);");
                sb.AppendLine("            Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);");
                sb.AppendLine("        }");
                sb.AppendLine();
                sb.AppendLine("        using var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, \"" + firstCrudRoute + "/" + authDeleteRouteKeySegment + "\");");
                sb.AppendLine("        deleteRequest.Headers.Authorization = new AuthenticationHeaderValue(\"Bearer\", token);");
                sb.AppendLine("        var response = await _client.SendAsync(deleteRequest);");
                sb.AppendLine("        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);");
                sb.AppendLine("    }");
            }
        }

        sb.AppendLine("}");
        sb.AppendLine();
        sb.AppendLine("public class CustomWebApplicationFactory : WebApplicationFactory<Program>");
        sb.AppendLine("{");
        sb.AppendLine("    protected override void ConfigureWebHost(IWebHostBuilder builder)");
        sb.AppendLine("    {");
        sb.AppendLine("        builder.UseEnvironment(\"Development\");");
        if (hasDbContext)
        {
            sb.AppendLine("        builder.ConfigureServices(services =>");
            sb.AppendLine("        {");
                sb.AppendLine("            services.RemoveAll(typeof(DbContextOptions<AppDbContext>));");
            sb.AppendLine("            services.AddDbContext<AppDbContext>(options =>");
            sb.AppendLine("                options.UseInMemoryDatabase(\"IntegrationTestsDb\"));");
            sb.AppendLine("        });");
        }
        sb.AppendLine("        base.ConfigureWebHost(builder);");
        sb.AppendLine("    }");
        if (_api.OptAuthPack)
        {
            sb.AppendLine();
            sb.AppendLine("    public void EnsureAuthSeed()");
            sb.AppendLine("    {");
            sb.AppendLine("        using var scope = Services.CreateScope();");
            sb.AppendLine("        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();");
            sb.AppendLine("        context.Database.EnsureCreated();");
            sb.AppendLine("        if (!context.Users.Any())");
            sb.AppendLine("        {");
            sb.AppendLine("            context.Users.Add(new AuthUser");
            sb.AppendLine("            {");
            sb.AppendLine("                Username = \"admin\",");
            sb.AppendLine("                PasswordHash = \"admin123\",");
            sb.AppendLine("                Role = RolePermission.Roles.Admin");
            sb.AppendLine("            });");
            sb.AppendLine("            context.SaveChanges();");
            sb.AppendLine("        }");
            sb.AppendLine("    }");
        }
        sb.AppendLine("}");
        if (_api.OptAuthPack)
        {
            sb.AppendLine();
            sb.AppendLine("public partial class ApiSmokeTests");
            sb.AppendLine("{");
            sb.AppendLine("    private async Task<string> LoginAsAdminAsync()");
            sb.AppendLine("    {");
            sb.AppendLine("        const string payload = \"{\\\"username\\\":\\\"admin\\\",\\\"password\\\":\\\"admin123\\\"}\";");
            sb.AppendLine("        using var content = new StringContent(payload, Encoding.UTF8, \"application/json\");");
            sb.AppendLine("        var response = await _client.PostAsync(\"/api/auth/login\", content);");
            sb.AppendLine("        response.EnsureSuccessStatusCode();");
            sb.AppendLine();
            sb.AppendLine("        var body = await response.Content.ReadAsStringAsync();");
            sb.AppendLine("        using var document = JsonDocument.Parse(body);");
            sb.AppendLine("        var token = document.RootElement.GetProperty(\"accessToken\").GetString();");
            sb.AppendLine("        Assert.False(string.IsNullOrWhiteSpace(token));");
            sb.AppendLine("        return token!;");
            sb.AppendLine("    }");
            sb.AppendLine("}");
        }
        return sb.ToString();
    }

    private static string BuildIntegrationCreateBody(EntityDefinition entity, int seedBase)
    {
        var lines = entity.Properties
            .Select((property, index) =>
            {
                var seed = property.IsKey ? seedBase : seedBase + index + 1;
                return $"  \"{ToCamelCase(property.Name)}\": {GetIntegrationJsonValue(property.Type, seed, property.IsKey)}";
            })
            .ToList();

        if (lines.Count == 0)
        {
            return "{}";
        }

        return "{\n" + string.Join(",\n", lines) + "\n}";
    }

    private static string BuildIntegrationUpdateBody(EntityDefinition entity, int keySeed)
    {
        var lines = entity.Properties
            .Select((property, index) =>
            {
                var seed = property.IsKey ? keySeed : index + 20;
                return $"  \"{ToCamelCase(property.Name)}\": {GetIntegrationJsonValue(property.Type, seed, property.IsKey)}";
            })
            .ToList();

        if (lines.Count == 0)
        {
            return "{}";
        }

        return "{\n" + string.Join(",\n", lines) + "\n}";
    }

    private static string BuildIntegrationRouteKeySegment(EntityDefinition entity, int seed)
    {
        var key = entity.Properties.FirstOrDefault(property => property.IsKey);
        var keyType = key?.Type ?? "int";
        var normalized = keyType.Trim().TrimEnd('?').ToLowerInvariant();

        return normalized switch
        {
            "string" => $"id-{seed}",
            "guid" => $"00000000-0000-0000-0000-{seed:000000000000}",
            "bool" or "boolean" => "true",
            "datetime" => "2026-01-01T00:00:00Z",
            "datetimeoffset" => "2026-01-01T00:00:00Z",
            "decimal" or "double" or "float" => $"{seed}",
            "long" => $"{seed}",
            "short" => $"{seed}",
            "byte" => $"{seed}",
            "char" => "A",
            _ => $"{seed}"
        };
    }

    private static string GetIntegrationJsonValue(string propertyType, int seed, bool isKey)
    {
        var normalized = (propertyType ?? string.Empty).Trim().TrimEnd('?').ToLowerInvariant();
        return normalized switch
        {
            "string" => isKey ? $"\"id-{seed}\"" : $"\"sample-{seed}\"",
            "guid" => $"\"00000000-0000-0000-0000-{seed:000000000000}\"",
            "bool" or "boolean" => "true",
            "datetime" or "datetimeoffset" => "\"2026-01-01T00:00:00Z\"",
            "decimal" or "double" or "float" => $"{seed}.0",
            "long" => $"{seed}",
            "short" => $"{seed}",
            "byte" => $"{seed}",
            "char" => "\"A\"",
            _ => $"{seed}"
        };
    }

    private string GenerateServiceTestFile(EntityDefinition entity)
    {
        var entityName = entity.Name;
        var key = entity.Properties.FirstOrDefault(property => property.IsKey)
            ?? new PropertyDefinition { Name = "Id", Type = "int", IsKey = true };
        var keyName = key.Name;
        var keyType = string.IsNullOrWhiteSpace(key.Type) ? "int" : key.Type;
        var dbSetName = $"{entityName}s";

        var propertyLines = entity.Properties
            .Select((property, index) =>
                property.IsKey
                    ? $"            {property.Name} = key"
                    : $"            {property.Name} = {GetCSharpLiteralForType(property.Type, index + 1, false)}")
            .ToList();
        if (propertyLines.Count == 0)
        {
            propertyLines.Add($"            {keyName} = key");
        }

        var sb = new StringBuilder();
        sb.AppendLine("using Microsoft.EntityFrameworkCore;");
        sb.AppendLine("using Xunit;");
        sb.AppendLine($"using {_api.RootNamespace}.Data;");
        sb.AppendLine($"using {_api.RootNamespace}.Models;");
        sb.AppendLine($"using {_api.RootNamespace}.Services;");
        if (_api.OptProductionPack)
        {
            sb.AppendLine($"using {_api.RootNamespace}.Infrastructure.Pagination;");
        }
        sb.AppendLine();
        sb.AppendLine("namespace Unit.Services;");
        sb.AppendLine();
        sb.AppendLine($"public class {entityName}ServiceTests");
        sb.AppendLine("{");
        sb.AppendLine("    [Fact]");
        sb.AppendLine("    public async Task CreateAsync_ShouldPersistEntity()");
        sb.AppendLine("    {");
        sb.AppendLine("        await using var context = CreateContext();");
        sb.AppendLine($"        var service = new {entityName}Service(context);");
        sb.AppendLine("        var entity = CreateEntity(1);");
        sb.AppendLine();
        sb.AppendLine("        var created = await service.CreateAsync(entity);");
        sb.AppendLine();
        sb.AppendLine("        Assert.NotNull(created);");
        sb.AppendLine($"        Assert.Equal(1, await context.{dbSetName}.CountAsync());");
        sb.AppendLine("    }");
        sb.AppendLine();
        sb.AppendLine("    [Fact]");
        sb.AppendLine("    public async Task GetByIdAsync_ShouldReturnEntity_WhenExists()");
        sb.AppendLine("    {");
        sb.AppendLine("        await using var context = CreateContext();");
        sb.AppendLine($"        var service = new {entityName}Service(context);");
        sb.AppendLine("        var entity = CreateEntity(1);");
        sb.AppendLine("        var created = await service.CreateAsync(entity);");
        sb.AppendLine();
        sb.AppendLine($"        var result = await service.GetByIdAsync(created.{keyName});");
        sb.AppendLine();
        sb.AppendLine("        Assert.NotNull(result);");
        sb.AppendLine($"        Assert.Equal(created.{keyName}, result!.{keyName});");
        sb.AppendLine("    }");
        sb.AppendLine();
        sb.AppendLine("    [Fact]");
        sb.AppendLine("    public async Task DeleteAsync_ShouldRemoveEntity()");
        sb.AppendLine("    {");
        sb.AppendLine("        await using var context = CreateContext();");
        sb.AppendLine($"        var service = new {entityName}Service(context);");
        sb.AppendLine("        var entity = CreateEntity(1);");
        sb.AppendLine("        var created = await service.CreateAsync(entity);");
        sb.AppendLine();
        sb.AppendLine($"        var deleted = await service.DeleteAsync(created.{keyName});");
        sb.AppendLine($"        var afterDelete = await service.GetByIdAsync(created.{keyName});");
        sb.AppendLine();
        sb.AppendLine("        Assert.True(deleted);");
        sb.AppendLine("        Assert.Null(afterDelete);");
        sb.AppendLine("    }");

        if (_api.OptProductionPack)
        {
            sb.AppendLine();
            sb.AppendLine("    [Fact]");
            sb.AppendLine("    public async Task GetPagedAsync_ShouldReturnPagedItems()");
            sb.AppendLine("    {");
            sb.AppendLine("        await using var context = CreateContext();");
            sb.AppendLine($"        var service = new {entityName}Service(context);");
            sb.AppendLine("        await service.CreateAsync(CreateEntity(1));");
            sb.AppendLine("        await service.CreateAsync(CreateEntity(2));");
            sb.AppendLine();
            sb.AppendLine("        var page = await service.GetPagedAsync(new PageRequest { PageNumber = 1, PageSize = 1 });");
            sb.AppendLine();
            sb.AppendLine("        Assert.Equal(2, page.TotalCount);");
            sb.AppendLine("        Assert.Single(page.Items);");
            sb.AppendLine("    }");
        }

        sb.AppendLine();
        sb.AppendLine("    private static AppDbContext CreateContext()");
        sb.AppendLine("    {");
        sb.AppendLine("        var options = new DbContextOptionsBuilder<AppDbContext>()");
        sb.AppendLine($"            .UseInMemoryDatabase(databaseName: \"{entityName}ServiceTests_\" + Guid.NewGuid())");
        sb.AppendLine("            .Options;");
        sb.AppendLine("        return new AppDbContext(options);");
        sb.AppendLine("    }");
        sb.AppendLine();
        sb.AppendLine($"    private static {entityName} CreateEntity(int seed)");
        sb.AppendLine("    {");
        sb.AppendLine("        var key = CreateKey(seed);");
        sb.AppendLine($"        return new {entityName}");
        sb.AppendLine("        {");
        sb.AppendLine(string.Join("," + Environment.NewLine, propertyLines));
        sb.AppendLine("        };");
        sb.AppendLine("    }");
        sb.AppendLine();
        sb.AppendLine($"    private static {keyType} CreateKey(int seed)");
        sb.AppendLine("    {");
        sb.AppendLine($"        return {GetKeyFactoryExpressionForType(keyType)};");
        sb.AppendLine("    }");
        sb.AppendLine("}");
        return sb.ToString();
    }

    private static string GetCSharpLiteralForType(string typeName, int seed, bool forKey)
    {
        var normalized = (typeName ?? string.Empty).Trim();
        var nonNullable = normalized.TrimEnd('?').ToLowerInvariant();

        return nonNullable switch
        {
            "string" => forKey ? $"\"id-{seed}\"" : $"\"sample-{seed}\"",
            "guid" => $"Guid.Parse(\"00000000-0000-0000-0000-{seed:000000000000}\")",
            "bool" or "boolean" => "true",
            "datetime" => "DateTime.UtcNow",
            "datetimeoffset" => "DateTimeOffset.UtcNow",
            "decimal" => $"{seed}.0m",
            "double" => $"{seed}.0d",
            "float" => $"{seed}.0f",
            "long" => $"{seed}L",
            "short" => $"(short){seed}",
            "byte" => $"(byte){seed}",
            "char" => "'A'",
            "int" => $"{seed}",
            _ => "default!"
        };
    }

    private static string GetKeyFactoryExpressionForType(string typeName)
    {
        var normalized = (typeName ?? string.Empty).Trim();
        var nonNullable = normalized.TrimEnd('?').ToLowerInvariant();

        return nonNullable switch
        {
            "string" => "\"id-\" + seed",
            "guid" => "Guid.Parse($\"00000000-0000-0000-0000-{seed:000000000000}\")",
            "bool" or "boolean" => "seed % 2 == 0",
            "datetime" => "DateTime.UtcNow.AddSeconds(seed)",
            "datetimeoffset" => "DateTimeOffset.UtcNow.AddSeconds(seed)",
            "decimal" => "seed",
            "double" => "seed",
            "float" => "seed",
            "long" => "seed",
            "short" => "(short)seed",
            "byte" => "(byte)seed",
            "char" => "(char)('A' + (seed % 26))",
            "int" => "seed",
            _ => "default!"
        };
    }

    private string GenerateEntityHttpSample(EntityDefinition entity)
    {
        var route = $"{entity.Name.ToLowerInvariant()}s";
        var sb = new StringBuilder();
        sb.AppendLine("@baseUrl = http://localhost:5000");
        sb.AppendLine();
        sb.AppendLine($"### {entity.Name} - GetAll");
        sb.AppendLine($"GET {{{{baseUrl}}}}/api/{route}");
        sb.AppendLine("Accept: application/json");
        sb.AppendLine();
        sb.AppendLine($"### {entity.Name} - GetById");
        sb.AppendLine($"GET {{{{baseUrl}}}}/api/{route}/1");
        sb.AppendLine("Accept: application/json");
        sb.AppendLine();
        sb.AppendLine($"### {entity.Name} - Create");
        sb.AppendLine($"POST {{{{baseUrl}}}}/api/{route}");
        sb.AppendLine("Content-Type: application/json");
        sb.AppendLine("Accept: application/json");
        sb.AppendLine();
        sb.AppendLine(BuildEntityJsonBody(entity));
        sb.AppendLine();
        sb.AppendLine($"### {entity.Name} - Update");
        sb.AppendLine($"PUT {{{{baseUrl}}}}/api/{route}/1");
        sb.AppendLine("Content-Type: application/json");
        sb.AppendLine("Accept: application/json");
        sb.AppendLine();
        sb.AppendLine(BuildEntityJsonBody(entity));
        sb.AppendLine();
        sb.AppendLine($"### {entity.Name} - Delete");
        sb.AppendLine($"DELETE {{{{baseUrl}}}}/api/{route}/1");
        sb.AppendLine("Accept: application/json");
        sb.AppendLine();
        return sb.ToString();
    }

    private string GenerateAuthHttpSample()
    {
        var sb = new StringBuilder();
        sb.AppendLine("@baseUrl = http://localhost:5000");
        sb.AppendLine();
        sb.AppendLine("### Auth - Login");
        sb.AppendLine("POST {{baseUrl}}/api/auth/login");
        sb.AppendLine("Content-Type: application/json");
        sb.AppendLine("Accept: application/json");
        sb.AppendLine();
        sb.AppendLine("{");
        sb.AppendLine("  \"username\": \"admin\",");
        sb.AppendLine("  \"password\": \"admin123\"");
        sb.AppendLine("}");
        sb.AppendLine();
        sb.AppendLine("### Auth - Refresh");
        sb.AppendLine("POST {{baseUrl}}/api/auth/refresh");
        sb.AppendLine("Content-Type: application/json");
        sb.AppendLine("Accept: application/json");
        sb.AppendLine();
        sb.AppendLine("{");
        sb.AppendLine("  \"refreshToken\": \"<refresh-token>\"");
        sb.AppendLine("}");
        sb.AppendLine();
        return sb.ToString();
    }

    private static string BuildEntityJsonBody(EntityDefinition entity)
    {
        var lines = entity.Properties
            .Where(property => !property.IsKey)
            .Select(property => $"  \"{ToCamelCase(property.Name)}\": {GetHttpSampleValue(property.Type)}")
            .ToList();

        return lines.Count == 0
            ? "{}"
            : "{\n" + string.Join(",\n", lines) + "\n}";
    }

    private static string GetHttpSampleValue(string propertyType)
    {
        return propertyType.ToLowerInvariant() switch
        {
            "string" => "\"example\"",
            "guid" => "\"00000000-0000-0000-0000-000000000000\"",
            "bool" or "boolean" => "true",
            "datetime" or "datetimeoffset" => "\"2026-01-01T00:00:00Z\"",
            "decimal" or "double" or "float" => "0.0",
            _ => "0"
        };
    }

    private static string ToCamelCase(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        if (value.Length == 1)
        {
            return value.ToLowerInvariant();
        }

        return char.ToLowerInvariant(value[0]) + value[1..];
    }
}

public class GenerationResult
{
    public bool Success { get; set; }
    public List<string> GeneratedFiles { get; set; } = new();
    public List<string> Errors { get; set; } = new();
}


