using GenerateCode.Generators;
using GenerateCode.Models;

namespace GenerateCode.Engine;

public class ApiProjectGenerator
{
    private readonly ApiDefinition _api;
    private readonly string _outputPath;

    public ApiProjectGenerator(ApiDefinition api, string outputPath)
    {
        _api = api;
        _outputPath = outputPath;
    }

    public GenerationResult Generate()
    {
        var result = new GenerationResult();
        var generators = BuildGenerators();

        foreach (var generator in generators)
        {
            var filePath = Path.Combine(_outputPath, generator.FileName);
            var directory = Path.GetDirectoryName(filePath);

            if (!string.IsNullOrEmpty(directory))
            {
                Directory.CreateDirectory(directory);
            }

            var content = generator.Generate();
            File.WriteAllText(filePath, content);
            result.GeneratedFiles.Add(filePath);
        }

        result.Success = true;
        return result;
    }

    internal List<ICodeGenerator> BuildGenerators()
    {
        var generators = new List<ICodeGenerator>();

        // Project file
        generators.Add(new ProjectFileGenerator(_api));

        // Program.cs
        generators.Add(new ProgramFileGenerator(_api));

        // DbContext
        if (_api.Entities.Count > 0)
        {
            generators.Add(new DbContextGenerator(_api));
        }

        // Models and Services for each entity
        foreach (var entity in _api.Entities)
        {
            generators.Add(new ModelGenerator(entity, _api.RootNamespace));

            if (entity.GenerateCrud)
            {
                generators.Add(new ServiceGenerator(entity, _api.RootNamespace));
            }
        }

        // Controllers
        foreach (var controller in _api.Controllers)
        {
            var entity = _api.Entities.FirstOrDefault(e => e.Name == controller.EntityName);
            generators.Add(new ControllerGenerator(controller, entity, _api.RootNamespace));
        }

        // Auto-generate controllers for entities with CRUD that don't have explicit controllers
        foreach (var entity in _api.Entities.Where(e => e.GenerateCrud))
        {
            var hasController = _api.Controllers.Any(c => c.EntityName == entity.Name);
            if (!hasController)
            {
                var controller = new ControllerDefinition
                {
                    Name = entity.Name,
                    EntityName = entity.Name
                };
                generators.Add(new ControllerGenerator(controller, entity, _api.RootNamespace));
            }
        }

        return generators;
    }
}

public class GenerationResult
{
    public bool Success { get; set; }
    public List<string> GeneratedFiles { get; set; } = new();
    public List<string> Errors { get; set; } = new();
}
