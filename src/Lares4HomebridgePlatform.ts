import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';
import { Lares4, Lares4Factory } from 'lares4-ts';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

import { Lares4PlatformLight } from './Lares4PlatformLight.js';
import { Lares4PlatformCover } from './Lares4PlatformCover.js';
import { Lares4PlatformScenario } from './Lares4PlatformScenario.js';
import { Lares4PlatformThermostat } from './Lares4PlatformThermostat.js';
import { Lares4PlatformLightSensor } from './Lares4PlatformLightSensor.js';

interface ConnectionConfig {
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  connectionTimeout: number;
}

interface WebSocketLike {
  readyState: number;
  on(event: 'error', callback: (error: Error) => void): void;
  on(event: 'close', callback: (code: number, reason: string) => void): void;
  on(event: 'pong', callback: () => void): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
  ping(): void;
}

export class Lares4HomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  public readonly accessories: Map<string, PlatformAccessory> = new Map();
  public readonly discoveredCacheUUIDs: string[] = [];

  lares4?: Lares4;
  
  // Connection management properties
  private reconnectTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private isReconnecting = false;
  private isShuttingDown = false;
  private lastHeartbeat = Date.now();
  
  // Connection configuration with defaults
  private connectionConfig: ConnectionConfig = {
    reconnectInterval: 5000, // 5 seconds
    maxReconnectAttempts: -1, // infinite
    heartbeatInterval: 30000, // 30 seconds
    connectionTimeout: 10000, // 10 seconds
  };

  // Accessory instances for recovery
  private accessoryInstances: Map<string, unknown> = new Map();

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    if (!config) {
      this.log.error('No configuration found');
      return;
    }

    // Override connection config with user settings if provided
    if (config.connectionConfig) {
      this.connectionConfig = { ...this.connectionConfig, ...config.connectionConfig };
    }

    this.log.debug('Finished initializing platform:', this.config.name);
    this.log.info('Connection config:', this.connectionConfig);

    this.api.on('didFinishLaunching', async () => {
      log.debug('Executed didFinishLaunching callback');
      await this.initializeLares4Connection();
    });

    // Graceful shutdown
    this.api.on('shutdown', () => {
      this.isShuttingDown = true;
      this.stopReconnectionLoop();
      this.stopHeartbeat();
      if (this.lares4) {
        try {
          this.lares4.logout();
        } catch (error) {
          this.log.debug('Error during logout:', error);
        }
      }
    });
  }

  private async initializeLares4Connection(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    try {
      this.log.info('Initializing Lares4 connection...');
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), this.connectionConfig.connectionTimeout);
      });

      const connectionPromise = Lares4Factory.createLares4(
        this.config.sender,
        this.config.ip,
        this.config.pin,
        this.config.https,
        this.log,
      );

      this.lares4 = await Promise.race([connectionPromise, timeoutPromise]) as Lares4;

      if (this.lares4.initialized) {
        this.log.info('Lares4 connection established successfully');
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.lastHeartbeat = Date.now();
        
        // Setup connection monitoring
        this.setupConnectionMonitoring();
        
        // Configure accessories
        this.configureLares4Accessories();
        
        // Start heartbeat
        this.startHeartbeat();
      } else {
        throw new Error('Lares4 initialization failed - not initialized');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.error('Failed to initialize Lares4 connection:', errorMessage);
      
      // Schedule reconnection if not shutting down
      if (!this.isShuttingDown) {
        this.scheduleReconnection();
      }
    }
  }

  private setupConnectionMonitoring(): void {
    if (!this.lares4) {
      return;
    }

    // Monitor connection events if available
    try {
      // Try to access underlying WebSocket if possible
      const ws = (this.lares4 as unknown as { _ws?: WebSocketLike })._ws;
      if (ws) {
        ws.on('error', (error: Error) => {
          this.log.error('WebSocket error:', error.message);
          this.handleConnectionLoss();
        });

        ws.on('close', (code: number, reason: string) => {
          this.log.warn(`WebSocket closed: code=${code}, reason=${reason}`);
          this.handleConnectionLoss();
        });

        ws.on('pong', () => {
          this.lastHeartbeat = Date.now();
          this.log.debug('Received pong - connection alive');
        });
      }
    } catch (error) {
      this.log.debug('Could not setup WebSocket monitoring:', error);
    }

    // Setup status update monitoring
    this.lares4.outputs_status_emitter.subscribe(() => {
      this.lastHeartbeat = Date.now();
    });

    this.lares4.sensors_status_emitter.subscribe(() => {
      this.lastHeartbeat = Date.now();
    });

    this.lares4.temperatures_status_emitter.subscribe(() => {
      this.lastHeartbeat = Date.now();
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.isShuttingDown) {
        return;
      }

      const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;
      
      if (timeSinceLastHeartbeat > this.connectionConfig.heartbeatInterval * 2) {
        this.log.warn(`No heartbeat for ${Math.round(timeSinceLastHeartbeat / 1000)}s - connection may be lost`);
        this.handleConnectionLoss();
        return;
      }

      // Send a ping if WebSocket is available
      try {
        const ws = (this.lares4 as unknown as { _ws?: WebSocketLike })?._ws;
        if (ws && ws.readyState === 1) { // WebSocket.OPEN
          ws.ping();
          this.log.debug('Sent ping to keep connection alive');
        }
      } catch (error) {
        this.log.debug('Could not send ping:', error);
      }
    }, this.connectionConfig.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private handleConnectionLoss(): void {
    if (this.isReconnecting || this.isShuttingDown) {
      return;
    }

    this.log.warn('Connection lost - initiating reconnection...');
    this.stopHeartbeat();
    this.scheduleReconnection();
  }

  private scheduleReconnection(): void {
    if (this.isShuttingDown) {
      return;
    }

    if (this.connectionConfig.maxReconnectAttempts !== -1 && 
        this.reconnectAttempts >= this.connectionConfig.maxReconnectAttempts) {
      this.log.error(`Maximum reconnection attempts (${this.connectionConfig.maxReconnectAttempts}) reached. Giving up.`);
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    const delay = Math.min(
      this.connectionConfig.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1),
      30000, // Max 30 seconds
    );

    this.log.info(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${Math.round(delay / 1000)}s`);

    this.reconnectTimer = setTimeout(async () => {
      if (this.isShuttingDown) {
        return;
      }
      
      // Clean up current connection
      this.cleanupConnection();
      
      // Attempt reconnection
      await this.initializeLares4Connection();
    }, delay);
  }

  private stopReconnectionLoop(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.isReconnecting = false;
  }

  private cleanupConnection(): void {
    if (this.lares4) {
      try {
        this.lares4.logout();
      } catch (error) {
        this.log.debug('Error during connection cleanup:', error);
      }
      this.lares4 = undefined;
    }
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.set(accessory.UUID, accessory);
  }

  configureLares4Accessories() {
    if (!this.lares4) {
      this.log.error('Cannot configure accessories - Lares4 not initialized');
      return;
    }

    // Clear previous accessory instances
    this.accessoryInstances.clear();

    const bulbs = this.lares4?.lights || [];
    const dimmers = this.lares4?.dimmers || [];
    const lights = [ ...bulbs, ...dimmers ];

    const covers = this.lares4?.shutters || [];
    const scenarios = this.lares4?.scenarios || [];
    const thermostats = this.lares4?.thermostats || [];
    const gates = this.lares4?.gates || [];

    // Configure lights with error handling
    lights.forEach(light => {
      try {
        const uuid = this.api.hap.uuid.generate(`${light.details.ID}-light`);
        const existingAccessory = this.accessories.get(uuid);

        if (existingAccessory) {
          this.log.info('Restoring existing light from cache:', existingAccessory.displayName);
          existingAccessory.context = light;
          this.api.updatePlatformAccessories([existingAccessory]);
          const instance = new Lares4PlatformLight(this, existingAccessory);
          this.accessoryInstances.set(uuid, instance);
        } else {
          this.log.info(`Adding new light: ${light.details.ID} - ${light.details.DES}`);
          const accessory = new this.api.platformAccessory(light.details.DES, uuid);
          accessory.context = light;
          const instance = new Lares4PlatformLight(this, accessory);
          this.accessoryInstances.set(uuid, instance);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
        this.discoveredCacheUUIDs.push(uuid);
      } catch (error) {
        this.log.error(`Error configuring light ${light.details.ID}:`, error);
      }
    });

    // Configure covers with error handling
    covers.forEach(cover => {
      try {
        const uuid = this.api.hap.uuid.generate(`${cover.details.ID}-cover`);
        const existingAccessory = this.accessories.get(uuid);

        if (existingAccessory) {
          this.log.info('Restoring existing cover from cache:', existingAccessory.displayName);
          existingAccessory.context = cover;
          this.api.updatePlatformAccessories([existingAccessory]);
          const instance = new Lares4PlatformCover(this, existingAccessory);
          this.accessoryInstances.set(uuid, instance);
        } else {
          this.log.info(`Adding new cover: ${cover.details.ID} - ${cover.details.DES}`);
          const accessory = new this.api.platformAccessory(cover.details.DES, uuid);
          accessory.context = cover;
          const instance = new Lares4PlatformCover(this, accessory);
          this.accessoryInstances.set(uuid, instance);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
        this.discoveredCacheUUIDs.push(uuid);
      } catch (error) {
        this.log.error(`Error configuring cover ${cover.details.ID}:`, error);
      }
    });

    // Configure scenarios with error handling
    scenarios.forEach(scenario => {
      try {
        const uuid = this.api.hap.uuid.generate(`${scenario.details.ID}-scenario`);
        const existingAccessory = this.accessories.get(uuid);

        if (existingAccessory) {
          this.log.info('Restoring existing scenario from cache:', existingAccessory.displayName);
          existingAccessory.context = scenario;
          this.api.updatePlatformAccessories([existingAccessory]);
          const instance = new Lares4PlatformScenario(this, existingAccessory);
          this.accessoryInstances.set(uuid, instance);
        } else {
          this.log.info(`Adding new scenario: ${scenario.details.ID} - ${scenario.details.DES}`);
          const accessory = new this.api.platformAccessory(scenario.details.DES, uuid);
          accessory.context = scenario;
          const instance = new Lares4PlatformScenario(this, accessory);
          this.accessoryInstances.set(uuid, instance);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
        this.discoveredCacheUUIDs.push(uuid);
      } catch (error) {
        this.log.error(`Error configuring scenario ${scenario.details.ID}:`, error);
      }
    });

    // Configure gates with error handling
    gates.forEach(gate => {
      try {
        const uuid = this.api.hap.uuid.generate(`${gate.details.ID}-gate`);
        const existingAccessory = this.accessories.get(uuid);

        if (existingAccessory) {
          this.log.info('Restoring existing gate from cache:', existingAccessory.displayName);
          existingAccessory.context = gate;
          this.api.updatePlatformAccessories([existingAccessory]);
          const instance = new Lares4PlatformScenario(this, existingAccessory);
          this.accessoryInstances.set(uuid, instance);
        } else {
          this.log.info(`Adding new gate: ${gate.details.ID} - ${gate.details.DES}`);
          const accessory = new this.api.platformAccessory(gate.details.DES, uuid);
          accessory.context = gate;
          const instance = new Lares4PlatformScenario(this, accessory);
          this.accessoryInstances.set(uuid, instance);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
        this.discoveredCacheUUIDs.push(uuid);
      } catch (error) {
        this.log.error(`Error configuring gate ${gate.details.ID}:`, error);
      }
    });

    // Configure thermostats with error handling
    thermostats.forEach(thermostat => {
      try {
        const uuid_thermostat = this.api.hap.uuid.generate(`${thermostat.sensor.details.ID}-thermostat`);
        const uuid_sensor = this.api.hap.uuid.generate(`${thermostat.sensor.details.ID}-sensor`);
        const existingThermostat = this.accessories.get(uuid_thermostat);
        const existingSensor = this.accessories.get(uuid_sensor);

        if (existingThermostat) {
          this.log.info('Restoring existing thermostat from cache:', existingThermostat.displayName);
          existingThermostat.context = thermostat;
          this.api.updatePlatformAccessories([existingThermostat]);
          const instance = new Lares4PlatformThermostat(this, existingThermostat);
          this.accessoryInstances.set(uuid_thermostat, instance);
        } else {
          this.log.info(`Adding new thermostat: ${thermostat.sensor.details.ID} - Domus`);
          const accessory = new this.api.platformAccessory(`Domus thermostat ${thermostat.sensor.details.ID}`, uuid_thermostat);
          accessory.context = thermostat;
          const instance = new Lares4PlatformThermostat(this, accessory);
          this.accessoryInstances.set(uuid_thermostat, instance);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
        this.discoveredCacheUUIDs.push(uuid_thermostat);

        if (existingSensor) {
          this.log.info('Restoring existing sensor from cache:', existingSensor.displayName);
          existingSensor.context = thermostat;
          this.api.updatePlatformAccessories([existingSensor]);
          const instance = new Lares4PlatformLightSensor(this, existingSensor);
          this.accessoryInstances.set(uuid_sensor, instance);
        } else {
          this.log.info(`Adding new sensor: ${thermostat.sensor.details.ID} - Light sensor`);
          const accessory = new this.api.platformAccessory(`Domus light sensor ${thermostat.sensor.details.ID}`, uuid_sensor);
          accessory.context = thermostat;
          const instance = new Lares4PlatformLightSensor(this, accessory);
          this.accessoryInstances.set(uuid_sensor, instance);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
        this.discoveredCacheUUIDs.push(uuid_sensor);
      } catch (error) {
        this.log.error(`Error configuring thermostat ${thermostat.sensor.details.ID}:`, error);
      }
    });

    // Remove stale accessories
    for (const [uuid, accessory] of this.accessories) {
      if (!this.discoveredCacheUUIDs.includes(uuid)) {
        this.log.info('Removing existing accessory from cache:', accessory.displayName);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.accessoryInstances.delete(uuid);
      }
    }

    this.log.info(`Successfully configured ${this.discoveredCacheUUIDs.length} accessories`);
  }

  // Public method to check connection status
  public isConnected(): boolean {
    return !!(this.lares4?.initialized && !this.isReconnecting);
  }

  // Public method to get connection health info
  public getConnectionHealth(): object {
    return {
      connected: this.isConnected(),
      reconnectAttempts: this.reconnectAttempts,
      isReconnecting: this.isReconnecting,
      lastHeartbeat: new Date(this.lastHeartbeat).toISOString(),
      timeSinceLastHeartbeat: Date.now() - this.lastHeartbeat,
    };
  }
}
