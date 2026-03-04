namespace GenerateCode.Models;

public class ApiDefinition
{
    public string ProjectName { get; set; } = "GeneratedApi";
    public string RootNamespace { get; set; } = "GeneratedApi";
    public string DatabaseProvider { get; set; } = "InMemory";
    public List<EntityDefinition> Entities { get; set; } = new();
    public List<ControllerDefinition> Controllers { get; set; } = new();
}
