namespace GenerateCode.Models;

public class ApiDefinition
{
    public string ProjectName { get; set; } = "GeneratedApi";
    public string RootNamespace { get; set; } = "GeneratedApi";
    public string TargetFramework { get; set; } = "net8.0";
    public string DatabaseProvider { get; set; } = "InMemory";
    public bool UseSwagger { get; set; } = true;
    public bool OptAuthPack { get; set; }
    public bool OptProductionPack { get; set; }
    public bool OptTestGeneration { get; set; }
    public bool OptEfMigrations { get; set; }
    public bool OptPostmanExport { get; set; }
    public List<EntityDefinition> Entities { get; set; } = new();
    public List<ControllerDefinition> Controllers { get; set; } = new();
}
