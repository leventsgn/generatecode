using GenerateCode.Infrastructure;
using Xunit;

namespace GenerateCode.Tests.Infrastructure;

public class DefinitionParserTests
{
    [Fact]
    public void Parse_ShouldSupportLegacyApiDefinition()
    {
        const string json = """
{
  "projectName": "LegacyApi",
  "rootNamespace": "LegacyApi",
  "databaseProvider": "InMemory",
  "entities": [],
  "controllers": []
}
""";

        var definition = DefinitionParser.Parse(json);

        Assert.Equal("webapi", definition.Template);
        Assert.Equal("LegacyApi", definition.ProjectName);
        Assert.Equal("LegacyApi", definition.RootNamespace);
    }

    [Fact]
    public void Parse_ShouldSupportTemplateOverride()
    {
        const string json = """
{
  "template": "worker",
  "projectName": "Jobs",
  "rootNamespace": "Jobs"
}
""";

        var definition = DefinitionParser.Parse(json, "console");

        Assert.Equal("console", definition.Template);
        Assert.Equal("Jobs", definition.ProjectName);
    }

    [Fact]
    public void Parse_ShouldMapAdvancedWebApiOptions()
    {
        const string json = """
{
  "template": "webapi",
  "projectName": "AdvancedApi",
  "rootNamespace": "AdvancedApi",
  "targetFramework": "net8.0",
  "databaseProvider": "PostgreSQL",
  "useSwagger": false,
  "optAuthPack": true,
  "optProductionPack": true,
  "optTestGeneration": true,
  "optEfMigrations": true,
  "optPostmanExport": true
}
""";

        var definition = DefinitionParser.Parse(json);

        Assert.Equal("webapi", definition.Template);
        Assert.Equal("PostgreSQL", definition.DatabaseProvider);
        Assert.False(definition.UseSwagger);
        Assert.True(definition.OptAuthPack);
        Assert.True(definition.OptProductionPack);
        Assert.True(definition.OptTestGeneration);
        Assert.True(definition.OptEfMigrations);
        Assert.True(definition.OptPostmanExport);
    }
}
