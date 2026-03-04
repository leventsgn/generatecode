// .NET Code Generation Engine

const CodeGen = {

  generateAll(config) {
    const files = {};
    const ns = config.rootNamespace || 'MyApi';
    const fw = config.targetFramework || 'net8.0';
    const dbProvider = config.targetDbProvider || 'InMemory';

    // Models
    config.tables.forEach(t => {
      files[`Models/${t.name}.cs`] = this.generateModel(t, ns);
    });

    // DTOs
    config.dtos.forEach(d => {
      const folder = d.type === 'request' ? 'DTOs/Requests' : 'DTOs/Responses';
      files[`${folder}/${d.name}.cs`] = this.generateDto(d, ns);
    });

    // Services
    config.tables.filter(t => t.generateCrud).forEach(t => {
      files[`Services/I${t.name}Service.cs`] = this.generateServiceInterface(t, ns);
      files[`Services/${t.name}Service.cs`] = this.generateService(t, ns);
    });

    // Controllers
    config.tables.filter(t => t.generateCrud).forEach(t => {
      files[`Controllers/${t.name}sController.cs`] = this.generateController(t, ns, config.dtos);
    });

    // DbContext
    files['Data/AppDbContext.cs'] = this.generateDbContext(config.tables, ns);

    // Program.cs
    files['Program.cs'] = this.generateProgramCs(config.tables, ns, dbProvider, config);

    // .csproj
    files[`${config.projectName}.csproj`] = this.generateCsproj(fw, dbProvider, config);

    // appsettings.json
    files['appsettings.json'] = this.generateAppSettings(dbProvider);

    return files;
  },

  generateModel(table, ns) {
    let code = `using System.ComponentModel.DataAnnotations;\n`;
    code += `using System.ComponentModel.DataAnnotations.Schema;\n\n`;
    code += `namespace ${ns}.Models;\n\n`;
    code += `public class ${table.name}\n{\n`;

    table.columns.forEach(col => {
      const attrs = [];
      if (col.isPrimaryKey) attrs.push('    [Key]');
      if (col.isRequired && col.type === 'string') attrs.push('    [Required]');
      if (col.maxLength) attrs.push(`    [MaxLength(${col.maxLength})]`);

      if (attrs.length > 0) code += attrs.join('\n') + '\n';

      const nullable = (!col.isRequired && !col.isPrimaryKey && col.type !== 'string') ? '?' : '';
      const nullStr = (col.type === 'string' && !col.isRequired) ? '?' : '';
      code += `    public ${col.type}${nullable}${nullStr} ${col.name} { get; set; }`;

      if (col.type === 'string') {
        code += col.isRequired ? ' = string.Empty;' : '';
      }
      code += '\n\n';
    });

    code = code.trimEnd() + '\n}\n';
    return code;
  },

  generateDto(dto, ns) {
    const folder = dto.type === 'request' ? 'DTOs.Requests' : 'DTOs.Responses';
    let code = `using System.ComponentModel.DataAnnotations;\n\n`;
    code += `namespace ${ns}.${folder};\n\n`;
    code += `public class ${dto.name}\n{\n`;

    dto.fields.forEach(field => {
      const attrs = [];
      if (field.isRequired && field.type === 'string') attrs.push('    [Required]');
      if (field.maxLength) attrs.push(`    [MaxLength(${field.maxLength})]`);

      if (attrs.length > 0) code += attrs.join('\n') + '\n';

      const nullable = (!field.isRequired && field.type !== 'string') ? '?' : '';
      const nullStr = (field.type === 'string' && !field.isRequired) ? '?' : '';
      code += `    public ${field.type}${nullable}${nullStr} ${field.name} { get; set; }`;
      if (field.type === 'string' && field.isRequired) code += ' = string.Empty;';
      code += '\n\n';
    });

    code = code.trimEnd() + '\n}\n';
    return code;
  },

  generateServiceInterface(table, ns) {
    const pk = table.columns.find(c => c.isPrimaryKey);
    const keyType = pk ? pk.type : 'int';
    const keyName = pk ? pk.name : 'Id';

    let code = `using ${ns}.Models;\n\n`;
    code += `namespace ${ns}.Services;\n\n`;
    code += `public interface I${table.name}Service\n{\n`;
    code += `    Task<IEnumerable<${table.name}>> GetAllAsync();\n`;
    code += `    Task<${table.name}?> GetByIdAsync(${keyType} ${this.toCamelCase(keyName)});\n`;
    code += `    Task<${table.name}> CreateAsync(${table.name} entity);\n`;
    code += `    Task<${table.name}?> UpdateAsync(${keyType} ${this.toCamelCase(keyName)}, ${table.name} entity);\n`;
    code += `    Task<bool> DeleteAsync(${keyType} ${this.toCamelCase(keyName)});\n`;
    code += `}\n`;
    return code;
  },

  generateService(table, ns) {
    const pk = table.columns.find(c => c.isPrimaryKey);
    const keyType = pk ? pk.type : 'int';
    const keyName = pk ? pk.name : 'Id';
    const camelKey = this.toCamelCase(keyName);
    const camelEntity = this.toCamelCase(table.name);

    let code = `using Microsoft.EntityFrameworkCore;\n`;
    code += `using ${ns}.Data;\n`;
    code += `using ${ns}.Models;\n\n`;
    code += `namespace ${ns}.Services;\n\n`;
    code += `public class ${table.name}Service : I${table.name}Service\n{\n`;
    code += `    private readonly AppDbContext _context;\n\n`;
    code += `    public ${table.name}Service(AppDbContext context)\n    {\n`;
    code += `        _context = context;\n    }\n\n`;

    // GetAll
    code += `    public async Task<IEnumerable<${table.name}>> GetAllAsync()\n    {\n`;
    code += `        return await _context.${table.name}s.ToListAsync();\n    }\n\n`;

    // GetById
    code += `    public async Task<${table.name}?> GetByIdAsync(${keyType} ${camelKey})\n    {\n`;
    code += `        return await _context.${table.name}s.FindAsync(${camelKey});\n    }\n\n`;

    // Create
    code += `    public async Task<${table.name}> CreateAsync(${table.name} entity)\n    {\n`;
    code += `        _context.${table.name}s.Add(entity);\n`;
    code += `        await _context.SaveChangesAsync();\n`;
    code += `        return entity;\n    }\n\n`;

    // Update
    code += `    public async Task<${table.name}?> UpdateAsync(${keyType} ${camelKey}, ${table.name} entity)\n    {\n`;
    code += `        var existing = await _context.${table.name}s.FindAsync(${camelKey});\n`;
    code += `        if (existing == null) return null;\n\n`;
    table.columns.filter(c => !c.isPrimaryKey).forEach(col => {
      code += `        existing.${col.name} = entity.${col.name};\n`;
    });
    code += `\n        await _context.SaveChangesAsync();\n`;
    code += `        return existing;\n    }\n\n`;

    // Delete
    code += `    public async Task<bool> DeleteAsync(${keyType} ${camelKey})\n    {\n`;
    code += `        var entity = await _context.${table.name}s.FindAsync(${camelKey});\n`;
    code += `        if (entity == null) return false;\n\n`;
    code += `        _context.${table.name}s.Remove(entity);\n`;
    code += `        await _context.SaveChangesAsync();\n`;
    code += `        return true;\n    }\n}\n`;

    return code;
  },

  generateController(table, ns, dtos) {
    const pk = table.columns.find(c => c.isPrimaryKey);
    const keyType = pk ? pk.type : 'int';
    const keyName = pk ? pk.name : 'Id';
    const camelKey = this.toCamelCase(keyName);
    const camelService = `_${this.toCamelCase(table.name)}Service`;
    const route = this.toKebabCase(table.name) + 's';

    // Find matching DTOs
    const createDto = dtos.find(d => d.type === 'request' && d.name.toLowerCase().includes(`create${table.name.toLowerCase()}`));
    const responseDto = dtos.find(d => d.type === 'response' && d.name.toLowerCase().includes(table.name.toLowerCase()));

    let usings = `using Microsoft.AspNetCore.Mvc;\n`;
    usings += `using ${ns}.Models;\n`;
    usings += `using ${ns}.Services;\n`;
    if (createDto) usings += `using ${ns}.DTOs.Requests;\n`;
    if (responseDto) usings += `using ${ns}.DTOs.Responses;\n`;

    let code = usings;
    code += `\nnamespace ${ns}.Controllers;\n\n`;
    code += `[ApiController]\n`;
    code += `[Route("api/${route}")]\n`;
    code += `public class ${table.name}sController : ControllerBase\n{\n`;
    code += `    private readonly I${table.name}Service ${camelService};\n\n`;
    code += `    public ${table.name}sController(I${table.name}Service ${camelService.substring(1)})\n    {\n`;
    code += `        ${camelService} = ${camelService.substring(1)};\n    }\n\n`;

    // GET all
    code += `    [HttpGet]\n`;
    code += `    public async Task<ActionResult<IEnumerable<${table.name}>>> GetAll()\n    {\n`;
    code += `        var items = await ${camelService}.GetAllAsync();\n`;
    code += `        return Ok(items);\n    }\n\n`;

    // GET by id
    code += `    [HttpGet("{${camelKey}")]\n`;
    code += `    public async Task<ActionResult<${table.name}>> GetById(${keyType} ${camelKey})\n    {\n`;
    code += `        var item = await ${camelService}.GetByIdAsync(${camelKey});\n`;
    code += `        if (item == null) return NotFound();\n`;
    code += `        return Ok(item);\n    }\n\n`;

    // POST
    code += `    [HttpPost]\n`;
    code += `    public async Task<ActionResult<${table.name}>> Create([FromBody] ${table.name} entity)\n    {\n`;
    code += `        var created = await ${camelService}.CreateAsync(entity);\n`;
    code += `        return CreatedAtAction(nameof(GetById), new { ${camelKey} = created.${keyName} }, created);\n    }\n\n`;

    // PUT
    code += `    [HttpPut("{${camelKey}")]\n`;
    code += `    public async Task<ActionResult<${table.name}>> Update(${keyType} ${camelKey}, [FromBody] ${table.name} entity)\n    {\n`;
    code += `        var updated = await ${camelService}.UpdateAsync(${camelKey}, entity);\n`;
    code += `        if (updated == null) return NotFound();\n`;
    code += `        return Ok(updated);\n    }\n\n`;

    // DELETE
    code += `    [HttpDelete("{${camelKey}")]\n`;
    code += `    public async Task<IActionResult> Delete(${keyType} ${camelKey})\n    {\n`;
    code += `        var deleted = await ${camelService}.DeleteAsync(${camelKey});\n`;
    code += `        if (!deleted) return NotFound();\n`;
    code += `        return NoContent();\n    }\n}\n`;

    return code;
  },

  generateDbContext(tables, ns) {
    let code = `using Microsoft.EntityFrameworkCore;\n`;
    code += `using ${ns}.Models;\n\n`;
    code += `namespace ${ns}.Data;\n\n`;
    code += `public class AppDbContext : DbContext\n{\n`;
    code += `    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }\n\n`;

    tables.forEach(t => {
      code += `    public DbSet<${t.name}> ${t.name}s { get; set; }\n`;
    });

    code += `\n    protected override void OnModelCreating(ModelBuilder modelBuilder)\n    {\n`;
    code += `        base.OnModelCreating(modelBuilder);\n`;

    tables.forEach(t => {
      const pk = t.columns.find(c => c.isPrimaryKey);
      if (pk) {
        code += `\n        modelBuilder.Entity<${t.name}>(entity =>\n        {\n`;
        code += `            entity.HasKey(e => e.${pk.name});\n`;

        t.columns.filter(c => c.maxLength && c.type === 'string').forEach(col => {
          code += `            entity.Property(e => e.${col.name}).HasMaxLength(${col.maxLength});\n`;
        });

        t.columns.filter(c => c.isRequired && c.type === 'string' && !c.isPrimaryKey).forEach(col => {
          code += `            entity.Property(e => e.${col.name}).IsRequired();\n`;
        });

        code += `        });\n`;
      }
    });

    code += `    }\n}\n`;
    return code;
  },

  generateProgramCs(tables, ns, dbProvider, config) {
    let code = `using Microsoft.EntityFrameworkCore;\n`;
    code += `using ${ns}.Data;\n`;
    code += `using ${ns}.Services;\n\n`;
    code += `var builder = WebApplication.CreateBuilder(args);\n\n`;
    code += `// Add services\n`;
    code += `builder.Services.AddControllers();\n`;

    if (config.optSwagger) {
      code += `builder.Services.AddEndpointsApiExplorer();\n`;
      code += `builder.Services.AddSwaggerGen();\n\n`;
    }

    // DB
    code += `// Database\n`;
    if (dbProvider === 'InMemory') {
      code += `builder.Services.AddDbContext<AppDbContext>(options =>\n`;
      code += `    options.UseInMemoryDatabase("${ns}Db"));\n\n`;
    } else if (dbProvider === 'SqlServer') {
      code += `builder.Services.AddDbContext<AppDbContext>(options =>\n`;
      code += `    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));\n\n`;
    } else if (dbProvider === 'PostgreSQL') {
      code += `builder.Services.AddDbContext<AppDbContext>(options =>\n`;
      code += `    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));\n\n`;
    } else if (dbProvider === 'MySQL') {
      code += `builder.Services.AddDbContext<AppDbContext>(options =>\n`;
      code += `    options.UseMySql(builder.Configuration.GetConnectionString("DefaultConnection"),\n`;
      code += `        ServerVersion.AutoDetect(builder.Configuration.GetConnectionString("DefaultConnection"))));\n\n`;
    }

    // DI
    code += `// Dependency Injection\n`;
    tables.filter(t => t.generateCrud).forEach(t => {
      code += `builder.Services.AddScoped<I${t.name}Service, ${t.name}Service>();\n`;
    });

    code += `\nvar app = builder.Build();\n\n`;

    if (config.optSwagger) {
      code += `// Swagger\n`;
      code += `if (app.Environment.IsDevelopment())\n{\n`;
      code += `    app.UseSwagger();\n`;
      code += `    app.UseSwaggerUI();\n}\n\n`;
    }

    code += `app.UseHttpsRedirection();\n`;
    code += `app.UseAuthorization();\n`;
    code += `app.MapControllers();\n\n`;
    code += `app.Run();\n`;

    return code;
  },

  generateCsproj(fw, dbProvider, config) {
    let code = `<Project Sdk="Microsoft.NET.Sdk.Web">\n\n`;
    code += `  <PropertyGroup>\n`;
    code += `    <TargetFramework>${fw}</TargetFramework>\n`;
    code += `    <Nullable>enable</Nullable>\n`;
    code += `    <ImplicitUsings>enable</ImplicitUsings>\n`;
    code += `  </PropertyGroup>\n\n`;
    code += `  <ItemGroup>\n`;

    if (dbProvider === 'InMemory') {
      code += `    <PackageReference Include="Microsoft.EntityFrameworkCore.InMemory" Version="8.0.0" />\n`;
    } else if (dbProvider === 'SqlServer') {
      code += `    <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="8.0.0" />\n`;
    } else if (dbProvider === 'PostgreSQL') {
      code += `    <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="8.0.0" />\n`;
    } else if (dbProvider === 'MySQL') {
      code += `    <PackageReference Include="Pomelo.EntityFrameworkCore.MySql" Version="8.0.0" />\n`;
    }

    code += `    <PackageReference Include="Microsoft.EntityFrameworkCore" Version="8.0.0" />\n`;

    if (config.optSwagger) {
      code += `    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.0" />\n`;
    }
    if (config.optFluentValidation) {
      code += `    <PackageReference Include="FluentValidation.AspNetCore" Version="11.3.0" />\n`;
    }
    if (config.optAutoMapper) {
      code += `    <PackageReference Include="AutoMapper" Version="12.0.1" />\n`;
    }

    code += `  </ItemGroup>\n\n</Project>\n`;
    return code;
  },

  generateAppSettings(dbProvider) {
    const settings = {
      Logging: {
        LogLevel: {
          Default: "Information",
          "Microsoft.AspNetCore": "Warning"
        }
      },
      AllowedHosts: "*"
    };

    if (dbProvider !== 'InMemory') {
      settings.ConnectionStrings = {
        DefaultConnection: dbProvider === 'SqlServer'
          ? 'Server=localhost;Database=MyDb;Trusted_Connection=true;TrustServerCertificate=true;'
          : dbProvider === 'PostgreSQL'
            ? 'Host=localhost;Database=MyDb;Username=postgres;Password=yourpassword'
            : 'Server=localhost;Database=MyDb;User=root;Password=yourpassword;'
      };
    }

    return JSON.stringify(settings, null, 2) + '\n';
  },

  // Helpers
  toCamelCase(str) {
    return str.charAt(0).toLowerCase() + str.slice(1);
  },

  toKebabCase(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }
};
