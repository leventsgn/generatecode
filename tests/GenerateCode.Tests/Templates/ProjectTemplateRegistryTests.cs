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
}
