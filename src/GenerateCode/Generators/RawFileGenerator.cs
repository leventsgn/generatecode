namespace GenerateCode.Generators;

public class RawFileGenerator : ICodeGenerator
{
    private readonly string _content;

    public RawFileGenerator(string fileName, string content)
    {
        FileName = fileName;
        _content = content;
    }

    public string FileName { get; }

    public string Generate()
    {
        return _content;
    }
}
