using GenerateCode.Engine;
using GenerateCode.Models;
using Xunit;

namespace GenerateCode.Tests;

public class ApiProjectGeneratorTests
{
    [Fact]
    public void BuildGenerators_ShouldAlwaysIncludeProjectAndProgramFiles()
    {
        var api = new ApiDefinition
        {
            ProjectName = "TestApi",
            RootNamespace = "TestApi"
        };
        var generator = new ApiProjectGenerator(api, "/tmp/test");
        var generators = generator.BuildGenerators();

        Assert.Contains(generators, g => g.FileName.EndsWith(".csproj"));
        Assert.Contains(generators, g => g.FileName == "Program.cs");
    }

    [Fact]
    public void BuildGenerators_ShouldIncludeDbContextWhenEntitiesExist()
    {
        var api = new ApiDefinition
        {
            ProjectName = "TestApi",
            Entities = new List<EntityDefinition>
            {
                new() { Name = "Product" }
            }
        };
        var generator = new ApiProjectGenerator(api, "/tmp/test");
        var generators = generator.BuildGenerators();

        Assert.Contains(generators, g => g.FileName == "Data/AppDbContext.cs");
    }

    [Fact]
    public void BuildGenerators_ShouldNotIncludeDbContextWhenNoEntities()
    {
        var api = new ApiDefinition { ProjectName = "TestApi" };
        var generator = new ApiProjectGenerator(api, "/tmp/test");
        var generators = generator.BuildGenerators();

        Assert.DoesNotContain(generators, g => g.FileName == "Data/AppDbContext.cs");
    }

    [Fact]
    public void BuildGenerators_ShouldAutoGenerateCrudControllers()
    {
        var api = new ApiDefinition
        {
            ProjectName = "TestApi",
            Entities = new List<EntityDefinition>
            {
                new()
                {
                    Name = "Product",
                    GenerateCrud = true,
                    Properties = new List<PropertyDefinition>
                    {
                        new() { Name = "Id", Type = "int", IsKey = true }
                    }
                }
            }
        };
        var generator = new ApiProjectGenerator(api, "/tmp/test");
        var generators = generator.BuildGenerators();

        Assert.Contains(generators, g => g.FileName == "Controllers/ProductController.cs");
        Assert.Contains(generators, g => g.FileName == "Services/ProductService.cs");
        Assert.Contains(generators, g => g.FileName == "Models/Product.cs");
    }

    [Fact]
    public void BuildGenerators_ShouldNotDuplicateControllers()
    {
        var api = new ApiDefinition
        {
            ProjectName = "TestApi",
            Entities = new List<EntityDefinition>
            {
                new()
                {
                    Name = "Product",
                    GenerateCrud = true,
                    Properties = new List<PropertyDefinition>
                    {
                        new() { Name = "Id", Type = "int", IsKey = true }
                    }
                }
            },
            Controllers = new List<ControllerDefinition>
            {
                new() { Name = "Product", EntityName = "Product" }
            }
        };
        var generator = new ApiProjectGenerator(api, "/tmp/test");
        var generators = generator.BuildGenerators();

        var controllerCount = generators.Count(g => g.FileName == "Controllers/ProductController.cs");
        Assert.Equal(1, controllerCount);
    }
}
