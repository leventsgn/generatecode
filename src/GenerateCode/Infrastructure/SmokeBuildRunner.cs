using System.Diagnostics;
using System.Text;

namespace GenerateCode.Infrastructure;

public sealed class SmokeBuildResult
{
    public bool Success { get; set; }
    public int ExitCode { get; set; }
    public string Output { get; set; } = string.Empty;
}

public sealed class SmokeBuildRunner
{
    public SmokeBuildResult Run(string projectDirectory)
    {
        var processStartInfo = new ProcessStartInfo
        {
            FileName = "dotnet",
            Arguments = "build",
            WorkingDirectory = projectDirectory,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = new Process { StartInfo = processStartInfo };
        var output = new StringBuilder();

        process.Start();
        output.AppendLine(process.StandardOutput.ReadToEnd());
        output.AppendLine(process.StandardError.ReadToEnd());
        process.WaitForExit();

        return new SmokeBuildResult
        {
            Success = process.ExitCode == 0,
            ExitCode = process.ExitCode,
            Output = output.ToString()
        };
    }
}
