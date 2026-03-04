using GenerateCode.Models;

namespace GenerateCode.Engine;

public sealed class GenerationFeatureSet
{
    public bool UseSwagger { get; init; } = true;
    public bool OptAuthPack { get; init; }
    public bool OptProductionPack { get; init; }
    public bool OptTestGeneration { get; init; }
    public bool OptEfMigrations { get; init; }
    public bool OptPostmanExport { get; init; }

    public static GenerationFeatureSet FromApi(ApiDefinition api)
    {
        return new GenerationFeatureSet
        {
            UseSwagger = api.UseSwagger,
            OptAuthPack = api.OptAuthPack,
            OptProductionPack = api.OptProductionPack,
            OptTestGeneration = api.OptTestGeneration,
            OptEfMigrations = api.OptEfMigrations,
            OptPostmanExport = api.OptPostmanExport
        };
    }
}
