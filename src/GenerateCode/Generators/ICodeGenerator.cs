namespace GenerateCode.Generators;

public interface ICodeGenerator
{
    string FileName { get; }
    string Generate();
}
