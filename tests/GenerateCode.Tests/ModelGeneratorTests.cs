using GenerateCode.Generators;
using GenerateCode.Models;
using Xunit;

namespace GenerateCode.Tests;

public class ModelGeneratorTests
{
    [Fact]
    public void Generate_ShouldIncludeNamespace()
    {
        var entity = new EntityDefinition
        {
            Name = "Product",
            Properties = new List<PropertyDefinition>
            {
                new() { Name = "Id", Type = "int", IsKey = true }
            }
        };

        var generator = new ModelGenerator(entity, "TestApi");
        var result = generator.Generate();

        Assert.Contains("namespace TestApi.Models;", result);
    }

    [Fact]
    public void Generate_ShouldIncludeClassName()
    {
        var entity = new EntityDefinition
        {
            Name = "Product",
            Properties = new List<PropertyDefinition>
            {
                new() { Name = "Id", Type = "int", IsKey = true }
            }
        };

        var generator = new ModelGenerator(entity, "TestApi");
        var result = generator.Generate();

        Assert.Contains("public class Product", result);
    }

    [Fact]
    public void Generate_ShouldIncludeKeyAttribute()
    {
        var entity = new EntityDefinition
        {
            Name = "Product",
            Properties = new List<PropertyDefinition>
            {
                new() { Name = "Id", Type = "int", IsKey = true }
            }
        };

        var generator = new ModelGenerator(entity, "TestApi");
        var result = generator.Generate();

        Assert.Contains("[Key]", result);
    }

    [Fact]
    public void Generate_ShouldIncludeRequiredAttribute()
    {
        var entity = new EntityDefinition
        {
            Name = "Product",
            Properties = new List<PropertyDefinition>
            {
                new() { Name = "Name", Type = "string", IsRequired = true }
            }
        };

        var generator = new ModelGenerator(entity, "TestApi");
        var result = generator.Generate();

        Assert.Contains("[Required]", result);
    }

    [Fact]
    public void Generate_ShouldIncludeMaxLengthAttribute()
    {
        var entity = new EntityDefinition
        {
            Name = "Product",
            Properties = new List<PropertyDefinition>
            {
                new() { Name = "Name", Type = "string", MaxLength = 100 }
            }
        };

        var generator = new ModelGenerator(entity, "TestApi");
        var result = generator.Generate();

        Assert.Contains("[MaxLength(100)]", result);
    }

    [Fact]
    public void Generate_ShouldSetDefaultForString()
    {
        var entity = new EntityDefinition
        {
            Name = "Product",
            Properties = new List<PropertyDefinition>
            {
                new() { Name = "Name", Type = "string" }
            }
        };

        var generator = new ModelGenerator(entity, "TestApi");
        var result = generator.Generate();

        Assert.Contains("= string.Empty;", result);
    }

    [Fact]
    public void FileName_ShouldFollowConvention()
    {
        var entity = new EntityDefinition { Name = "Product" };
        var generator = new ModelGenerator(entity, "TestApi");

        Assert.Equal("Models/Product.cs", generator.FileName);
    }
}
