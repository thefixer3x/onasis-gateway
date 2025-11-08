const semver = require('semver');
const EventEmitter = require('events');

/**
 * Version Manager - Handles service versioning, compatibility, and migrations
 */
class VersionManager extends EventEmitter {
  constructor() {
    super();
    this.supportedVersions = new Map();
    this.versionMappings = new Map();
    this.compatibilityMatrix = new Map();
    this.migrationHandlers = new Map();
  }

  /**
   * Register a new service version
   */
  registerVersion(serviceId, version, config) {
    const key = `${serviceId}:${version}`;
    
    // Validate version format
    if (!semver.valid(version)) {
      throw new Error(`Invalid version format: ${version}`);
    }

    // Store version config
    this.supportedVersions.set(key, {
      ...config,
      registeredAt: new Date(),
      deprecated: false
    });

    // Create compatibility mappings
    this.createCompatibilityMappings(serviceId, version, config);

    // Emit version registration event
    this.emit('version:registered', { serviceId, version, config });

    return key;
  }

  /**
   * Get service configuration for specific version
   */
  getServiceVersion(serviceId, requestedVersion = 'latest') {
    if (requestedVersion === 'latest') {
      return this.getLatestVersion(serviceId);
    }

    const key = `${serviceId}:${requestedVersion}`;
    const config = this.supportedVersions.get(key);

    if (!config) {
      // Try to find compatible version
      const compatibleVersion = this.findCompatibleVersion(serviceId, requestedVersion);
      if (compatibleVersion) {
        return compatibleVersion;
      }
      
      throw new Error(`Version ${requestedVersion} not found for service ${serviceId}`);
    }

    return config;
  }

  /**
   * Get latest version of a service
   */
  getLatestVersion(serviceId) {
    const versions = this.getServiceVersions(serviceId);
    
    if (versions.length === 0) {
      throw new Error(`No versions found for service ${serviceId}`);
    }

    // Sort versions and get latest
    const sortedVersions = versions.sort((a, b) => semver.rcompare(a.version, b.version));
    return sortedVersions[0];
  }

  /**
   * Get all versions for a service
   */
  getServiceVersions(serviceId) {
    const versions = [];
    
    for (const [key, config] of this.supportedVersions.entries()) {
      const [service, version] = key.split(':');
      if (service === serviceId) {
        versions.push({ version, config });
      }
    }

    return versions;
  }

  /**
   * Create compatibility mappings between versions
   */
  createCompatibilityMappings(serviceId, version, config) {
    const existingVersions = this.getServiceVersions(serviceId);
    
    for (const { version: existingVersion, config: existingConfig } of existingVersions) {
      if (existingVersion === version) continue;

      // Determine compatibility
      const compatibility = this.analyzeCompatibility(config, existingConfig);
      
      const mappingKey = `${serviceId}:${existingVersion}->${version}`;
      this.versionMappings.set(mappingKey, compatibility);

      // Store in compatibility matrix
      this.compatibilityMatrix.set(mappingKey, {
        fromVersion: existingVersion,
        toVersion: version,
        compatible: compatibility.compatible,
        breakingChanges: compatibility.breakingChanges,
        migrations: compatibility.migrations
      });
    }
  }

  /**
   * Analyze compatibility between two service versions
   */
  analyzeCompatibility(newConfig, oldConfig) {
    const compatibility = {
      compatible: true,
      breakingChanges: [],
      migrations: [],
      warnings: []
    };

    // Check endpoint compatibility
    const endpointChanges = this.compareEndpoints(newConfig.endpoints, oldConfig.endpoints);
    compatibility.breakingChanges.push(...endpointChanges.breaking);
    compatibility.migrations.push(...endpointChanges.migrations);
    compatibility.warnings.push(...endpointChanges.warnings);

    // Check authentication changes
    const authChanges = this.compareAuthentication(newConfig.authentication, oldConfig.authentication);
    if (authChanges.breaking) {
      compatibility.breakingChanges.push(authChanges);
    }

    // Check base URL changes
    if (newConfig.baseUrl !== oldConfig.baseUrl) {
      compatibility.breakingChanges.push({
        type: 'baseUrl',
        message: `Base URL changed from ${oldConfig.baseUrl} to ${newConfig.baseUrl}`
      });
    }

    compatibility.compatible = compatibility.breakingChanges.length === 0;

    return compatibility;
  }

  /**
   * Compare endpoints between versions
   */
  compareEndpoints(newEndpoints, oldEndpoints) {
    const changes = {
      breaking: [],
      migrations: [],
      warnings: []
    };

    const oldEndpointMap = new Map(oldEndpoints.map(ep => [ep.id, ep]));
    const newEndpointMap = new Map(newEndpoints.map(ep => [ep.id, ep]));

    // Check for removed endpoints
    for (const [id, oldEndpoint] of oldEndpointMap) {
      if (!newEndpointMap.has(id)) {
        changes.breaking.push({
          type: 'endpoint_removed',
          endpoint: id,
          message: `Endpoint ${id} was removed`
        });
      }
    }

    // Check for modified endpoints
    for (const [id, newEndpoint] of newEndpointMap) {
      const oldEndpoint = oldEndpointMap.get(id);
      
      if (oldEndpoint) {
        const endpointChanges = this.compareEndpoint(newEndpoint, oldEndpoint);
        changes.breaking.push(...endpointChanges.breaking);
        changes.migrations.push(...endpointChanges.migrations);
        changes.warnings.push(...endpointChanges.warnings);
      } else {
        changes.warnings.push({
          type: 'endpoint_added',
          endpoint: id,
          message: `New endpoint ${id} added`
        });
      }
    }

    return changes;
  }

  /**
   * Compare individual endpoint changes
   */
  compareEndpoint(newEndpoint, oldEndpoint) {
    const changes = {
      breaking: [],
      migrations: [],
      warnings: []
    };

    // Check method changes
    if (newEndpoint.method !== oldEndpoint.method) {
      changes.breaking.push({
        type: 'method_changed',
        endpoint: newEndpoint.id,
        message: `Method changed from ${oldEndpoint.method} to ${newEndpoint.method}`
      });
    }

    // Check path changes
    if (newEndpoint.path !== oldEndpoint.path) {
      changes.breaking.push({
        type: 'path_changed',
        endpoint: newEndpoint.id,
        message: `Path changed from ${oldEndpoint.path} to ${newEndpoint.path}`
      });
    }

    // Check parameter changes
    const paramChanges = this.compareParameters(newEndpoint.parameters, oldEndpoint.parameters);
    changes.breaking.push(...paramChanges.breaking);
    changes.migrations.push(...paramChanges.migrations);

    return changes;
  }

  /**
   * Compare parameters between endpoint versions
   */
  compareParameters(newParams = {}, oldParams = {}) {
    const changes = {
      breaking: [],
      migrations: []
    };

    // Check each parameter type
    ['path', 'query', 'header'].forEach(type => {
      const newTypeParams = newParams[type] || [];
      const oldTypeParams = oldParams[type] || [];

      const oldParamMap = new Map(oldTypeParams.map(p => [p.name, p]));
      const newParamMap = new Map(newTypeParams.map(p => [p.name, p]));

      // Check for removed required parameters
      for (const [name, oldParam] of oldParamMap) {
        if (!newParamMap.has(name) && oldParam.required) {
          changes.breaking.push({
            type: 'required_parameter_removed',
            parameter: name,
            paramType: type,
            message: `Required ${type} parameter ${name} was removed`
          });
        }
      }

      // Check for new required parameters
      for (const [name, newParam] of newParamMap) {
        if (!oldParamMap.has(name) && newParam.required) {
          changes.breaking.push({
            type: 'required_parameter_added',
            parameter: name,
            paramType: type,
            message: `New required ${type} parameter ${name} was added`
          });
        }
      }

      // Check for parameter type changes
      for (const [name, newParam] of newParamMap) {
        const oldParam = oldParamMap.get(name);
        if (oldParam && oldParam.type !== newParam.type) {
          changes.breaking.push({
            type: 'parameter_type_changed',
            parameter: name,
            paramType: type,
            message: `Parameter ${name} type changed from ${oldParam.type} to ${newParam.type}`
          });
        }
      }
    });

    return changes;
  }

  /**
   * Compare authentication configurations
   */
  compareAuthentication(newAuth, oldAuth) {
    if (!newAuth && !oldAuth) return { breaking: false };
    
    if (!newAuth || !oldAuth) {
      return {
        breaking: true,
        type: 'authentication_changed',
        message: 'Authentication configuration changed'
      };
    }

    if (newAuth.type !== oldAuth.type) {
      return {
        breaking: true,
        type: 'auth_type_changed',
        message: `Authentication type changed from ${oldAuth.type} to ${newAuth.type}`
      };
    }

    return { breaking: false };
  }

  /**
   * Find compatible version for requested version
   */
  findCompatibleVersion(serviceId, requestedVersion) {
    const versions = this.getServiceVersions(serviceId);
    
    // Try to find exact match first
    const exactMatch = versions.find(v => v.version === requestedVersion);
    if (exactMatch) return exactMatch.config;

    // Try to find compatible version
    for (const { version, config } of versions) {
      const mappingKey = `${serviceId}:${requestedVersion}->${version}`;
      const compatibility = this.compatibilityMatrix.get(mappingKey);
      
      if (compatibility && compatibility.compatible) {
        return config;
      }
    }

    return null;
  }

  /**
   * Register migration handler for version transitions
   */
  registerMigrationHandler(serviceId, fromVersion, toVersion, handler) {
    const key = `${serviceId}:${fromVersion}->${toVersion}`;
    this.migrationHandlers.set(key, handler);
  }

  /**
   * Execute migration between versions
   */
  async executeMigration(serviceId, fromVersion, toVersion, data) {
    const key = `${serviceId}:${fromVersion}->${toVersion}`;
    const handler = this.migrationHandlers.get(key);

    if (!handler) {
      throw new Error(`No migration handler found for ${key}`);
    }

    try {
      const migratedData = await handler(data);
      
      this.emit('migration:completed', {
        serviceId,
        fromVersion,
        toVersion,
        data: migratedData
      });

      return migratedData;
    } catch (error) {
      this.emit('migration:failed', {
        serviceId,
        fromVersion,
        toVersion,
        error
      });
      throw error;
    }
  }

  /**
   * Deprecate a service version
   */
  deprecateVersion(serviceId, version, reason) {
    const key = `${serviceId}:${version}`;
    const config = this.supportedVersions.get(key);

    if (!config) {
      throw new Error(`Version ${version} not found for service ${serviceId}`);
    }

    config.deprecated = true;
    config.deprecationReason = reason;
    config.deprecatedAt = new Date();

    this.emit('version:deprecated', { serviceId, version, reason });
  }

  /**
   * Get version compatibility matrix
   */
  getCompatibilityMatrix(serviceId) {
    const matrix = [];
    
    for (const [key, compatibility] of this.compatibilityMatrix.entries()) {
      const [service] = key.split(':');
      if (service === serviceId) {
        matrix.push(compatibility);
      }
    }

    return matrix;
  }

  /**
   * Get service version statistics
   */
  getVersionStats(serviceId) {
    const versions = this.getServiceVersions(serviceId);
    
    return {
      total: versions.length,
      deprecated: versions.filter(v => v.config.deprecated).length,
      latest: this.getLatestVersion(serviceId).version,
      oldest: versions.sort((a, b) => semver.compare(a.version, b.version))[0]?.version
    };
  }
}

module.exports = VersionManager;
