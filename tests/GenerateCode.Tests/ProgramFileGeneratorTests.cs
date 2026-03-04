using GenerateCode.Generators;
using GenerateCode.Models;
using Xunit;

namespace GenerateCode.Tests;

public class ProgramFileGeneratorTests
{
    [Fact]
    public void Generate_ShouldIncludeRuntimeMigrationCheck_AndPartialProgram_WhenEfMigrationsEnabled()
    {
        var api = new ApiDefinition
        {
            ProjectName = "SampleApi",
            RootNamespace = "SampleApi",
            OptEfMigrations = true
        };

        var generator = new ProgramFileGenerator(api);
        var result = generator.Generate();

        Assert.Contains("if (dbContext.Database.IsRelational())", result);
        Assert.Contains("dbContext.Database.Migrate();", result);
        Assert.Contains("dbContext.Database.EnsureCreated();", result);
        Assert.Contains("public partial class Program", result);
    }

    [Fact]
    public void Generate_ShouldSkipSwagger_WhenUseSwaggerDisabled()
    {
        var api = new ApiDefinition
        {
            ProjectName = "SampleApi",
            RootNamespace = "SampleApi",
            UseSwagger = false
        };

        var generator = new ProgramFileGenerator(api);
        var result = generator.Generate();

        Assert.DoesNotContain("AddSwaggerGen", result);
        Assert.DoesNotContain("UseSwagger()", result);
    }
}
