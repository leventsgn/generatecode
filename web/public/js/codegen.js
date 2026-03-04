// .NET Code Generation Engine

const CodeGen = {
  generateAll(config) {
    const files = {};
    const standard = this.normalizeStandard(config.standardProfile);
    const options = this.normalizeOptions(config);
    const projectType = String(config.projectType || 'webapi').toLowerCase();

    const ns = config.rootNamespace || standard.rootNamespace || config.projectName || 'MyApi';
    const fw = config.targetFramework || standard.targetFramework || 'net8.0';
    const dbProvider = config.targetDbProvider || standard.dbProvider || 'InMemory';
    const useServiceInterfaces = standard.useServiceInterfaces;
    const controllerPlural = standard.controllerPlural;
    const routeCase = standard.routeCase;
    const routePrefix = standard.routePrefix;
    const safeTables = Array.isArray(config.tables) ? config.tables : [];
    const safeDtos = Array.isArray(config.dtos) ? config.dtos : [];

    if (projectType !== 'webapi') {
      return this.generateTemplateProject(projectType, {
        projectName: config.projectName || 'MyProject',
        rootNamespace: ns,
        targetFramework: fw,
        options
      });
    }

    // Models
    safeTables.forEach(table => {
      files[`Models/${table.name}.cs`] = this.generateModel(table, ns);
    });

    // DTOs
    safeDtos.forEach(dto => {
      const folder = dto.type === 'request' ? 'DTOs/Requests' : 'DTOs/Responses';
      files[`${folder}/${dto.name}.cs`] = this.generateDto(dto, ns);
    });

    // Services
    safeTables.filter(table => table.generateCrud).forEach(table => {
      if (useServiceInterfaces) {
        files[`Services/I${table.name}Service.cs`] = this.generateServiceInterface(table, ns, options);
      }
      files[`Services/${table.name}Service.cs`] = this.generateService(table, ns, useServiceInterfaces, options);
    });

    // Controllers
    safeTables.filter(table => table.generateCrud).forEach(table => {
      const controllerClassName = this.buildControllerClassName(table.name, controllerPlural);
      files[`Controllers/${controllerClassName}.cs`] = this.generateController(table, ns, safeDtos, {
        useServiceInterfaces,
        controllerPlural,
        routeCase,
        routePrefix,
        optProductionPack: options.optProductionPack
      });
    });

    if (options.optAuthPack) {
      files['Models/AuthUser.cs'] = this.generateAuthUserModel(ns);
      files['Models/RefreshToken.cs'] = this.generateRefreshTokenModel(ns);
      files['DTOs/Requests/LoginRequest.cs'] = this.generateLoginRequestDto(ns);
      files['DTOs/Requests/RefreshTokenRequest.cs'] = this.generateRefreshTokenRequestDto(ns);
      files['DTOs/Responses/LoginResponse.cs'] = this.generateLoginResponseDto(ns);
      files['Services/IAuthService.cs'] = this.generateAuthServiceInterface(ns);
      files['Services/AuthService.cs'] = this.generateAuthService(ns);
      files['Controllers/AuthController.cs'] = this.generateAuthController(ns);
    }

    if (options.optProductionPack) {
      files['Infrastructure/Pagination/PageRequest.cs'] = this.generatePageRequest(ns);
      files['Infrastructure/Pagination/PagedResult.cs'] = this.generatePagedResult(ns);
      files['Middleware/GlobalExceptionMiddleware.cs'] = this.generateGlobalExceptionMiddleware(ns);
    }

    if (options.optEfMigrations) {
      files['Data/SeedData.cs'] = this.generateSeedData(ns, safeTables, options);
      files['Data/AppDbContextFactory.cs'] = this.generateDbContextFactory(ns, dbProvider);
      files['Migrations/0001_InitialScaffold.cs'] = this.generateInitialMigration(ns);
      files['Migrations/README.md'] = this.generateMigrationReadme();
    }

    // DbContext
    files['Data/AppDbContext.cs'] = this.generateDbContext(safeTables, ns, options);

    // Program.cs
    files['Program.cs'] = this.generateProgramCs(safeTables, ns, dbProvider, config, useServiceInterfaces, options);

    // .csproj
    files[`${config.projectName}.csproj`] = this.generateCsproj(fw, dbProvider, config, options);

    // appsettings.json
    files['appsettings.json'] = this.generateAppSettings(dbProvider, options);

    if (options.optTestGeneration) {
      Object.assign(files, this.generateWebApiTestScaffold({
        projectName: config.projectName || 'MyApi',
        rootNamespace: ns,
        targetFramework: fw,
        tables: safeTables,
        options
      }));
    }

    if (options.optPostmanExport) {
      files[`postman/${config.projectName || 'MyApi'}.postman_collection.json`] = this.generatePostmanCollection({
        projectName: config.projectName || 'MyApi',
        tables: safeTables,
        standard,
        routePrefix,
        routeCase,
        controllerPlural,
        options
      });
    }

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

  normalizeOptions(config) {
    return {
      optSwagger: config.optSwagger !== false,
      optFluentValidation: Boolean(config.optFluentValidation),
      optAutoMapper: Boolean(config.optAutoMapper),
      optAuthPack: Boolean(config.optAuthPack),
      optProductionPack: Boolean(config.optProductionPack),
      optTestGeneration: Boolean(config.optTestGeneration),
      optEfMigrations: Boolean(config.optEfMigrations),
      optPostmanExport: Boolean(config.optPostmanExport)
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

  generateServiceInterface(table, ns, options = {}) {
    const pk = table.columns.find(column => column.isPrimaryKey);
    const keyType = pk ? pk.type : 'int';
    const keyName = pk ? pk.name : 'Id';

    let code = `using ${ns}.Models;\n`;
    if (options.optProductionPack) {
      code += `using ${ns}.Infrastructure.Pagination;\n`;
    }
    code += `\n`;
    code += `namespace ${ns}.Services;\n\n`;
    code += `public interface I${table.name}Service\n{\n`;
    code += `    Task<IEnumerable<${table.name}>> GetAllAsync();\n`;
    if (options.optProductionPack) {
      code += `    Task<PagedResult<${table.name}>> GetPagedAsync(PageRequest request);\n`;
    }
    code += `    Task<${table.name}?> GetByIdAsync(${keyType} ${this.toCamelCase(keyName)});\n`;
    code += `    Task<${table.name}> CreateAsync(${table.name} entity);\n`;
    code += `    Task<${table.name}?> UpdateAsync(${keyType} ${this.toCamelCase(keyName)}, ${table.name} entity);\n`;
    code += `    Task<bool> DeleteAsync(${keyType} ${this.toCamelCase(keyName)});\n`;
    code += `}\n`;
    return code;
  },

  generateService(table, ns, useInterface = true, options = {}) {
    const pk = table.columns.find(column => column.isPrimaryKey);
    const keyType = pk ? pk.type : 'int';
    const keyName = pk ? pk.name : 'Id';
    const camelKey = this.toCamelCase(keyName);

    let code = `using Microsoft.EntityFrameworkCore;\n`;
    code += `using ${ns}.Data;\n`;
    code += `using ${ns}.Models;\n`;
    if (options.optProductionPack) {
      code += `using ${ns}.Infrastructure.Pagination;\n`;
      code += `using System.Reflection;\n`;
    }
    code += `\n`;
    code += `namespace ${ns}.Services;\n\n`;
    code += `public class ${table.name}Service${useInterface ? ` : I${table.name}Service` : ''}\n{\n`;
    code += `    private readonly AppDbContext _context;\n\n`;
    code += `    public ${table.name}Service(AppDbContext context)\n    {\n`;
    code += `        _context = context;\n`;
    code += `    }\n\n`;

    code += `    public async Task<IEnumerable<${table.name}>> GetAllAsync()\n    {\n`;
    code += `        return await _context.${table.name}s.ToListAsync();\n`;
    code += `    }\n\n`;

    if (options.optProductionPack) {
      code += `    public async Task<PagedResult<${table.name}>> GetPagedAsync(PageRequest request)\n    {\n`;
      code += `        var list = await _context.${table.name}s.AsNoTracking().ToListAsync();\n`;
      code += `        IEnumerable<${table.name}> query = list;\n\n`;
      code += `        var textProps = typeof(${table.name}).GetProperties().Where(p => p.PropertyType == typeof(string)).ToArray();\n`;
      code += `        if (!string.IsNullOrWhiteSpace(request.Filter) && textProps.Length > 0)\n        {\n`;
      code += `            query = query.Where(item => textProps.Any(prop =>\n            {\n`;
      code += `                var value = prop.GetValue(item) as string;\n`;
      code += `                return !string.IsNullOrWhiteSpace(value) && value.Contains(request.Filter, StringComparison.OrdinalIgnoreCase);\n`;
      code += `            }));\n`;
      code += `        }\n\n`;
      code += `        if (!string.IsNullOrWhiteSpace(request.SortBy))\n        {\n`;
      code += `            var sortProp = typeof(${table.name}).GetProperty(request.SortBy, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);\n`;
      code += `            if (sortProp != null)\n            {\n`;
      code += `                query = request.Desc\n`;
      code += `                    ? query.OrderByDescending(item => sortProp.GetValue(item, null))\n`;
      code += `                    : query.OrderBy(item => sortProp.GetValue(item, null));\n`;
      code += `            }\n`;
      code += `        }\n\n`;
      code += `        var pageNumber = Math.Max(request.PageNumber, 1);\n`;
      code += `        var pageSize = Math.Clamp(request.PageSize, 1, 200);\n`;
      code += `        var totalCount = query.Count();\n`;
      code += `        var items = query.Skip((pageNumber - 1) * pageSize).Take(pageSize).ToList();\n`;
      code += `        return new PagedResult<${table.name}>(items, totalCount, pageNumber, pageSize);\n`;
      code += `    }\n\n`;
    }

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
      optProductionPack: false,
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
    if (merged.optProductionPack) {
      usings += `using ${ns}.Infrastructure.Pagination;\n`;
    }
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

    if (merged.optProductionPack) {
      code += `    [HttpGet("paged")]\n`;
      code += `    public async Task<ActionResult<PagedResult<${table.name}>>> GetPaged([FromQuery] PageRequest request)\n    {\n`;
      code += `        var result = await ${serviceField}.GetPagedAsync(request);\n`;
      code += `        return Ok(result);\n`;
      code += `    }\n\n`;
    }

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

  generateDbContext(tables, ns, options = {}) {
    let code = `using Microsoft.EntityFrameworkCore;\n`;
    code += `using ${ns}.Models;\n\n`;
    code += `namespace ${ns}.Data;\n\n`;
    code += `public class AppDbContext : DbContext\n{\n`;
    code += `    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }\n\n`;

    tables.forEach(table => {
      code += `    public DbSet<${table.name}> ${table.name}s { get; set; }\n`;
    });

    if (options.optAuthPack) {
      code += `    public DbSet<AuthUser> Users { get; set; }\n`;
      code += `    public DbSet<RefreshToken> RefreshTokens { get; set; }\n`;
    }

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

    if (options.optAuthPack) {
      code += `\n        modelBuilder.Entity<AuthUser>(entity =>\n        {\n`;
      code += `            entity.HasIndex(e => e.Username).IsUnique();\n`;
      code += `            entity.Property(e => e.Username).IsRequired().HasMaxLength(80);\n`;
      code += `            entity.Property(e => e.PasswordHash).IsRequired();\n`;
      code += `            entity.Property(e => e.Role).IsRequired().HasMaxLength(40);\n`;
      code += `        });\n`;

      code += `\n        modelBuilder.Entity<RefreshToken>(entity =>\n        {\n`;
      code += `            entity.HasIndex(e => e.Token).IsUnique();\n`;
      code += `            entity.Property(e => e.Token).IsRequired().HasMaxLength(200);\n`;
      code += `            entity.HasOne(e => e.User)\n`;
      code += `                .WithMany(u => u.RefreshTokens)\n`;
      code += `                .HasForeignKey(e => e.UserId)\n`;
      code += `                .OnDelete(DeleteBehavior.Cascade);\n`;
      code += `        });\n`;
    }

    code += `    }\n}\n`;
    return code;
  },

  generateProgramCs(tables, ns, dbProvider, config, useServiceInterfaces = true, options = {}) {
    let code = `using Microsoft.EntityFrameworkCore;\n`;
    code += `using ${ns}.Data;\n`;
    code += `using ${ns}.Services;\n`;
    if (options.optAuthPack) {
      code += `using Microsoft.AspNetCore.Authentication.JwtBearer;\n`;
      code += `using Microsoft.IdentityModel.Tokens;\n`;
      code += `using System.Text;\n`;
    }
    if (options.optProductionPack) {
      code += `using ${ns}.Middleware;\n`;
    }
    code += `\n`;
    code += `var builder = WebApplication.CreateBuilder(args);\n\n`;
    code += `builder.Services.AddControllers();\n`;
    if (options.optProductionPack) {
      code += `builder.Services.AddProblemDetails();\n`;
    }

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

    if (options.optAuthPack) {
      code += `builder.Services.AddScoped<IAuthService, AuthService>();\n`;
      code += `\n`;
      code += `var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key is missing in appsettings.json");\n`;
      code += `var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));\n`;
      code += `builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)\n`;
      code += `    .AddJwtBearer(jwtOptions =>\n`;
      code += `    {\n`;
      code += `        jwtOptions.TokenValidationParameters = new TokenValidationParameters\n`;
      code += `        {\n`;
      code += `            ValidateIssuer = true,\n`;
      code += `            ValidateAudience = true,\n`;
      code += `            ValidateIssuerSigningKey = true,\n`;
      code += `            ValidateLifetime = true,\n`;
      code += `            ValidIssuer = builder.Configuration["Jwt:Issuer"],\n`;
      code += `            ValidAudience = builder.Configuration["Jwt:Audience"],\n`;
      code += `            IssuerSigningKey = signingKey\n`;
      code += `        };\n`;
      code += `    });\n`;
    }

    code += `builder.Services.AddAuthorization();\n`;

    code += `\nvar app = builder.Build();\n\n`;

    if (options.optProductionPack) {
      code += `app.UseMiddleware<GlobalExceptionMiddleware>();\n\n`;
    }

    if (config.optSwagger) {
      code += `if (app.Environment.IsDevelopment())\n{\n`;
      code += `    app.UseSwagger();\n`;
      code += `    app.UseSwaggerUI();\n`;
      code += `}\n\n`;
    }

    if (options.optEfMigrations) {
      code += `using (var scope = app.Services.CreateScope())\n{\n`;
      code += `    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();\n`;
      if (dbProvider !== 'InMemory') {
        code += `    db.Database.Migrate();\n`;
      }
      code += `    SeedData.Initialize(db);\n`;
      code += `}\n\n`;
    }

    code += `app.UseHttpsRedirection();\n`;
    if (options.optAuthPack) {
      code += `app.UseAuthentication();\n`;
    }
    code += `app.UseAuthorization();\n`;
    code += `app.MapControllers();\n\n`;
    code += `app.Run();\n`;

    if (options.optTestGeneration) {
      code += `\npublic partial class Program { }\n`;
    }

    return code;
  },

  generateCsproj(fw, dbProvider, config, options = {}) {
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
    if (options.optAuthPack) {
      code += `    <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="8.0.0" />\n`;
    }
    if (options.optEfMigrations) {
      code += `    <PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="8.0.0">\n`;
      code += `      <PrivateAssets>all</PrivateAssets>\n`;
      code += `      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>\n`;
      code += `    </PackageReference>\n`;
      code += `    <PackageReference Include="Microsoft.EntityFrameworkCore.Tools" Version="8.0.0">\n`;
      code += `      <PrivateAssets>all</PrivateAssets>\n`;
      code += `    </PackageReference>\n`;
    }

    code += `  </ItemGroup>\n\n</Project>\n`;
    return code;
  },

  generateAppSettings(dbProvider, options = {}) {
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

    if (options.optAuthPack) {
      settings.Jwt = {
        Key: 'CHANGE_THIS_SUPER_SECRET_KEY_1234567890',
        Issuer: 'GenerateCode',
        Audience: 'GenerateCodeClient',
        AccessTokenMinutes: 30,
        RefreshTokenDays: 7
      };
    }

    return JSON.stringify(settings, null, 2) + '\n';
  },

  generateTemplateProject(projectType, context) {
    if (projectType === 'worker') {
      return this.generateWorkerTemplate(context, false);
    }
    if (projectType === 'windowsservice') {
      return this.generateWorkerTemplate(context, true);
    }
    if (projectType === 'console') {
      return this.generateConsoleTemplate(context);
    }
    if (projectType === 'library') {
      return this.generateLibraryTemplate(context);
    }
    if (projectType === 'grpc') {
      return this.generateGrpcTemplate(context);
    }
    return this.generateWorkerTemplate(context, false);
  },

  generateWorkerTemplate(context, asWindowsService) {
    const files = {};
    const ns = context.rootNamespace;
    const fw = context.targetFramework || 'net8.0';
    const name = context.projectName || 'MyWorker';

    files[`${name}.csproj`] = this.generateWorkerCsprojTemplate(fw, asWindowsService);
    files['Program.cs'] = this.generateWorkerProgramTemplate(ns, asWindowsService);
    files['Worker.cs'] = this.generateWorkerClassTemplate(ns);
    files['appsettings.json'] = this.generateWorkerSettingsTemplate();

    if (context.options?.optTestGeneration) {
      Object.assign(files, this.generateGenericTestScaffold({
        projectName: name,
        rootNamespace: ns,
        targetFramework: fw
      }));
    }
    return files;
  },

  generateConsoleTemplate(context) {
    const files = {};
    const ns = context.rootNamespace;
    const fw = context.targetFramework || 'net8.0';
    const name = context.projectName || 'MyConsole';
    files[`${name}.csproj`] = this.generateConsoleCsprojTemplate(fw);
    files['Program.cs'] = `namespace ${ns};\n\nConsole.WriteLine("Hello from ${ns}!");\n`;
    if (context.options?.optTestGeneration) {
      Object.assign(files, this.generateGenericTestScaffold({
        projectName: name,
        rootNamespace: ns,
        targetFramework: fw
      }));
    }
    return files;
  },

  generateLibraryTemplate(context) {
    const files = {};
    const ns = context.rootNamespace;
    const fw = context.targetFramework || 'net8.0';
    const name = context.projectName || 'MyLibrary';
    files[`${name}.csproj`] = this.generateLibraryCsprojTemplate(fw);
    files['Class1.cs'] = `namespace ${ns};\n\npublic class Class1\n{\n}\n`;
    if (context.options?.optTestGeneration) {
      Object.assign(files, this.generateGenericTestScaffold({
        projectName: name,
        rootNamespace: ns,
        targetFramework: fw
      }));
    }
    return files;
  },

  generateGrpcTemplate(context) {
    const files = {};
    const ns = context.rootNamespace;
    const fw = context.targetFramework || 'net8.0';
    const name = context.projectName || 'MyGrpc';
    files[`${name}.csproj`] = this.generateGrpcCsprojTemplate(fw);
    files['Program.cs'] = `using ${ns}.Services;\n\nvar builder = WebApplication.CreateBuilder(args);\n\nbuilder.Services.AddGrpc();\n\nvar app = builder.Build();\n\napp.MapGrpcService<GreeterService>();\napp.MapGet("/", () => "Use a gRPC client to communicate with this server.");\n\napp.Run();\n`;
    files['Protos/greet.proto'] = `syntax = "proto3";\n\noption csharp_namespace = "${ns}";\n\npackage greet;\n\nservice Greeter {\n  rpc SayHello (HelloRequest) returns (HelloReply);\n}\n\nmessage HelloRequest {\n  string name = 1;\n}\n\nmessage HelloReply {\n  string message = 1;\n}\n`;
    files['Services/GreeterService.cs'] = `using Grpc.Core;\nusing ${ns};\n\nnamespace ${ns}.Services;\n\npublic class GreeterService : Greeter.GreeterBase\n{\n    public override Task<HelloReply> SayHello(HelloRequest request, ServerCallContext context)\n    {\n        return Task.FromResult(new HelloReply\n        {\n            Message = "Hello " + request.Name\n        });\n    }\n}\n`;
    if (context.options?.optTestGeneration) {
      Object.assign(files, this.generateGenericTestScaffold({
        projectName: name,
        rootNamespace: ns,
        targetFramework: fw
      }));
    }
    return files;
  },

  generateWorkerCsprojTemplate(fw, asWindowsService) {
    let code = `<Project Sdk="Microsoft.NET.Sdk.Worker">\n\n`;
    code += `  <PropertyGroup>\n`;
    code += `    <TargetFramework>${fw}</TargetFramework>\n`;
    code += `    <Nullable>enable</Nullable>\n`;
    code += `    <ImplicitUsings>enable</ImplicitUsings>\n`;
    code += `  </PropertyGroup>\n\n`;
    code += `  <ItemGroup>\n`;
    if (asWindowsService) {
      code += `    <PackageReference Include="Microsoft.Extensions.Hosting.WindowsServices" Version="8.0.0" />\n`;
    }
    code += `  </ItemGroup>\n\n</Project>\n`;
    return code;
  },

  generateWorkerProgramTemplate(ns, asWindowsService) {
    let code = `namespace ${ns};\n\n`;
    code += `var builder = Host.CreateApplicationBuilder(args);\n`;
    if (asWindowsService) {
      code += `builder.Services.AddWindowsService(options =>\n{\n    options.ServiceName = "${ns} Service";\n});\n`;
    }
    code += `builder.Services.AddHostedService<Worker>();\n`;
    code += `var host = builder.Build();\n`;
    code += `host.Run();\n`;
    return code;
  },

  generateWorkerClassTemplate(ns) {
    return `namespace ${ns};\n\npublic class Worker : BackgroundService\n{\n    private readonly ILogger<Worker> _logger;\n\n    public Worker(ILogger<Worker> logger)\n    {\n        _logger = logger;\n    }\n\n    protected override async Task ExecuteAsync(CancellationToken stoppingToken)\n    {\n        while (!stoppingToken.IsCancellationRequested)\n        {\n            _logger.LogInformation("Worker running at: {time}", DateTimeOffset.Now);\n            await Task.Delay(1000, stoppingToken);\n        }\n    }\n}\n`;
  },

  generateWorkerSettingsTemplate() {
    return `{\n  "Logging": {\n    "LogLevel": {\n      "Default": "Information",\n      "Microsoft.Hosting.Lifetime": "Information"\n    }\n  }\n}\n`;
  },

  generateConsoleCsprojTemplate(fw) {
    return `<Project Sdk="Microsoft.NET.Sdk">\n\n  <PropertyGroup>\n    <OutputType>Exe</OutputType>\n    <TargetFramework>${fw}</TargetFramework>\n    <ImplicitUsings>enable</ImplicitUsings>\n    <Nullable>enable</Nullable>\n  </PropertyGroup>\n\n</Project>\n`;
  },

  generateLibraryCsprojTemplate(fw) {
    return `<Project Sdk="Microsoft.NET.Sdk">\n\n  <PropertyGroup>\n    <TargetFramework>${fw}</TargetFramework>\n    <ImplicitUsings>enable</ImplicitUsings>\n    <Nullable>enable</Nullable>\n  </PropertyGroup>\n\n</Project>\n`;
  },

  generateGrpcCsprojTemplate(fw) {
    return `<Project Sdk="Microsoft.NET.Sdk.Web">\n\n  <PropertyGroup>\n    <TargetFramework>${fw}</TargetFramework>\n    <Nullable>enable</Nullable>\n    <ImplicitUsings>enable</ImplicitUsings>\n  </PropertyGroup>\n\n  <ItemGroup>\n    <PackageReference Include="Grpc.AspNetCore" Version="2.63.0" />\n  </ItemGroup>\n\n  <ItemGroup>\n    <Protobuf Include="Protos\\\\greet.proto" GrpcServices="Server" />\n  </ItemGroup>\n\n</Project>\n`;
  },

  generateAuthUserModel(ns) {
    return `using System.ComponentModel.DataAnnotations;\n\nnamespace ${ns}.Models;\n\npublic class AuthUser\n{\n    [Key]\n    public int Id { get; set; }\n\n    [Required]\n    [MaxLength(80)]\n    public string Username { get; set; } = string.Empty;\n\n    [Required]\n    public string PasswordHash { get; set; } = string.Empty;\n\n    [Required]\n    [MaxLength(40)]\n    public string Role { get; set; } = "User";\n\n    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();\n}\n`;
  },

  generateRefreshTokenModel(ns) {
    return `using System.ComponentModel.DataAnnotations;\n\nnamespace ${ns}.Models;\n\npublic class RefreshToken\n{\n    [Key]\n    public int Id { get; set; }\n\n    [Required]\n    [MaxLength(200)]\n    public string Token { get; set; } = string.Empty;\n\n    public DateTime ExpiresAtUtc { get; set; }\n\n    public DateTime? RevokedAtUtc { get; set; }\n\n    public int UserId { get; set; }\n    public AuthUser? User { get; set; }\n\n    public bool IsActive => RevokedAtUtc == null && ExpiresAtUtc > DateTime.UtcNow;\n}\n`;
  },

  generateLoginRequestDto(ns) {
    return `using System.ComponentModel.DataAnnotations;\n\nnamespace ${ns}.DTOs.Requests;\n\npublic class LoginRequest\n{\n    [Required]\n    public string Username { get; set; } = string.Empty;\n\n    [Required]\n    public string Password { get; set; } = string.Empty;\n}\n`;
  },

  generateRefreshTokenRequestDto(ns) {
    return `using System.ComponentModel.DataAnnotations;\n\nnamespace ${ns}.DTOs.Requests;\n\npublic class RefreshTokenRequest\n{\n    [Required]\n    public string RefreshToken { get; set; } = string.Empty;\n}\n`;
  },

  generateLoginResponseDto(ns) {
    return `namespace ${ns}.DTOs.Responses;\n\npublic class LoginResponse\n{\n    public string AccessToken { get; set; } = string.Empty;\n    public DateTime AccessTokenExpiresAtUtc { get; set; }\n    public string RefreshToken { get; set; } = string.Empty;\n    public DateTime RefreshTokenExpiresAtUtc { get; set; }\n    public string Username { get; set; } = string.Empty;\n    public string Role { get; set; } = string.Empty;\n}\n`;
  },

  generateAuthServiceInterface(ns) {
    return `using ${ns}.DTOs.Requests;\nusing ${ns}.DTOs.Responses;\n\nnamespace ${ns}.Services;\n\npublic interface IAuthService\n{\n    Task<LoginResponse?> LoginAsync(LoginRequest request);\n    Task<LoginResponse?> RefreshTokenAsync(RefreshTokenRequest request);\n}\n`;
  },

  generateAuthService(ns) {
    return `using Microsoft.EntityFrameworkCore;\nusing Microsoft.IdentityModel.Tokens;\nusing System.IdentityModel.Tokens.Jwt;\nusing System.Security.Claims;\nusing System.Security.Cryptography;\nusing System.Text;\nusing ${ns}.Data;\nusing ${ns}.DTOs.Requests;\nusing ${ns}.DTOs.Responses;\nusing ${ns}.Models;\n\nnamespace ${ns}.Services;\n\npublic class AuthService : IAuthService\n{\n    private readonly AppDbContext _context;\n    private readonly IConfiguration _configuration;\n\n    public AuthService(AppDbContext context, IConfiguration configuration)\n    {\n        _context = context;\n        _configuration = configuration;\n    }\n\n    public async Task<LoginResponse?> LoginAsync(LoginRequest request)\n    {\n        var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == request.Username);\n        if (user == null || user.PasswordHash != request.Password)\n        {\n            return null;\n        }\n\n        return await IssueTokensAsync(user);\n    }\n\n    public async Task<LoginResponse?> RefreshTokenAsync(RefreshTokenRequest request)\n    {\n        var token = await _context.RefreshTokens.Include(t => t.User).FirstOrDefaultAsync(t => t.Token == request.RefreshToken);\n        if (token == null || !token.IsActive || token.User == null)\n        {\n            return null;\n        }\n\n        token.RevokedAtUtc = DateTime.UtcNow;\n        await _context.SaveChangesAsync();\n\n        return await IssueTokensAsync(token.User);\n    }\n\n    private async Task<LoginResponse> IssueTokensAsync(AuthUser user)\n    {\n        var accessTokenMinutes = int.TryParse(_configuration["Jwt:AccessTokenMinutes"], out var minutes) ? minutes : 30;\n        var refreshTokenDays = int.TryParse(_configuration["Jwt:RefreshTokenDays"], out var days) ? days : 7;\n\n        var accessTokenExpires = DateTime.UtcNow.AddMinutes(accessTokenMinutes);\n        var refreshTokenExpires = DateTime.UtcNow.AddDays(refreshTokenDays);\n\n        var accessToken = BuildAccessToken(user, accessTokenExpires);\n        var refreshTokenValue = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));\n\n        _context.RefreshTokens.Add(new RefreshToken\n        {\n            Token = refreshTokenValue,\n            UserId = user.Id,\n            ExpiresAtUtc = refreshTokenExpires\n        });\n        await _context.SaveChangesAsync();\n\n        return new LoginResponse\n        {\n            AccessToken = accessToken,\n            AccessTokenExpiresAtUtc = accessTokenExpires,\n            RefreshToken = refreshTokenValue,\n            RefreshTokenExpiresAtUtc = refreshTokenExpires,\n            Username = user.Username,\n            Role = user.Role\n        };\n    }\n\n    private string BuildAccessToken(AuthUser user, DateTime expiresAtUtc)\n    {\n        var issuer = _configuration["Jwt:Issuer"] ?? "GenerateCode";\n        var audience = _configuration["Jwt:Audience"] ?? "GenerateCodeClient";\n        var key = _configuration["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key missing");\n\n        var claims = new List<Claim>\n        {\n            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),\n            new(JwtRegisteredClaimNames.UniqueName, user.Username),\n            new(ClaimTypes.Role, user.Role)\n        };\n\n        var signingCredentials = new SigningCredentials(\n            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),\n            SecurityAlgorithms.HmacSha256\n        );\n\n        var token = new JwtSecurityToken(\n            issuer: issuer,\n            audience: audience,\n            claims: claims,\n            expires: expiresAtUtc,\n            signingCredentials: signingCredentials\n        );\n\n        return new JwtSecurityTokenHandler().WriteToken(token);\n    }\n}\n`;
  },

  generateAuthController(ns) {
    return `using Microsoft.AspNetCore.Mvc;\nusing ${ns}.DTOs.Requests;\nusing ${ns}.Services;\n\nnamespace ${ns}.Controllers;\n\n[ApiController]\n[Route("api/auth")]\npublic class AuthController : ControllerBase\n{\n    private readonly IAuthService _authService;\n\n    public AuthController(IAuthService authService)\n    {\n        _authService = authService;\n    }\n\n    [HttpPost("login")]\n    public async Task<IActionResult> Login([FromBody] LoginRequest request)\n    {\n        var result = await _authService.LoginAsync(request);\n        if (result == null) return Unauthorized();\n        return Ok(result);\n    }\n\n    [HttpPost("refresh")]\n    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequest request)\n    {\n        var result = await _authService.RefreshTokenAsync(request);\n        if (result == null) return Unauthorized();\n        return Ok(result);\n    }\n}\n`;
  },

  generatePageRequest(ns) {
    return `namespace ${ns}.Infrastructure.Pagination;\n\npublic class PageRequest\n{\n    private int _pageNumber = 1;\n    private int _pageSize = 20;\n\n    public int PageNumber\n    {\n        get => _pageNumber;\n        set => _pageNumber = value < 1 ? 1 : value;\n    }\n\n    public int PageSize\n    {\n        get => _pageSize;\n        set => _pageSize = value < 1 ? 1 : value > 200 ? 200 : value;\n    }\n\n    public string? Filter { get; set; }\n    public string? SortBy { get; set; }\n    public bool Desc { get; set; }\n}\n`;
  },

  generatePagedResult(ns) {
    return `namespace ${ns}.Infrastructure.Pagination;\n\npublic class PagedResult<T>\n{\n    public IReadOnlyCollection<T> Items { get; set; } = Array.Empty<T>();\n    public int TotalCount { get; set; }\n    public int PageNumber { get; set; }\n    public int PageSize { get; set; }\n\n    public PagedResult() { }\n\n    public PagedResult(IReadOnlyCollection<T> items, int totalCount, int pageNumber, int pageSize)\n    {\n        Items = items;\n        TotalCount = totalCount;\n        PageNumber = pageNumber;\n        PageSize = pageSize;\n    }\n}\n`;
  },

  generateGlobalExceptionMiddleware(ns) {
    return `using Microsoft.AspNetCore.Mvc;\n\nnamespace ${ns}.Middleware;\n\npublic class GlobalExceptionMiddleware\n{\n    private readonly RequestDelegate _next;\n    private readonly ILogger<GlobalExceptionMiddleware> _logger;\n\n    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)\n    {\n        _next = next;\n        _logger = logger;\n    }\n\n    public async Task Invoke(HttpContext context)\n    {\n        try\n        {\n            await _next(context);\n        }\n        catch (Exception ex)\n        {\n            _logger.LogError(ex, "Unhandled exception");\n            context.Response.StatusCode = StatusCodes.Status500InternalServerError;\n            context.Response.ContentType = "application/problem+json";\n\n            var problem = new ProblemDetails\n            {\n                Title = "Unexpected error",\n                Detail = "An unexpected error occurred while processing the request.",\n                Status = StatusCodes.Status500InternalServerError,\n                Instance = context.Request.Path\n            };\n            problem.Extensions["traceId"] = context.TraceIdentifier;\n\n            await context.Response.WriteAsJsonAsync(problem);\n        }\n    }\n}\n`;
  },

  generateSeedData(ns, tables, options = {}) {
    let code = `using ${ns}.Models;\n\nnamespace ${ns}.Data;\n\npublic static class SeedData\n{\n`;
    code += `    public static void Initialize(AppDbContext context)\n    {\n`;
    if (options.optAuthPack) {
      code += `        if (!context.Users.Any())\n        {\n`;
      code += `            context.Users.Add(new AuthUser\n            {\n`;
      code += `                Username = "admin",\n`;
      code += `                PasswordHash = "admin123",\n`;
      code += `                Role = "Admin"\n`;
      code += `            });\n`;
      code += `        }\n\n`;
    }

    tables.forEach(table => {
      code += `        if (!context.${table.name}s.Any())\n        {\n`;
      code += `            context.${table.name}s.Add(new ${table.name}\n            {\n`;
      const bodyLines = table.columns
        .filter(column => !column.isPrimaryKey)
        .map(column => `                ${column.name} = ${this.seedValueForType(column.type)}`);
      if (bodyLines.length) {
        code += bodyLines.join(',\n') + '\n';
      }
      code += `            });\n`;
      code += `        }\n\n`;
    });

    code += `        context.SaveChanges();\n`;
    code += `    }\n`;
    code += `}\n`;
    return code;
  },

  seedValueForType(typeName) {
    const name = String(typeName || '').replace('?', '');
    if (name === 'string') return '"Sample"';
    if (name === 'bool') return 'true';
    if (name === 'decimal') return '1.0m';
    if (name === 'double') return '1.0d';
    if (name === 'float') return '1.0f';
    if (name === 'long') return '1L';
    if (name === 'short') return '(short)1';
    if (name === 'byte') return '(byte)1';
    if (name === 'Guid') return 'Guid.NewGuid()';
    if (name === 'DateTime') return 'DateTime.UtcNow';
    if (name === 'byte[]') return 'new byte[] { 1, 2, 3 }';
    return '1';
  },

  generateDbContextFactory(ns, dbProvider) {
    let code = `using Microsoft.EntityFrameworkCore;\n`;
    code += `using Microsoft.EntityFrameworkCore.Design;\n`;
    code += `using Microsoft.Extensions.Configuration;\n\n`;
    code += `namespace ${ns}.Data;\n\n`;
    code += `public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>\n{\n`;
    code += `    public AppDbContext CreateDbContext(string[] args)\n    {\n`;
    code += `        var configuration = new ConfigurationBuilder()\n`;
    code += `            .SetBasePath(Directory.GetCurrentDirectory())\n`;
    code += `            .AddJsonFile("appsettings.json", optional: true)\n`;
    code += `            .Build();\n\n`;
    code += `        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();\n`;
    if (dbProvider === 'SqlServer') {
      code += `        optionsBuilder.UseSqlServer(configuration.GetConnectionString("DefaultConnection"));\n`;
    } else if (dbProvider === 'PostgreSQL') {
      code += `        optionsBuilder.UseNpgsql(configuration.GetConnectionString("DefaultConnection"));\n`;
    } else if (dbProvider === 'MySQL') {
      code += `        var connection = configuration.GetConnectionString("DefaultConnection");\n`;
      code += `        optionsBuilder.UseMySql(connection, ServerVersion.AutoDetect(connection));\n`;
    } else {
      code += `        optionsBuilder.UseInMemoryDatabase("DesignTimeDb");\n`;
    }
    code += `        return new AppDbContext(optionsBuilder.Options);\n`;
    code += `    }\n`;
    code += `}\n`;
    return code;
  },

  generateInitialMigration(ns) {
    return `using Microsoft.EntityFrameworkCore.Migrations;\n\n#nullable disable\n\nnamespace ${ns}.Migrations\n{\n    public partial class InitialScaffold : Migration\n    {\n        protected override void Up(MigrationBuilder migrationBuilder)\n        {\n            // Placeholder migration. Run: dotnet ef migrations add InitialCreate\n        }\n\n        protected override void Down(MigrationBuilder migrationBuilder)\n        {\n        }\n    }\n}\n`;
  },

  generateMigrationReadme() {
    return `# EF Migration Notes\n\nThis project includes migration scaffolding files.\n\nRecommended commands:\n\n\`dotnet tool install --global dotnet-ef\`\n\`dotnet ef migrations add InitialCreate\`\n\`dotnet ef database update\`\n`;
  },

  generateWebApiTestScaffold(context) {
    const files = {};
    const testRoot = `tests/${context.projectName}.Tests`;
    const tfm = context.targetFramework || 'net8.0';
    const testPackageVersion = tfm.startsWith('net9') ? '9.0.0' : '8.0.0';

    files[`${testRoot}/${context.projectName}.Tests.csproj`] = `<Project Sdk="Microsoft.NET.Sdk">\n\n  <PropertyGroup>\n    <TargetFramework>${tfm}</TargetFramework>\n    <IsPackable>false</IsPackable>\n    <Nullable>enable</Nullable>\n  </PropertyGroup>\n\n  <ItemGroup>\n    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.8.0" />\n    <PackageReference Include="xunit" Version="2.6.2" />\n    <PackageReference Include="xunit.runner.visualstudio" Version="2.5.4" />\n    <PackageReference Include="Moq" Version="4.20.69" />\n    <PackageReference Include="coverlet.collector" Version="6.0.0" />\n    <PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="${testPackageVersion}" />\n  </ItemGroup>\n\n  <ItemGroup>\n    <ProjectReference Include="..\\\\..\\\\${context.projectName}.csproj" />\n  </ItemGroup>\n\n</Project>\n`;

    files[`${testRoot}/Usings.cs`] = `global using Xunit;\n`;
    files[`${testRoot}/Integration/ApiSmokeTests.cs`] = `using System.Net;\nusing Microsoft.AspNetCore.Mvc.Testing;\n\nnamespace ${context.rootNamespace}.Tests.Integration;\n\npublic class ApiSmokeTests : IClassFixture<WebApplicationFactory<Program>>\n{\n    private readonly HttpClient _client;\n\n    public ApiSmokeTests(WebApplicationFactory<Program> factory)\n    {\n        _client = factory.CreateClient();\n    }\n\n    [Fact]\n    public async Task Swagger_Endpoint_Returns_Success_Or_NotFound()\n    {\n        var response = await _client.GetAsync("/swagger/index.html");\n        Assert.True(response.IsSuccessStatusCode || response.StatusCode == HttpStatusCode.NotFound);\n    }\n}\n`;

    context.tables.filter(table => table.generateCrud).forEach(table => {
      files[`${testRoot}/Services/${table.name}ServiceTests.cs`] = `using Moq;\n\nnamespace ${context.rootNamespace}.Tests.Services;\n\npublic class ${table.name}ServiceTests\n{\n    [Fact]\n    public void Placeholder_Test()\n    {\n        Assert.True(true);\n    }\n}\n`;
    });

    return files;
  },

  generateGenericTestScaffold(context) {
    const files = {};
    const testRoot = `tests/${context.projectName}.Tests`;
    files[`${testRoot}/${context.projectName}.Tests.csproj`] = `<Project Sdk="Microsoft.NET.Sdk">\n\n  <PropertyGroup>\n    <TargetFramework>${context.targetFramework || 'net8.0'}</TargetFramework>\n    <IsPackable>false</IsPackable>\n    <Nullable>enable</Nullable>\n  </PropertyGroup>\n\n  <ItemGroup>\n    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.8.0" />\n    <PackageReference Include="xunit" Version="2.6.2" />\n    <PackageReference Include="xunit.runner.visualstudio" Version="2.5.4" />\n    <PackageReference Include="Moq" Version="4.20.69" />\n  </ItemGroup>\n\n  <ItemGroup>\n    <ProjectReference Include="..\\\\..\\\\${context.projectName}.csproj" />\n  </ItemGroup>\n\n</Project>\n`;
    files[`${testRoot}/Usings.cs`] = `global using Xunit;\n`;
    files[`${testRoot}/TemplateSmokeTests.cs`] = `namespace ${context.rootNamespace}.Tests;\n\npublic class TemplateSmokeTests\n{\n    [Fact]\n    public void Placeholder_Test()\n    {\n        Assert.True(true);\n    }\n}\n`;
    return files;
  },

  generatePostmanCollection(context) {
    const makeRequest = (name, method, rawPath, bodyObj = null) => {
      const path = rawPath.replace(/^\/+/, '');
      const request = {
        name,
        request: {
          method,
          header: bodyObj ? [{ key: 'Content-Type', value: 'application/json' }] : [],
          url: {
            raw: `{{baseUrl}}/${path}`,
            host: ['{{baseUrl}}'],
            path: path.split('/').filter(Boolean)
          }
        }
      };
      if (bodyObj) {
        request.request.body = {
          mode: 'raw',
          raw: JSON.stringify(bodyObj, null, 2)
        };
      }
      return request;
    };

    const items = [];

    if (context.options?.optAuthPack) {
      items.push({
        name: 'Auth',
        item: [
          makeRequest('Login', 'POST', 'api/auth/login', { username: 'admin', password: 'admin123' }),
          makeRequest('Refresh Token', 'POST', 'api/auth/refresh', { refreshToken: '{{refreshToken}}' })
        ]
      });
    }

    context.tables.filter(table => table.generateCrud).forEach(table => {
      const routeSegment = this.buildRouteSegment(table.name, context.routeCase, context.controllerPlural);
      const basePath = `${context.routePrefix}/${routeSegment}`.replace(/\/+/g, '/');
      const pk = table.columns.find(col => col.isPrimaryKey);
      const keyName = pk ? this.toCamelCase(pk.name) : 'id';

      const sampleBody = {};
      table.columns.filter(col => !col.isPrimaryKey).forEach(col => {
        sampleBody[col.name] = this.jsonSampleValue(col.type);
      });

      items.push({
        name: table.name,
        item: [
          makeRequest('Get All', 'GET', basePath),
          makeRequest('Get By Id', 'GET', `${basePath}/{{${keyName}}}`),
          makeRequest('Create', 'POST', basePath, sampleBody),
          makeRequest('Update', 'PUT', `${basePath}/{{${keyName}}}`, sampleBody),
          makeRequest('Delete', 'DELETE', `${basePath}/{{${keyName}}}`)
        ]
      });
    });

    const collection = {
      info: {
        name: `${context.projectName} Collection`,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      variable: [
        { key: 'baseUrl', value: 'https://localhost:5001' },
        { key: 'refreshToken', value: '' }
      ],
      item: items
    };

    return JSON.stringify(collection, null, 2) + '\n';
  },

  jsonSampleValue(typeName) {
    const name = String(typeName || '').replace('?', '');
    if (name === 'string') return 'sample';
    if (name === 'bool') return true;
    if (name === 'decimal' || name === 'double' || name === 'float') return 1.0;
    if (name === 'Guid') return '00000000-0000-0000-0000-000000000000';
    if (name === 'DateTime') return '2026-01-01T00:00:00Z';
    if (name === 'byte[]') return 'AQID';
    return 1;
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
