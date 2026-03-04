using GenerateCode.Generators;
using GenerateCode.Models;
using Xunit;

namespace GenerateCode.Tests;

public class ServiceGeneratorTests
{
    [Fact]
    public void Generate_ShouldIncludeAllCrudMethods()
    {
        var entity = new EntityDefinition
        {
            Name = "Product",
            Properties = new List<PropertyDefinition>
            {
                new() { Name = "Id", Type = "int", IsKey = true }
            }
        };

        var generator = new ServiceGenerator(entity, "TestApi");
        var result = generator.Generate();

        Assert.Contains("GetAllAsync", result);
        Assert.Contains("GetByIdAsync", result);
        Assert.Contains("CreateAsync", result);
        Assert.Contains("UpdateAsync", result);
        Assert.Contains("DeleteAsync", result);
    }

    [Fact]
    public void Generate_ShouldUseCorrectKeyType()
    {
        var entity = new EntityDefinition
        {
            Name = "Product",
            Properties = new List<PropertyDefinition>
            {
                new() { Name = "ProductId", Type = "Guid", IsKey = true }
            }
        };

        var generator = new ServiceGenerator(entity, "TestApi");
        var result = generator.Generate();

        Assert.Contains("Guid productId", result);
    }

    [Fact]
    public void Generate_ShouldUseDbContext()
    {
        var entity = new EntityDefinition
        {
            Name = "Product",
            Properties = new List<PropertyDefinition>
            {
                new() { Name = "Id", Type = "int", IsKey = true }
            }
        };

        var generator = new ServiceGenerator(entity, "TestApi");
        var result = generator.Generate();

        Assert.Contains("AppDbContext", result);
        Assert.Contains("_context", result);
    }

    [Fact]
    public void FileName_ShouldFollowConvention()
    {
        var entity = new EntityDefinition { Name = "Product" };
        var generator = new ServiceGenerator(entity, "TestApi");

        Assert.Equal("Services/ProductService.cs", generator.FileName);
    }
}
