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

    [Fact]
    public void BuildGenerators_ShouldIncludeAdvancedPacks_WhenOptionsEnabled()
    {
        var api = new ApiDefinition
        {
            ProjectName = "AdvancedApi",
            RootNamespace = "AdvancedApi",
            DatabaseProvider = "PostgreSQL",
            OptAuthPack = true,
            OptProductionPack = true,
            OptTestGeneration = true,
            OptEfMigrations = true,
            OptPostmanExport = true,
            Entities = new List<EntityDefinition>
            {
                new()
                {
                    Name = "Product",
                    GenerateCrud = true,
                    Properties = new List<PropertyDefinition>
                    {
                        new() { Name = "Id", Type = "int", IsKey = true },
                        new() { Name = "Name", Type = "string", IsRequired = true }
                    }
                }
            }
        };

        var generator = new ApiProjectGenerator(api, "/tmp/test");
        var generators = generator.BuildGenerators();

        Assert.Contains(generators, g => g.FileName == "Models/AuthUser.cs");
        Assert.Contains(generators, g => g.FileName == "Controllers/AuthController.cs");
        Assert.Contains(generators, g => g.FileName == "Infrastructure/Pagination/PageRequest.cs");
        Assert.Contains(generators, g => g.FileName == "Middleware/GlobalExceptionMiddleware.cs");
        Assert.Contains(generators, g => g.FileName == "Data/SeedData.cs");
        Assert.Contains(generators, g => g.FileName == "Data/AppDbContextFactory.cs");
        Assert.Contains(generators, g => g.FileName == "Migrations/0001_InitialScaffold.cs");
        Assert.Contains(generators, g => g.FileName == "postman/AdvancedApi.postman_collection.json");
        Assert.Contains(generators, g => g.FileName == "http/Product.http");
        Assert.Contains(generators, g => g.FileName == "http/Auth.http");
        Assert.Contains(generators, g => g.FileName == "Tests/AdvancedApi.Tests/AdvancedApi.Tests.csproj");
    }

    [Fact]
    public void BuildGenerators_ShouldCreateWebApplicationFactoryIntegrationTest_WhenTestGenerationEnabled()
    {
        var api = new ApiDefinition
        {
            ProjectName = "StoreApi",
            RootNamespace = "StoreApi",
            OptTestGeneration = true,
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
        var integration = generators.Single(g => g.FileName == "Tests/StoreApi.Tests/Integration/ApiSmokeTests.cs");
        var content = integration.Generate();

        Assert.Contains("WebApplicationFactory", content);
        Assert.Contains("Root_ShouldNotReturnServerError", content);
        Assert.Contains("CrudCreate_ShouldReturnExpectedStatus", content);
        Assert.Contains("CrudUpdate_ShouldReturnExpectedStatus", content);
        Assert.Contains("CrudDelete_ShouldReturnExpectedStatus", content);
        Assert.Contains("PostAsync", content);
        Assert.Contains("PutAsync", content);
        Assert.Contains("DeleteAsync", content);
    }

    [Fact]
    public void BuildGenerators_ShouldCreateAuthorizedIntegrationFlow_WhenAuthPackEnabled()
    {
        var api = new ApiDefinition
        {
            ProjectName = "StoreApi",
            RootNamespace = "StoreApi",
            OptAuthPack = true,
            OptTestGeneration = true,
            Entities = new List<EntityDefinition>
            {
                new()
                {
                    Name = "Product",
                    GenerateCrud = true,
                    Properties = new List<PropertyDefinition>
                    {
                        new() { Name = "Id", Type = "int", IsKey = true },
                        new() { Name = "Name", Type = "string", IsRequired = true }
                    }
                }
            }
        };

        var generator = new ApiProjectGenerator(api, "/tmp/test");
        var generators = generator.BuildGenerators();
        var integration = generators.Single(g => g.FileName == "Tests/StoreApi.Tests/Integration/ApiSmokeTests.cs");
        var content = integration.Generate();

        Assert.Contains("EnsureAuthSeed", content);
        Assert.Contains("LoginAsAdminAsync", content);
        Assert.Contains("CrudEndpoint_WithToken_ShouldReturnOk", content);
        Assert.Contains("CrudCreate_WithToken_ShouldReturnCreated", content);
        Assert.Contains("CrudUpdate_WithToken_ShouldReturnOk", content);
        Assert.Contains("CrudDelete_WithToken_ShouldReturnNoContent", content);
        Assert.Contains("AuthenticationHeaderValue", content);
    }
}
