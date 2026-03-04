using GenerateCode.Models;
using GenerateCode.Validation;
using Xunit;

namespace GenerateCode.Tests.Validation;

public class DefinitionValidatorTests
{
    [Fact]
    public void Validate_ShouldFail_WhenWebApiEntityHasNoPrimaryKey()
    {
        var definition = new ProjectDefinition
        {
            Template = "webapi",
            ProjectName = "MyApi",
            RootNamespace = "MyApi",
            Entities = new List<EntityDefinition>
            {
                new()
                {
                    Name = "Product",
                    GenerateCrud = true,
                    Properties = new List<PropertyDefinition>
                    {
                        new() { Name = "Name", Type = "string" }
                    }
                }
            }
        };

        var result = DefinitionValidator.Validate(definition);

        Assert.False(result.Success);
        Assert.Contains(result.Errors, error => error.Contains("requires a key property", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Validate_ShouldPass_ForWorkerTemplateWithoutEntities()
    {
        var definition = new ProjectDefinition
        {
            Template = "worker",
            ProjectName = "MyWorker",
            RootNamespace = "MyWorker"
        };

        var result = DefinitionValidator.Validate(definition);

        Assert.True(result.Success);
    }
}
