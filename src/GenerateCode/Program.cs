using System.Text.Json;
using GenerateCode.Infrastructure;
using GenerateCode.Templates;
using GenerateCode.Validation;

namespace GenerateCode;

public class Program
{
    public static int Main(string[] args)
    {
        if (args.Length == 0 || args.Contains("-h") || args.Contains("--help"))
        {
            PrintUsage();
            return 0;
        }

        if (!TryParseArguments(args, out var options, out var parseError))
        {
            Console.Error.WriteLine($"Error: {parseError}");
            Console.Error.WriteLine();
            PrintUsage();
            return 1;
        }

        if (!File.Exists(options.InputFile))
        {
            Console.Error.WriteLine($"Error: Input file '{options.InputFile}' not found.");
            return 1;
        }

        try
        {
            var json = File.ReadAllText(options.InputFile);
            var definition = DefinitionParser.Parse(json, options.TemplateOverride);
            var validation = DefinitionValidator.Validate(definition);
            if (!validation.Success)
            {
                Console.Error.WriteLine("Error: Definition validation failed.");
                foreach (var error in validation.Errors)
                {
                    Console.Error.WriteLine($"  - {error}");
                }
                return 1;
            }

            if (!ProjectTemplateRegistry.TryResolve(definition.Template, out var template))
            {
                Console.Error.WriteLine($"Error: Unsupported template '{definition.Template}'.");
                return 1;
            }

            var outputPath = Path.Combine(options.OutputDirectory, definition.ProjectName);
            var files = template.Generate(definition);

            Console.WriteLine($"Template: {template.Name}");
            Console.WriteLine($"Project: {definition.ProjectName}");
            Console.WriteLine($"Output: {outputPath}");
            Console.WriteLine($"Prepared {files.Count} files.");

            if (options.Preview || options.DryRun)
            {
                Console.WriteLine("Files:");
                foreach (var file in files)
                {
                    Console.WriteLine($"  - {file.RelativePath}");
                }
            }

            if (options.DryRun)
            {
                Console.WriteLine("Dry-run completed. No files were written.");
                return 0;
            }

            var writer = new FileWriter();
            var writeResult = writer.WriteFiles(outputPath, files, options.OverwriteMode);
            if (!writeResult.Success)
            {
                Console.Error.WriteLine("Error: Some files could not be written.");
                foreach (var error in writeResult.Errors)
                {
                    Console.Error.WriteLine($"  - {error}");
                }
                return 1;
            }

            Console.WriteLine($"Written files: {writeResult.WrittenFiles.Count}");
            if (writeResult.SkippedFiles.Count > 0)
            {
                Console.WriteLine($"Skipped files: {writeResult.SkippedFiles.Count}");
            }

            if (options.SmokeBuild)
            {
                Console.WriteLine("Running smoke build...");
                var smokeBuild = new SmokeBuildRunner().Run(outputPath);
                if (!smokeBuild.Success)
                {
                    Console.Error.WriteLine("Smoke build failed.");
                    Console.Error.WriteLine(smokeBuild.Output);
                    return 1;
                }

                Console.WriteLine("Smoke build passed.");
            }

            return 0;
        }
        catch (JsonException ex)
        {
            Console.Error.WriteLine($"Error: Invalid JSON in input file: {ex.Message}");
            return 1;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Error: {ex.Message}");
            return 1;
        }
    }

    private static bool TryParseArguments(string[] args, out CliOptions options, out string error)
    {
        options = new CliOptions();
        error = string.Empty;
        var positional = new List<string>();

        for (var i = 0; i < args.Length; i++)
        {
            var arg = args[i];
            switch (arg)
            {
                case "--template":
                    if (!TryGetValue(args, ref i, out var templateValue, out error))
                    {
                        return false;
                    }

                    options.TemplateOverride = templateValue;
                    break;
                case "--output":
                    if (!TryGetValue(args, ref i, out var outputValue, out error))
                    {
                        return false;
                    }

                    options.OutputDirectory = outputValue;
                    options.OutputSpecified = true;
                    break;
                case "--overwrite":
                    if (!TryGetValue(args, ref i, out var overwriteValue, out error))
                    {
                        return false;
                    }

                    if (!Enum.TryParse<OverwriteMode>(overwriteValue, true, out var parsedMode))
                    {
                        error = $"Invalid overwrite mode '{overwriteValue}'. Use Overwrite, Skip, or Error.";
                        return false;
                    }

                    options.OverwriteMode = parsedMode;
                    break;
                case "--preview":
                    options.Preview = true;
                    break;
                case "--dry-run":
                    options.DryRun = true;
                    options.Preview = true;
                    break;
                case "--smoke-build":
                    options.SmokeBuild = true;
                    break;
                default:
                    if (arg.StartsWith("-", StringComparison.Ordinal))
                    {
                        error = $"Unknown option '{arg}'.";
                        return false;
                    }

                    positional.Add(arg);
                    break;
            }
        }

        if (positional.Count == 0)
        {
            error = "Input file is required.";
            return false;
        }

        options.InputFile = positional[0];
        if (positional.Count > 1 && !options.OutputSpecified)
        {
            options.OutputDirectory = positional[1];
        }

        return true;
    }

    private static bool TryGetValue(string[] args, ref int index, out string value, out string error)
    {
        if (index + 1 >= args.Length)
        {
            value = string.Empty;
            error = $"Missing value for '{args[index]}'.";
            return false;
        }

        index++;
        value = args[index];
        error = string.Empty;
        return true;
    }

    private static void PrintUsage()
    {
        Console.WriteLine("GenerateCode - Template-based .NET Project Generator");
        Console.WriteLine();
        Console.WriteLine("Usage:");
        Console.WriteLine("  GenerateCode <input-file> [output-directory] [options]");
        Console.WriteLine();
        Console.WriteLine("Arguments:");
        Console.WriteLine("  input-file        Path to the API definition JSON file");
        Console.WriteLine("  output-directory  Output directory (default: 'output')");
        Console.WriteLine();
        Console.WriteLine("Options:");
        Console.WriteLine("  --template <name>       Override template from JSON (webapi, worker, console, library)");
        Console.WriteLine("  --output <path>         Set output directory");
        Console.WriteLine("  --overwrite <mode>      Overwrite mode: Overwrite, Skip, Error");
        Console.WriteLine("  --preview               Print file list before writing");
        Console.WriteLine("  --dry-run               Validate and render file list only");
        Console.WriteLine("  --smoke-build           Run 'dotnet build' after generation");
        Console.WriteLine();
        Console.WriteLine("Example:");
        Console.WriteLine("  GenerateCode samples/petstore-api.json ./output --template webapi --smoke-build");
    }

    private sealed class CliOptions
    {
        public string InputFile { get; set; } = string.Empty;
        public string OutputDirectory { get; set; } = "output";
        public string? TemplateOverride { get; set; }
        public bool Preview { get; set; }
        public bool DryRun { get; set; }
        public bool SmokeBuild { get; set; }
        public OverwriteMode OverwriteMode { get; set; } = OverwriteMode.Overwrite;
        public bool OutputSpecified { get; set; }
    }
}
