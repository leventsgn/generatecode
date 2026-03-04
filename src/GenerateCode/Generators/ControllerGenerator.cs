using System.Text;
using GenerateCode.Models;

namespace GenerateCode.Generators;

public class ControllerGenerator : ICodeGenerator
{
    private readonly ControllerDefinition _controller;
    private readonly EntityDefinition? _entity;
    private readonly string _namespace;

    public ControllerGenerator(ControllerDefinition controller, EntityDefinition? entity, string rootNamespace)
    {
        _controller = controller;
        _entity = entity;
        _namespace = rootNamespace;
    }

    public string FileName => $"Controllers/{_controller.Name}Controller.cs";

    public string Generate()
    {
        if (_entity != null && _controller.Endpoints.Count == 0)
            return GenerateCrudController();

        return GenerateCustomController();
    }

    private string GenerateCrudController()
    {
        var entityName = _entity!.Name;
        var keyProp = _entity.Properties.FirstOrDefault(p => p.IsKey);
        var keyType = keyProp?.Type ?? "int";
        var keyName = keyProp?.Name ?? "Id";
        var route = string.IsNullOrEmpty(_controller.Route)
            ? $"api/{entityName.ToLowerInvariant()}s"
            : _controller.Route;

        var sb = new StringBuilder();
        sb.AppendLine("using Microsoft.AspNetCore.Mvc;");
        sb.AppendLine($"using {_namespace}.Models;");
        sb.AppendLine($"using {_namespace}.Services;");
        sb.AppendLine();
        sb.AppendLine($"namespace {_namespace}.Controllers;");
        sb.AppendLine();
        sb.AppendLine("[ApiController]");
        sb.AppendLine($"[Route(\"{route}\")]");
        sb.AppendLine($"public class {_controller.Name}Controller : ControllerBase");
        sb.AppendLine("{");
        sb.AppendLine($"    private readonly {entityName}Service _service;");
        sb.AppendLine();
        sb.AppendLine($"    public {_controller.Name}Controller({entityName}Service service)");
        sb.AppendLine("    {");
        sb.AppendLine("        _service = service;");
        sb.AppendLine("    }");
        sb.AppendLine();

        // GET all
        sb.AppendLine("    [HttpGet]");
        sb.AppendLine($"    public async Task<ActionResult<List<{entityName}>>> GetAll()");
        sb.AppendLine("    {");
        sb.AppendLine("        return Ok(await _service.GetAllAsync());");
        sb.AppendLine("    }");
        sb.AppendLine();

        // GET by id
        sb.AppendLine($"    [HttpGet(\"{{{ToCamelCase(keyName)}}}\")]");
        sb.AppendLine($"    public async Task<ActionResult<{entityName}>> GetById({keyType} {ToCamelCase(keyName)})");
        sb.AppendLine("    {");
        sb.AppendLine($"        var result = await _service.GetByIdAsync({ToCamelCase(keyName)});");
        sb.AppendLine("        if (result == null) return NotFound();");
        sb.AppendLine("        return Ok(result);");
        sb.AppendLine("    }");
        sb.AppendLine();

        // POST
        sb.AppendLine("    [HttpPost]");
        sb.AppendLine($"    public async Task<ActionResult<{entityName}>> Create([FromBody] {entityName} entity)");
        sb.AppendLine("    {");
        sb.AppendLine("        var created = await _service.CreateAsync(entity);");
        sb.AppendLine($"        return CreatedAtAction(nameof(GetById), new {{ {ToCamelCase(keyName)} = created.{keyName} }}, created);");
        sb.AppendLine("    }");
        sb.AppendLine();

        // PUT
        sb.AppendLine($"    [HttpPut(\"{{{ToCamelCase(keyName)}}}\")]");
        sb.AppendLine($"    public async Task<ActionResult<{entityName}>> Update({keyType} {ToCamelCase(keyName)}, [FromBody] {entityName} entity)");
        sb.AppendLine("    {");
        sb.AppendLine($"        var updated = await _service.UpdateAsync({ToCamelCase(keyName)}, entity);");
        sb.AppendLine("        if (updated == null) return NotFound();");
        sb.AppendLine("        return Ok(updated);");
        sb.AppendLine("    }");
        sb.AppendLine();

        // DELETE
        sb.AppendLine($"    [HttpDelete(\"{{{ToCamelCase(keyName)}}}\")]");
        sb.AppendLine($"    public async Task<IActionResult> Delete({keyType} {ToCamelCase(keyName)})");
        sb.AppendLine("    {");
        sb.AppendLine($"        var deleted = await _service.DeleteAsync({ToCamelCase(keyName)});");
        sb.AppendLine("        if (!deleted) return NotFound();");
        sb.AppendLine("        return NoContent();");
        sb.AppendLine("    }");

        sb.AppendLine("}");
        return sb.ToString();
    }

    private string GenerateCustomController()
    {
        var route = string.IsNullOrEmpty(_controller.Route)
            ? $"api/{_controller.Name.ToLowerInvariant()}"
            : _controller.Route;

        var sb = new StringBuilder();
        sb.AppendLine("using Microsoft.AspNetCore.Mvc;");

        if (_entity != null)
        {
            sb.AppendLine($"using {_namespace}.Models;");
            sb.AppendLine($"using {_namespace}.Services;");
        }

        sb.AppendLine();
        sb.AppendLine($"namespace {_namespace}.Controllers;");
        sb.AppendLine();
        sb.AppendLine("[ApiController]");
        sb.AppendLine($"[Route(\"{route}\")]");
        sb.AppendLine($"public class {_controller.Name}Controller : ControllerBase");
        sb.AppendLine("{");

        foreach (var endpoint in _controller.Endpoints)
        {
            var httpAttr = endpoint.HttpMethod.ToUpperInvariant() switch
            {
                "GET" => "HttpGet",
                "POST" => "HttpPost",
                "PUT" => "HttpPut",
                "DELETE" => "HttpDelete",
                "PATCH" => "HttpPatch",
                _ => "HttpGet"
            };

            var routeAttr = string.IsNullOrEmpty(endpoint.Route) ? "" : $"(\"{endpoint.Route}\")";
            var returnType = endpoint.ResponseType ?? "IActionResult";
            var paramStr = endpoint.RequestType != null
                ? $"[FromBody] {endpoint.RequestType} request"
                : "";

            sb.AppendLine($"    [{httpAttr}{routeAttr}]");
            sb.AppendLine($"    public async Task<ActionResult<{returnType}>> {endpoint.MethodName}({paramStr})");
            sb.AppendLine("    {");
            sb.AppendLine("        throw new NotImplementedException();");
            sb.AppendLine("    }");
            sb.AppendLine();
        }

        sb.AppendLine("}");
        return sb.ToString();
    }

    private static string ToCamelCase(string name)
    {
        if (string.IsNullOrEmpty(name)) return name;
        return char.ToLowerInvariant(name[0]) + name[1..];
    }
}
