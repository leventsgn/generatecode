using System.Text;
using GenerateCode.Infrastructure;
using GenerateCode.Models;

namespace GenerateCode.Templates;

public sealed class WorkerTemplate : IProjectTemplate
{
    public string Name => "worker";

    public IReadOnlyList<GeneratedFile> Generate(ProjectDefinition definition)
    {
        return new List<GeneratedFile>
        {
            new($"{definition.ProjectName}.csproj", GenerateProjectFile(definition)),
            new("Program.cs", GenerateProgramFile(definition)),
            new("Worker.cs", GenerateWorkerFile(definition)),
            new("appsettings.json", GenerateAppSettings())
        };
    }

    private static string GenerateProjectFile(ProjectDefinition definition)
    {
        var sb = new StringBuilder();
        sb.AppendLine("<Project Sdk=\"Microsoft.NET.Sdk.Worker\">");
        sb.AppendLine();
        sb.AppendLine("  <PropertyGroup>");
        sb.AppendLine($"    <TargetFramework>{definition.TargetFramework}</TargetFramework>");
        sb.AppendLine("    <Nullable>enable</Nullable>");
        sb.AppendLine("    <ImplicitUsings>enable</ImplicitUsings>");
        sb.AppendLine($"    <RootNamespace>{definition.RootNamespace}</RootNamespace>");
        sb.AppendLine("  </PropertyGroup>");
        sb.AppendLine();
        sb.AppendLine("  <ItemGroup>");
        sb.AppendLine("    <PackageReference Include=\"Microsoft.Extensions.Hosting\" Version=\"8.0.0\" />");
        sb.AppendLine("  </ItemGroup>");
        sb.AppendLine();
        sb.AppendLine("</Project>");
        return sb.ToString();
    }

    private static string GenerateProgramFile(ProjectDefinition definition)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"using {definition.RootNamespace};");
        sb.AppendLine();
        sb.AppendLine("var builder = Host.CreateApplicationBuilder(args);");
        sb.AppendLine("builder.Services.AddHostedService<Worker>();");
        sb.AppendLine();
        sb.AppendLine("var host = builder.Build();");
        sb.AppendLine("host.Run();");
        return sb.ToString();
    }

    private static string GenerateWorkerFile(ProjectDefinition definition)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"namespace {definition.RootNamespace};");
        sb.AppendLine();
        sb.AppendLine("public class Worker : BackgroundService");
        sb.AppendLine("{");
        sb.AppendLine("    private readonly ILogger<Worker> _logger;");
        sb.AppendLine();
        sb.AppendLine("    public Worker(ILogger<Worker> logger)");
        sb.AppendLine("    {");
        sb.AppendLine("        _logger = logger;");
        sb.AppendLine("    }");
        sb.AppendLine();
        sb.AppendLine("    protected override async Task ExecuteAsync(CancellationToken stoppingToken)");
        sb.AppendLine("    {");
        sb.AppendLine("        while (!stoppingToken.IsCancellationRequested)");
        sb.AppendLine("        {");
        sb.AppendLine("            _logger.LogInformation(\"Worker running at: {time}\", DateTimeOffset.Now);");
        sb.AppendLine("            await Task.Delay(1000, stoppingToken);");
        sb.AppendLine("        }");
        sb.AppendLine("    }");
        sb.AppendLine("}");
        return sb.ToString();
    }

    private static string GenerateAppSettings()
    {
        return """
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.Hosting.Lifetime": "Information"
    }
  }
}
""";
    }
}
