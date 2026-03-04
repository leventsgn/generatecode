// .NET Code Generation Engine

const CodeGen = {
  generateAll(config) {
    const files = {};
    const standard = this.normalizeStandard(config.standardProfile);

    const ns = config.rootNamespace || standard.rootNamespace || 'MyApi';
    const fw = config.targetFramework || standard.targetFramework || 'net8.0';
    const dbProvider = config.targetDbProvider || standard.dbProvider || 'InMemory';
    const useServiceInterfaces = standard.useServiceInterfaces;
    const controllerPlural = standard.controllerPlural;
    const routeCase = standard.routeCase;
    const routePrefix = standard.routePrefix;

    // Models
    config.tables.forEach(table => {
      files[`Models/${table.name}.cs`] = this.generateModel(table, ns);
    });

    // DTOs
    config.dtos.forEach(dto => {
      const folder = dto.type === 'request' ? 'DTOs/Requests' : 'DTOs/Responses';
      files[`${folder}/${dto.name}.cs`] = this.generateDto(dto, ns);
    });

    // Services
    config.tables.filter(table => table.generateCrud).forEach(table => {
      if (useServiceInterfaces) {
        files[`Services/I${table.name}Service.cs`] = this.generateServiceInterface(table, ns);
      }
      files[`Services/${table.name}Service.cs`] = this.generateService(table, ns, useServiceInterfaces);
    });

    // Controllers
    config.tables.filter(table => table.generateCrud).forEach(table => {
      const controllerClassName = this.buildControllerClassName(table.name, controllerPlural);
      files[`Controllers/${controllerClassName}.cs`] = this.generateController(table, ns, config.dtos, {
        useServiceInterfaces,
        controllerPlural,
        routeCase,
        routePrefix
      });
    });

    // DbContext
    files['Data/AppDbContext.cs'] = this.generateDbContext(config.tables, ns);

    // Program.cs
    files['Program.cs'] = this.generateProgramCs(config.tables, ns, dbProvider, config, useServiceInterfaces);

    // .csproj
    files[`${config.projectName}.csproj`] = this.generateCsproj(fw, dbProvider, config);

    // appsettings.json
    files['appsettings.json'] = this.generateAppSettings(dbProvider);

    return files;
  },

  normalizeStandard(profile) {
    return {
      targetFramework: '',
      rootNamespace: '',
      dbProvider: '',
      useServiceInterfaces: true,
      controllerPlural: true,
      routeCase: 'kebab',
      routePrefix: 'api',
      ...(profile || {})
    };
  },

  generateModel(table, ns) {
    let code = `using System.ComponentModel.DataAnnotations;\n`;
    code += `using System.ComponentModel.DataAnnotations.Schema;\n\n`;
    code += `namespace ${ns}.Models;\n\n`;
    code += `public class ${table.name}\n{\n`;

    table.columns.forEach(column => {
      const attrs = [];
      if (column.isPrimaryKey) attrs.push('    [Key]');
      if (column.isRequired && column.type === 'string') attrs.push('    [Required]');
      if (column.maxLength) attrs.push(`    [MaxLength(${column.maxLength})]`);

      if (attrs.length > 0) code += attrs.join('\n') + '\n';

      const nullable = (!column.isRequired && !column.isPrimaryKey && column.type !== 'string') ? '?' : '';
      const nullStr = (column.type === 'string' && !column.isRequired) ? '?' : '';
      code += `    public ${column.type}${nullable}${nullStr} ${column.name} { get; set; }`;

      if (column.type === 'string' && column.isRequired) {
        code += ' = string.Empty;';
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

      if (field.type === 'string' && field.isRequired) {
        code += ' = string.Empty;';
      }
      code += '\n\n';
    });

    code = code.trimEnd() + '\n}\n';
    return code;
  },

  generateServiceInterface(table, ns) {
    const pk = table.columns.find(column => column.isPrimaryKey);
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

  generateService(table, ns, useInterface = true) {
    const pk = table.columns.find(column => column.isPrimaryKey);
    const keyType = pk ? pk.type : 'int';
    const keyName = pk ? pk.name : 'Id';
    const camelKey = this.toCamelCase(keyName);

    let code = `using Microsoft.EntityFrameworkCore;\n`;
    code += `using ${ns}.Data;\n`;
    code += `using ${ns}.Models;\n\n`;
    code += `namespace ${ns}.Services;\n\n`;
    code += `public class ${table.name}Service${useInterface ? ` : I${table.name}Service` : ''}\n{\n`;
    code += `    private readonly AppDbContext _context;\n\n`;
    code += `    public ${table.name}Service(AppDbContext context)\n    {\n`;
    code += `        _context = context;\n`;
    code += `    }\n\n`;

    code += `    public async Task<IEnumerable<${table.name}>> GetAllAsync()\n    {\n`;
    code += `        return await _context.${table.name}s.ToListAsync();\n`;
    code += `    }\n\n`;

    code += `    public async Task<${table.name}?> GetByIdAsync(${keyType} ${camelKey})\n    {\n`;
    code += `        return await _context.${table.name}s.FindAsync(${camelKey});\n`;
    code += `    }\n\n`;

    code += `    public async Task<${table.name}> CreateAsync(${table.name} entity)\n    {\n`;
    code += `        _context.${table.name}s.Add(entity);\n`;
    code += `        await _context.SaveChangesAsync();\n`;
    code += `        return entity;\n`;
    code += `    }\n\n`;

    code += `    public async Task<${table.name}?> UpdateAsync(${keyType} ${camelKey}, ${table.name} entity)\n    {\n`;
    code += `        var existing = await _context.${table.name}s.FindAsync(${camelKey});\n`;
    code += `        if (existing == null) return null;\n\n`;
    table.columns.filter(column => !column.isPrimaryKey).forEach(column => {
      code += `        existing.${column.name} = entity.${column.name};\n`;
    });
    code += `\n        await _context.SaveChangesAsync();\n`;
    code += `        return existing;\n`;
    code += `    }\n\n`;

    code += `    public async Task<bool> DeleteAsync(${keyType} ${camelKey})\n    {\n`;
    code += `        var entity = await _context.${table.name}s.FindAsync(${camelKey});\n`;
    code += `        if (entity == null) return false;\n\n`;
    code += `        _context.${table.name}s.Remove(entity);\n`;
    code += `        await _context.SaveChangesAsync();\n`;
    code += `        return true;\n`;
    code += `    }\n`;
    code += `}\n`;

    return code;
  },

  generateController(table, ns, dtos, options = {}) {
    const merged = {
      useServiceInterfaces: true,
      controllerPlural: true,
      routeCase: 'kebab',
      routePrefix: 'api',
      ...options
    };

    const pk = table.columns.find(column => column.isPrimaryKey);
    const keyType = pk ? pk.type : 'int';
    const keyName = pk ? pk.name : 'Id';
    const camelKey = this.toCamelCase(keyName);
    const controllerClassName = this.buildControllerClassName(table.name, merged.controllerPlural);
    const serviceType = merged.useServiceInterfaces ? `I${table.name}Service` : `${table.name}Service`;
    const serviceField = `_${this.toCamelCase(table.name)}Service`;
    const routeSegment = this.buildRouteSegment(table.name, merged.routeCase, merged.controllerPlural);
    const route = `${merged.routePrefix}/${routeSegment}`.replace(/\/+/g, '/');

    // Match DTOs if available
    const createDto = dtos.find(dto => dto.type === 'request' && dto.name.toLowerCase().includes(`create${table.name.toLowerCase()}`));
    const responseDto = dtos.find(dto => dto.type === 'response' && dto.name.toLowerCase().includes(table.name.toLowerCase()));

    let usings = `using Microsoft.AspNetCore.Mvc;\n`;
    usings += `using ${ns}.Models;\n`;
    usings += `using ${ns}.Services;\n`;
    if (createDto) usings += `using ${ns}.DTOs.Requests;\n`;
    if (responseDto) usings += `using ${ns}.DTOs.Responses;\n`;

    let code = usings;
    code += `\nnamespace ${ns}.Controllers;\n\n`;
    code += `[ApiController]\n`;
    code += `[Route("${route}")]\n`;
    code += `public class ${controllerClassName} : ControllerBase\n{\n`;
    code += `    private readonly ${serviceType} ${serviceField};\n\n`;
    code += `    public ${controllerClassName}(${serviceType} ${serviceField.substring(1)})\n    {\n`;
    code += `        ${serviceField} = ${serviceField.substring(1)};\n`;
    code += `    }\n\n`;

    code += `    [HttpGet]\n`;
    code += `    public async Task<ActionResult<IEnumerable<${table.name}>>> GetAll()\n    {\n`;
    code += `        var items = await ${serviceField}.GetAllAsync();\n`;
    code += `        return Ok(items);\n`;
    code += `    }\n\n`;

    code += `    [HttpGet("{${camelKey}}")]\n`;
    code += `    public async Task<ActionResult<${table.name}>> GetById(${keyType} ${camelKey})\n    {\n`;
    code += `        var item = await ${serviceField}.GetByIdAsync(${camelKey});\n`;
    code += `        if (item == null) return NotFound();\n`;
    code += `        return Ok(item);\n`;
    code += `    }\n\n`;

    code += `    [HttpPost]\n`;
    code += `    public async Task<ActionResult<${table.name}>> Create([FromBody] ${table.name} entity)\n    {\n`;
    code += `        var created = await ${serviceField}.CreateAsync(entity);\n`;
    code += `        return CreatedAtAction(nameof(GetById), new { ${camelKey} = created.${keyName} }, created);\n`;
    code += `    }\n\n`;

    code += `    [HttpPut("{${camelKey}}")]\n`;
    code += `    public async Task<ActionResult<${table.name}>> Update(${keyType} ${camelKey}, [FromBody] ${table.name} entity)\n    {\n`;
    code += `        var updated = await ${serviceField}.UpdateAsync(${camelKey}, entity);\n`;
    code += `        if (updated == null) return NotFound();\n`;
    code += `        return Ok(updated);\n`;
    code += `    }\n\n`;

    code += `    [HttpDelete("{${camelKey}}")]\n`;
    code += `    public async Task<IActionResult> Delete(${keyType} ${camelKey})\n    {\n`;
    code += `        var deleted = await ${serviceField}.DeleteAsync(${camelKey});\n`;
    code += `        if (!deleted) return NotFound();\n`;
    code += `        return NoContent();\n`;
    code += `    }\n`;
    code += `}\n`;

    return code;
  },

  generateDbContext(tables, ns) {
    let code = `using Microsoft.EntityFrameworkCore;\n`;
    code += `using ${ns}.Models;\n\n`;
    code += `namespace ${ns}.Data;\n\n`;
    code += `public class AppDbContext : DbContext\n{\n`;
    code += `    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }\n\n`;

    tables.forEach(table => {
      code += `    public DbSet<${table.name}> ${table.name}s { get; set; }\n`;
    });

    code += `\n    protected override void OnModelCreating(ModelBuilder modelBuilder)\n    {\n`;
    code += `        base.OnModelCreating(modelBuilder);\n`;

    tables.forEach(table => {
      const pk = table.columns.find(column => column.isPrimaryKey);
      if (pk) {
        code += `\n        modelBuilder.Entity<${table.name}>(entity =>\n        {\n`;
        code += `            entity.HasKey(e => e.${pk.name});\n`;

        table.columns.filter(column => column.maxLength && column.type === 'string').forEach(column => {
          code += `            entity.Property(e => e.${column.name}).HasMaxLength(${column.maxLength});\n`;
        });

        table.columns.filter(column => column.isRequired && column.type === 'string' && !column.isPrimaryKey).forEach(column => {
          code += `            entity.Property(e => e.${column.name}).IsRequired();\n`;
        });

        code += `        });\n`;
      }
    });

    code += `    }\n}\n`;
    return code;
  },

  generateProgramCs(tables, ns, dbProvider, config, useServiceInterfaces = true) {
    let code = `using Microsoft.EntityFrameworkCore;\n`;
    code += `using ${ns}.Data;\n`;
    code += `using ${ns}.Services;\n\n`;
    code += `var builder = WebApplication.CreateBuilder(args);\n\n`;
    code += `builder.Services.AddControllers();\n`;

    if (config.optSwagger) {
      code += `builder.Services.AddEndpointsApiExplorer();\n`;
      code += `builder.Services.AddSwaggerGen();\n\n`;
    }

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

    tables.filter(table => table.generateCrud).forEach(table => {
      if (useServiceInterfaces) {
        code += `builder.Services.AddScoped<I${table.name}Service, ${table.name}Service>();\n`;
      } else {
        code += `builder.Services.AddScoped<${table.name}Service>();\n`;
      }
    });

    code += `\nvar app = builder.Build();\n\n`;

    if (config.optSwagger) {
      code += `if (app.Environment.IsDevelopment())\n{\n`;
      code += `    app.UseSwagger();\n`;
      code += `    app.UseSwaggerUI();\n`;
      code += `}\n\n`;
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
          Default: 'Information',
          'Microsoft.AspNetCore': 'Warning'
        }
      },
      AllowedHosts: '*'
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

  buildControllerClassName(tableName, plural) {
    return `${plural ? this.pluralize(tableName) : tableName}Controller`;
  },

  buildRouteSegment(tableName, routeCase, plural) {
    const base = plural ? this.pluralize(tableName) : tableName;
    if (routeCase === 'lower') return base.toLowerCase();
    if (routeCase === 'camel') return this.toCamelCase(base);
    return this.toKebabCase(base);
  },

  pluralize(name) {
    if (name.endsWith('s')) return name;
    if (name.endsWith('y') && name.length > 1) {
      return `${name.slice(0, -1)}ies`;
    }
    return `${name}s`;
  },

  toCamelCase(str) {
    return str.charAt(0).toLowerCase() + str.slice(1);
  },

  toKebabCase(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }
};
