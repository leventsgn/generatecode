using GenerateCode.Infrastructure;
using GenerateCode.Models;

namespace GenerateCode.Templates;

public interface IProjectTemplate
{
    string Name { get; }
    IReadOnlyList<GeneratedFile> Generate(ProjectDefinition definition);
}
