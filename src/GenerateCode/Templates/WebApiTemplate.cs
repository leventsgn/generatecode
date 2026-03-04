using GenerateCode.Engine;
using GenerateCode.Infrastructure;
using GenerateCode.Models;

namespace GenerateCode.Templates;

public sealed class WebApiTemplate : IProjectTemplate
{
    public string Name => "webapi";

    public IReadOnlyList<GeneratedFile> Generate(ProjectDefinition definition)
    {
        var api = new ApiDefinition
        {
            ProjectName = definition.ProjectName,
            RootNamespace = definition.RootNamespace,
            DatabaseProvider = definition.DatabaseProvider,
            Entities = definition.Entities,
            Controllers = definition.Controllers
        };

        var generator = new ApiProjectGenerator(api, string.Empty);
        var files = generator
            .BuildGenerators()
            .Select(codeGenerator => new GeneratedFile(codeGenerator.FileName, codeGenerator.Generate()))
            .ToList();

        return files;
    }
}
