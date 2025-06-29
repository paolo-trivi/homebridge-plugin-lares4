import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';
import { Lares4, Lares4Factory } from 'lares4-ts';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

import { Lares4PlatformLight } from './Lares4PlatformLight.js';
import { Lares4PlatformCover } from './Lares4PlatformCover.js';
import { Lares4PlatformScenario } from './Lares4PlatformScenario.js';
import { Lares4PlatformThermostat } from './Lares4PlatformThermostat.js';
import { Lares4PlatformLightSensor } from './Lares4PlatformLightSensor.js';

export class Lares4HomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  public readonly accessories: Map<string, PlatformAccessory> = new Map();
  public readonly discoveredCacheUUIDs: string[] = [];

  lares4?: Lares4;

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

    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', async () => {
      log.debug('Executed didFinishLaunching callback');

      try {
        log.info('Start to initialize Lares4');
        this.lares4 = await Lares4Factory.createLares4(
          this.config.sender,
          this.config.ip,
          this.config.pin,
          this.config.https, // Default to true if not specified
          this.log,
        );

        if (this.lares4.initialized) {
          this.log.info('Lares4 initialized');
          this.configureLares4Accessories();
        }
      } catch (error) {
        if (error instanceof Error) {
          this.log.error(error?.message ?? error); 
        };
        return;
      }
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.set(accessory.UUID, accessory);
  }

  configureLares4Accessories() {
    const bulbs = this.lares4?.lights || [];
    const dimmers = this.lares4?.dimmers || [];
    const lights = [ ...bulbs, ...dimmers ];

    const covers = this.lares4?.shutters || [];

    const scenarios = this.lares4?.scenarios || [];

    const thermostats = this.lares4?.thermostats || [];

    const gates = this.lares4?.gates || [];

    lights.forEach(light => {
      const uuid = this.api.hap.uuid.generate(`${light.details.ID}-light`);
      const existingAccessory = this.accessories.get(uuid);

      if (existingAccessory) {
        this.log.info('Restoring existing light from cache:', existingAccessory.displayName);
        existingAccessory.context = light;
        this.api.updatePlatformAccessories([existingAccessory]);
        new Lares4PlatformLight(this, existingAccessory);
      } else {
        this.log.info(`Adding new light: ${light.details.ID} - ${light.details.DES}`);
        const accessory = new this.api.platformAccessory(light.details.DES, uuid);
        accessory.context = light;
        new Lares4PlatformLight(this, accessory);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
      this.discoveredCacheUUIDs.push(uuid);
    });

    covers.forEach(cover => {
      const uuid = this.api.hap.uuid.generate(`${cover.details.ID}-cover`);
      const existingAccessory = this.accessories.get(uuid);

      if (existingAccessory) {
        this.log.info('Restoring existing cover from cache:', existingAccessory.displayName);
        existingAccessory.context = cover;
        this.api.updatePlatformAccessories([existingAccessory]);
        new Lares4PlatformCover(this, existingAccessory);
      } else {
        this.log.info(`Adding new cover: ${cover.details.ID} - ${cover.details.DES}`);
        const accessory = new this.api.platformAccessory(cover.details.DES, uuid);
        accessory.context = cover;
        new Lares4PlatformCover(this, accessory);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
      this.discoveredCacheUUIDs.push(uuid);
    });

    scenarios.forEach(scenario => {
      const uuid = this.api.hap.uuid.generate(`${scenario.details.ID}-scenario`);
      const existingAccessory = this.accessories.get(uuid);

      if (existingAccessory) {
        this.log.info('Restoring existing scenario from cache:', existingAccessory.displayName);
        existingAccessory.context = scenario;
        this.api.updatePlatformAccessories([existingAccessory]);
        new Lares4PlatformScenario(this, existingAccessory);
      } else {
        this.log.info(`Adding new scenario: ${scenario.details.ID} - ${scenario.details.DES}`);
        const accessory = new this.api.platformAccessory(scenario.details.DES, uuid);
        accessory.context = scenario;
        new Lares4PlatformScenario(this, accessory);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
      this.discoveredCacheUUIDs.push(uuid);
    });

    gates.forEach(gate => {
      const uuid = this.api.hap.uuid.generate(`${gate.details.ID}-gate`);
      const existingAccessory = this.accessories.get(uuid);

      if (existingAccessory) {
        this.log.info('Restoring existing gate from cache:', existingAccessory.displayName);
        existingAccessory.context = gate;
        this.api.updatePlatformAccessories([existingAccessory]);
        new Lares4PlatformScenario(this, existingAccessory);
      } else {
        this.log.info(`Adding new scenario: ${gate.details.ID} - ${gate.details.DES}`);
        const accessory = new this.api.platformAccessory(gate.details.DES, uuid);
        accessory.context = gate;
        new Lares4PlatformScenario(this, accessory);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
      this.discoveredCacheUUIDs.push(uuid);
    });

    thermostats.forEach(thermostat => {
      const uuid_thermostat = this.api.hap.uuid.generate(`${thermostat.sensor.details.ID}-thermostat`);
      const uuid_sensor = this.api.hap.uuid.generate(`${thermostat.sensor.details.ID}-sensor`);
      const existingThermostat = this.accessories.get(uuid_thermostat);
      const existingSensor = this.accessories.get(uuid_sensor);

      if (existingThermostat) {
        this.log.info('Restoring existing thermostat from cache:', existingThermostat.displayName);
        existingThermostat.context = thermostat;
        this.api.updatePlatformAccessories([existingThermostat]);
        new Lares4PlatformThermostat(this, existingThermostat);
      } else {
        this.log.info(`Adding new thermostat: ${thermostat.sensor.details.ID} - Domus`);
        const accessory = new this.api.platformAccessory(`Domus thermostat ${thermostat.sensor.details.ID}`, uuid_thermostat);
        accessory.context = thermostat;
        new Lares4PlatformThermostat(this, accessory);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
      this.discoveredCacheUUIDs.push(uuid_thermostat);

      if (existingSensor) {
        this.log.info('Restoring existing sensor from cache:', existingSensor.displayName);
        existingSensor.context = thermostat;
        this.api.updatePlatformAccessories([existingSensor]);
        new Lares4PlatformLightSensor(this, existingSensor);
      } else {
        this.log.info(`Adding new sensor: ${thermostat.sensor.details.ID} - Light sensor`);
        const accessory = new this.api.platformAccessory(`Domus light sensor ${thermostat.sensor.details.ID}`, uuid_sensor);
        accessory.context = thermostat;
        new Lares4PlatformLightSensor(this, accessory);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
      this.discoveredCacheUUIDs.push(uuid_sensor);
    });

    for (const [uuid, accessory] of this.accessories) {
      if (!this.discoveredCacheUUIDs.includes(uuid)) {
        this.log.info('Removing existing accessory from cache:', accessory.displayName);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }
}
