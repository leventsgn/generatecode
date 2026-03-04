namespace GenerateCode.Models;

public class ProjectDefinition
{
    public string Template { get; set; } = "webapi";
    public string ProjectName { get; set; } = "GeneratedProject";
    public string RootNamespace { get; set; } = "GeneratedProject";
    public string TargetFramework { get; set; } = "net8.0";
    public string DatabaseProvider { get; set; } = "InMemory";
    public bool UseSwagger { get; set; } = true;
    public List<EntityDefinition> Entities { get; set; } = new();
    public List<ControllerDefinition> Controllers { get; set; } = new();
}
