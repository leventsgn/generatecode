using GenerateCode.Generators;
using GenerateCode.Models;
using Xunit;

namespace GenerateCode.Tests;

public class ControllerGeneratorTests
{
    [Fact]
    public void Generate_CrudController_ShouldIncludeAllHttpMethods()
    {
        var entity = new EntityDefinition
        {
            Name = "Product",
            GenerateCrud = true,
            Properties = new List<PropertyDefinition>
            {
                new() { Name = "Id", Type = "int", IsKey = true },
                new() { Name = "Name", Type = "string" }
            }
        };
        var controller = new ControllerDefinition
        {
            Name = "Product",
            EntityName = "Product"
        };

        var generator = new ControllerGenerator(controller, entity, "TestApi");
        var result = generator.Generate();

        Assert.Contains("[HttpGet]", result);
        Assert.Contains("[HttpPost]", result);
        Assert.Contains("[HttpPut", result);
        Assert.Contains("[HttpDelete", result);
    }

    [Fact]
    public void Generate_CrudController_ShouldIncludeApiControllerAttribute()
    {
        var entity = new EntityDefinition
        {
            Name = "Product",
            Properties = new List<PropertyDefinition>
            {
                new() { Name = "Id", Type = "int", IsKey = true }
            }
        };
        var controller = new ControllerDefinition
        {
            Name = "Product",
            EntityName = "Product"
        };

        var generator = new ControllerGenerator(controller, entity, "TestApi");
        var result = generator.Generate();

        Assert.Contains("[ApiController]", result);
    }

    [Fact]
    public void Generate_CrudController_ShouldUseServiceDependency()
    {
        var entity = new EntityDefinition
        {
            Name = "Product",
            Properties = new List<PropertyDefinition>
            {
                new() { Name = "Id", Type = "int", IsKey = true }
            }
        };
        var controller = new ControllerDefinition
        {
            Name = "Product",
            EntityName = "Product"
        };

        var generator = new ControllerGenerator(controller, entity, "TestApi");
        var result = generator.Generate();

        Assert.Contains("ProductService", result);
    }

    [Fact]
    public void Generate_CustomController_ShouldIncludeEndpoints()
    {
        var controller = new ControllerDefinition
        {
            Name = "Health",
            Route = "api/health",
            Endpoints = new List<EndpointDefinition>
            {
                new()
                {
                    HttpMethod = "GET",
                    MethodName = "Check",
                    ResponseType = "string"
                }
            }
        };

        var generator = new ControllerGenerator(controller, null, "TestApi");
        var result = generator.Generate();

        Assert.Contains("[HttpGet]", result);
        Assert.Contains("Check", result);
    }

    [Fact]
    public void FileName_ShouldFollowConvention()
    {
        var controller = new ControllerDefinition { Name = "Product" };
        var generator = new ControllerGenerator(controller, null, "TestApi");

        Assert.Equal("Controllers/ProductController.cs", generator.FileName);
    }
}
