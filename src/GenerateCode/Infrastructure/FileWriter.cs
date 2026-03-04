using System.Collections.ObjectModel;

namespace GenerateCode.Infrastructure;

public enum OverwriteMode
{
    Overwrite,
    Skip,
    Error
}

public sealed class WriteResult
{
    public Collection<string> WrittenFiles { get; } = new();
    public Collection<string> SkippedFiles { get; } = new();
    public Collection<string> Errors { get; } = new();
    public bool Success => Errors.Count == 0;
}

public sealed class FileWriter
{
    public WriteResult WriteFiles(string outputRoot, IEnumerable<GeneratedFile> files, OverwriteMode mode)
    {
        var result = new WriteResult();

        foreach (var file in files)
        {
            var fullPath = Path.Combine(outputRoot, file.RelativePath);
            var directory = Path.GetDirectoryName(fullPath);
            if (!string.IsNullOrEmpty(directory))
            {
                Directory.CreateDirectory(directory);
            }

            if (File.Exists(fullPath))
            {
                switch (mode)
                {
                    case OverwriteMode.Skip:
                        result.SkippedFiles.Add(fullPath);
                        continue;
                    case OverwriteMode.Error:
                        result.Errors.Add($"File already exists: {fullPath}");
                        continue;
                }
            }

            File.WriteAllText(fullPath, file.Content);
            result.WrittenFiles.Add(fullPath);
        }

        return result;
    }
}
