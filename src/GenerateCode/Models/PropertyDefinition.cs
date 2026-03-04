namespace GenerateCode.Models;

public class PropertyDefinition
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "string";
    public bool IsRequired { get; set; }
    public bool IsKey { get; set; }
    public int? MaxLength { get; set; }
}
