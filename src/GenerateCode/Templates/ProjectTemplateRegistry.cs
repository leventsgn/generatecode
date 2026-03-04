namespace GenerateCode.Templates;

public static class ProjectTemplateRegistry
{
    private static readonly Dictionary<string, Func<IProjectTemplate>> Templates =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["webapi"] = () => new WebApiTemplate(),
            ["worker"] = () => new WorkerTemplate(),
            ["console"] = () => new ConsoleTemplate(),
            ["library"] = () => new ClassLibraryTemplate()
        };

    public static bool TryResolve(string templateName, out IProjectTemplate template)
    {
        if (Templates.TryGetValue(templateName, out var factory))
        {
            template = factory();
            return true;
        }

        template = null!;
        return false;
    }

    public static IReadOnlyList<string> AvailableTemplates()
    {
        return Templates.Keys.OrderBy(name => name).ToList();
    }
}
