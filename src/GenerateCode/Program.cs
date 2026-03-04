using System.Text.Json;
using System.Text.Json.Serialization;
using GenerateCode.Engine;
using GenerateCode.Models;

namespace GenerateCode;

public class Program
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true,
        Converters = { new JsonStringEnumConverter() }
    };

    public static int Main(string[] args)
    {
        if (args.Length == 0 || args[0] is "-h" or "--help")
        {
            PrintUsage();
            return 0;
        }

        var inputFile = args[0];
        var outputDir = args.Length > 1 ? args[1] : "output";

        if (!File.Exists(inputFile))
        {
            Console.Error.WriteLine($"Error: Input file '{inputFile}' not found.");
            return 1;
        }

        try
        {
            var json = File.ReadAllText(inputFile);
            var api = JsonSerializer.Deserialize<ApiDefinition>(json, JsonOptions);

            if (api == null)
            {
                Console.Error.WriteLine("Error: Failed to parse API definition.");
                return 1;
            }

            var outputPath = Path.Combine(outputDir, api.ProjectName);
            var generator = new ApiProjectGenerator(api, outputPath);
            var result = generator.Generate();

            if (result.Success)
            {
                Console.WriteLine($"API project generated successfully at: {outputPath}");
                Console.WriteLine($"Generated {result.GeneratedFiles.Count} files:");
                foreach (var file in result.GeneratedFiles)
                {
                    Console.WriteLine($"  - {file}");
                }
                return 0;
            }

            Console.Error.WriteLine("Error: Generation failed.");
            foreach (var error in result.Errors)
            {
                Console.Error.WriteLine($"  - {error}");
            }
            return 1;
        }
        catch (JsonException ex)
        {
            Console.Error.WriteLine($"Error: Invalid JSON in input file: {ex.Message}");
            return 1;
        }
    }

    private static void PrintUsage()
    {
        Console.WriteLine("GenerateCode - .NET API Code Generator");
        Console.WriteLine();
        Console.WriteLine("Usage: GenerateCode <input-file> [output-directory]");
        Console.WriteLine();
        Console.WriteLine("Arguments:");
        Console.WriteLine("  input-file        Path to the API definition JSON file");
        Console.WriteLine("  output-directory   Output directory (default: 'output')");
        Console.WriteLine();
        Console.WriteLine("Example:");
        Console.WriteLine("  GenerateCode api-definition.json ./my-api");
    }
}
