using System.Text;
using GenerateCode.Infrastructure;
using GenerateCode.Models;

namespace GenerateCode.Templates;

public sealed class GrpcTemplate : IProjectTemplate
{
    public string Name => "grpc";

    public IReadOnlyList<GeneratedFile> Generate(ProjectDefinition definition)
    {
        return new List<GeneratedFile>
        {
            new($"{definition.ProjectName}.csproj", GenerateProjectFile(definition)),
            new("Program.cs", GenerateProgramFile(definition)),
            new("Protos/greet.proto", GenerateProtoFile(definition)),
            new("Services/GreeterService.cs", GenerateServiceFile(definition))
        };
    }

    private static string GenerateProjectFile(ProjectDefinition definition)
    {
        var sb = new StringBuilder();
        sb.AppendLine("<Project Sdk=\"Microsoft.NET.Sdk.Web\">");
        sb.AppendLine();
        sb.AppendLine("  <PropertyGroup>");
        sb.AppendLine($"    <TargetFramework>{definition.TargetFramework}</TargetFramework>");
        sb.AppendLine("    <Nullable>enable</Nullable>");
        sb.AppendLine("    <ImplicitUsings>enable</ImplicitUsings>");
        sb.AppendLine($"    <RootNamespace>{definition.RootNamespace}</RootNamespace>");
        sb.AppendLine("  </PropertyGroup>");
        sb.AppendLine();
        sb.AppendLine("  <ItemGroup>");
        sb.AppendLine("    <PackageReference Include=\"Grpc.AspNetCore\" Version=\"2.63.0\" />");
        sb.AppendLine("  </ItemGroup>");
        sb.AppendLine();
        sb.AppendLine("  <ItemGroup>");
        sb.AppendLine("    <Protobuf Include=\"Protos\\greet.proto\" GrpcServices=\"Server\" />");
        sb.AppendLine("  </ItemGroup>");
        sb.AppendLine();
        sb.AppendLine("</Project>");
        return sb.ToString();
    }

    private static string GenerateProgramFile(ProjectDefinition definition)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"using {definition.RootNamespace}.Services;");
        sb.AppendLine();
        sb.AppendLine("var builder = WebApplication.CreateBuilder(args);");
        sb.AppendLine();
        sb.AppendLine("builder.Services.AddGrpc();");
        sb.AppendLine();
        sb.AppendLine("var app = builder.Build();");
        sb.AppendLine();
        sb.AppendLine("app.MapGrpcService<GreeterService>();");
        sb.AppendLine("app.MapGet(\"/\", () => \"Use a gRPC client to communicate with this server.\");");
        sb.AppendLine();
        sb.AppendLine("app.Run();");
        return sb.ToString();
    }

    private static string GenerateProtoFile(ProjectDefinition definition)
    {
        var sb = new StringBuilder();
        sb.AppendLine("syntax = \"proto3\";");
        sb.AppendLine();
        sb.AppendLine($"option csharp_namespace = \"{definition.RootNamespace}\";");
        sb.AppendLine();
        sb.AppendLine("package greet;");
        sb.AppendLine();
        sb.AppendLine("service Greeter {");
        sb.AppendLine("  rpc SayHello (HelloRequest) returns (HelloReply);");
        sb.AppendLine("}");
        sb.AppendLine();
        sb.AppendLine("message HelloRequest {");
        sb.AppendLine("  string name = 1;");
        sb.AppendLine("}");
        sb.AppendLine();
        sb.AppendLine("message HelloReply {");
        sb.AppendLine("  string message = 1;");
        sb.AppendLine("}");
        return sb.ToString();
    }

    private static string GenerateServiceFile(ProjectDefinition definition)
    {
        var sb = new StringBuilder();
        sb.AppendLine("using Grpc.Core;");
        sb.AppendLine($"using {definition.RootNamespace};");
        sb.AppendLine();
        sb.AppendLine($"namespace {definition.RootNamespace}.Services;");
        sb.AppendLine();
        sb.AppendLine("public class GreeterService : Greeter.GreeterBase");
        sb.AppendLine("{");
        sb.AppendLine("    public override Task<HelloReply> SayHello(HelloRequest request, ServerCallContext context)");
        sb.AppendLine("    {");
        sb.AppendLine("        return Task.FromResult(new HelloReply");
        sb.AppendLine("        {");
        sb.AppendLine("            Message = \"Hello \" + request.Name");
        sb.AppendLine("        });");
        sb.AppendLine("    }");
        sb.AppendLine("}");
        return sb.ToString();
    }
}
