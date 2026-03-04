namespace GenerateCode.Models;

public class EndpointDefinition
{
    public string HttpMethod { get; set; } = "GET";
    public string Route { get; set; } = string.Empty;
    public string MethodName { get; set; } = string.Empty;
    public string? RequestType { get; set; }
    public string? ResponseType { get; set; }
    public string Description { get; set; } = string.Empty;
}
