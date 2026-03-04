using System.Text;
using GenerateCode.Models;

namespace GenerateCode.Generators;

public class ServiceGenerator : ICodeGenerator
{
    private readonly EntityDefinition _entity;
    private readonly string _namespace;

    public ServiceGenerator(EntityDefinition entity, string rootNamespace)
    {
        _entity = entity;
        _namespace = rootNamespace;
    }

    public string FileName => $"Services/{_entity.Name}Service.cs";

    public string Generate()
    {
        var entityName = _entity.Name;
        var keyProp = _entity.Properties.FirstOrDefault(p => p.IsKey);
        var keyType = keyProp?.Type ?? "int";
        var keyName = keyProp?.Name ?? "Id";

        var sb = new StringBuilder();
        sb.AppendLine("using Microsoft.EntityFrameworkCore;");
        sb.AppendLine($"using {_namespace}.Data;");
        sb.AppendLine($"using {_namespace}.Models;");
        sb.AppendLine();
        sb.AppendLine($"namespace {_namespace}.Services;");
        sb.AppendLine();
        sb.AppendLine($"public class {entityName}Service");
        sb.AppendLine("{");
        sb.AppendLine("    private readonly AppDbContext _context;");
        sb.AppendLine();
        sb.AppendLine($"    public {entityName}Service(AppDbContext context)");
        sb.AppendLine("    {");
        sb.AppendLine("        _context = context;");
        sb.AppendLine("    }");
        sb.AppendLine();

        // GetAll
        sb.AppendLine($"    public async Task<List<{entityName}>> GetAllAsync()");
        sb.AppendLine("    {");
        sb.AppendLine($"        return await _context.{entityName}s.ToListAsync();");
        sb.AppendLine("    }");
        sb.AppendLine();

        // GetById
        sb.AppendLine($"    public async Task<{entityName}?> GetByIdAsync({keyType} {ToCamelCase(keyName)})");
        sb.AppendLine("    {");
        sb.AppendLine($"        return await _context.{entityName}s.FindAsync({ToCamelCase(keyName)});");
        sb.AppendLine("    }");
        sb.AppendLine();

        // Create
        sb.AppendLine($"    public async Task<{entityName}> CreateAsync({entityName} entity)");
        sb.AppendLine("    {");
        sb.AppendLine($"        _context.{entityName}s.Add(entity);");
        sb.AppendLine("        await _context.SaveChangesAsync();");
        sb.AppendLine("        return entity;");
        sb.AppendLine("    }");
        sb.AppendLine();

        // Update
        sb.AppendLine($"    public async Task<{entityName}?> UpdateAsync({keyType} {ToCamelCase(keyName)}, {entityName} entity)");
        sb.AppendLine("    {");
        sb.AppendLine($"        var existing = await _context.{entityName}s.FindAsync({ToCamelCase(keyName)});");
        sb.AppendLine("        if (existing == null) return null;");
        sb.AppendLine();
        sb.AppendLine($"        _context.Entry(existing).CurrentValues.SetValues(entity);");
        sb.AppendLine("        await _context.SaveChangesAsync();");
        sb.AppendLine("        return existing;");
        sb.AppendLine("    }");
        sb.AppendLine();

        // Delete
        sb.AppendLine($"    public async Task<bool> DeleteAsync({keyType} {ToCamelCase(keyName)})");
        sb.AppendLine("    {");
        sb.AppendLine($"        var entity = await _context.{entityName}s.FindAsync({ToCamelCase(keyName)});");
        sb.AppendLine("        if (entity == null) return false;");
        sb.AppendLine();
        sb.AppendLine($"        _context.{entityName}s.Remove(entity);");
        sb.AppendLine("        await _context.SaveChangesAsync();");
        sb.AppendLine("        return true;");
        sb.AppendLine("    }");

        sb.AppendLine("}");
        return sb.ToString();
    }

    private static string ToCamelCase(string name)
    {
        if (string.IsNullOrEmpty(name)) return name;
        return char.ToLowerInvariant(name[0]) + name[1..];
    }
}
