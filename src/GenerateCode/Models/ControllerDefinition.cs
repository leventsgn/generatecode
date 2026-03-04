namespace GenerateCode.Models;

public class ControllerDefinition
{
    public string Name { get; set; } = string.Empty;
    public string Route { get; set; } = string.Empty;
    public string? EntityName { get; set; }
    public List<EndpointDefinition> Endpoints { get; set; } = new();
}
