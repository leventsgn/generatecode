using GenerateCode.Models;
using GenerateCode.Templates;
using Xunit;

namespace GenerateCode.Tests.Templates;

public class ProjectTemplateRegistryTests
{
    [Fact]
    public void TryResolve_ShouldReturnWorkerTemplate()
    {
        var ok = ProjectTemplateRegistry.TryResolve("worker", out var template);

        Assert.True(ok);
        Assert.Equal("worker", template.Name);
    }

    [Fact]
    public void WorkerTemplate_ShouldGenerateExpectedFiles()
    {
        var definition = new ProjectDefinition
        {
            Template = "worker",
            ProjectName = "Jobs",
            RootNamespace = "Jobs"
        };

        var ok = ProjectTemplateRegistry.TryResolve("worker", out var template);
        Assert.True(ok);

        var files = template.Generate(definition);

        Assert.Contains(files, file => file.RelativePath == "Program.cs");
        Assert.Contains(files, file => file.RelativePath == "Worker.cs");
        Assert.Contains(files, file => file.RelativePath == "Jobs.csproj");
    }

    [Fact]
    public void TryResolve_ShouldReturnWindowsServiceTemplate()
    {
        var ok = ProjectTemplateRegistry.TryResolve("windowsservice", out var template);

        Assert.True(ok);
        Assert.Equal("windowsservice", template.Name);
    }

    [Fact]
    public void WindowsServiceTemplate_ShouldGenerateExpectedFiles()
    {
        var definition = new ProjectDefinition
        {
            Template = "windowsservice",
            ProjectName = "JobsService",
            RootNamespace = "JobsService"
        };

        var ok = ProjectTemplateRegistry.TryResolve("windowsservice", out var template);
        Assert.True(ok);

        var files = template.Generate(definition);

        Assert.Contains(files, file => file.RelativePath == "Program.cs");
        Assert.Contains(files, file => file.RelativePath == "Worker.cs");
        Assert.Contains(files, file => file.RelativePath == "appsettings.json");
        Assert.Contains(files, file => file.RelativePath == "JobsService.csproj");
    }

    [Fact]
    public void TryResolve_ShouldReturnGrpcTemplate()
    {
        var ok = ProjectTemplateRegistry.TryResolve("grpc", out var template);

        Assert.True(ok);
        Assert.Equal("grpc", template.Name);
    }

    [Fact]
    public void GrpcTemplate_ShouldGenerateExpectedFiles()
    {
        var definition = new ProjectDefinition
        {
            Template = "grpc",
            ProjectName = "MessagingGrpc",
            RootNamespace = "MessagingGrpc"
        };

        var ok = ProjectTemplateRegistry.TryResolve("grpc", out var template);
        Assert.True(ok);

        var files = template.Generate(definition);

        Assert.Contains(files, file => file.RelativePath == "Program.cs");
        Assert.Contains(files, file => file.RelativePath == "Protos/greet.proto");
        Assert.Contains(files, file => file.RelativePath == "Services/GreeterService.cs");
        Assert.Contains(files, file => file.RelativePath == "MessagingGrpc.csproj");
    }
}
