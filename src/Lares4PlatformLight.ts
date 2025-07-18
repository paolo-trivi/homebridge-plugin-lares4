import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import { switchOn, switchOff, dimmerTo, Lares4OutputStatus } from 'lares4-ts';

import type { Lares4HomebridgePlatform } from './Lares4HomebridgePlatform.js';

export class Lares4PlatformLight {
  private service: Service;
  private lastCommandTime = 0;
  private commandThrottle = 500; // 500ms throttle between commands

  constructor(
    private readonly platform: Lares4HomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Ksenia')
      .setCharacteristic(this.platform.Characteristic.Model, 'Lares4')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, '12345678');

    this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);

    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.details.DES);

    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));

    if (
      platform.lares4?.status.outputs?.[accessory.context.id]?.POS
    ) {
      this.service.getCharacteristic(this.platform.Characteristic.Brightness)
        .onSet(this.setLevel.bind(this));
    }

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Setup status update listener with error handling
    try {
      this.platform.lares4?.outputs_status_emitter.subscribe((output_status) => {
        try {
          if (output_status.id === this.accessory.context.id) {
            this.setStatus(output_status.status);
          }
        } catch (error) {
          this.platform.log.error(`Error processing status update for light ${this.accessory.context.id}:`, error);
        }
      });
    } catch (error) {
      this.platform.log.error(`Error setting up event listeners for light ${this.accessory.context.id}:`, error);
    }
  }

  private isCommandAllowed(): boolean {
    const now = Date.now();
    if (now - this.lastCommandTime < this.commandThrottle) {
      this.platform.log.debug(`Command throttled for light ${this.accessory.context.id}`);
      return false;
    }
    this.lastCommandTime = now;
    return true;
  }

  private checkConnection(): boolean {
    if (!this.platform.isConnected()) {
      this.platform.log.warn(`Cannot control light ${this.accessory.context.id} - connection lost`);
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    return true;
  }

  async setOn(value: CharacteristicValue) {
    try {
      this.checkConnection();
      
      if (!this.isCommandAllowed()) {
        return;
      }

      this.platform.log.debug('Set Characteristic On ->', value);

      if (!this.platform.lares4) {
        throw new Error('Lares4 not initialized');
      }

      if (value as boolean) {
        switchOn(this.platform.lares4, this.accessory.context.id);
        this.platform.log.info(`Turned on light: ${this.accessory.context.details.DES}`);
      } else {
        switchOff(this.platform.lares4, this.accessory.context.id);
        this.platform.log.info(`Turned off light: ${this.accessory.context.details.DES}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.platform.log.error(`Failed to set light ${this.accessory.context.id} to ${value}:`, errorMessage);
      
      // Re-throw HAPStatus errors
      if (error instanceof this.platform.api.hap.HapStatusError) {
        throw error;
      }
      
      // Throw a generic service communication failure for other errors
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  async getOn(): Promise<CharacteristicValue> {
    try {
      if (!this.platform.lares4) {
        this.platform.log.warn(`Cannot get status for light ${this.accessory.context.id} - Lares4 not initialized`);
        // Return cached value or default
        const cachedValue = this.service.getCharacteristic(this.platform.Characteristic.On).value;
        return cachedValue !== null ? cachedValue : false;
      }

      const status = this.platform.lares4.getOutputStatus(this.accessory.context.id);
      const isOn = status.STA === '1';
      
      this.platform.log.debug('Get Characteristic On ->', isOn);
      return isOn;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.platform.log.error(`Failed to get status for light ${this.accessory.context.id}:`, errorMessage);
      
      // Return cached value on error
      const cachedValue = this.service.getCharacteristic(this.platform.Characteristic.On).value;
      return cachedValue !== null ? cachedValue : false;
    }
  }

  async setLevel(value: CharacteristicValue) {
    try {
      this.checkConnection();
      
      if (!this.isCommandAllowed()) {
        return;
      }

      this.platform.log.debug('Set Characteristic Brightness ->', value);

      if (!this.platform.lares4) {
        throw new Error('Lares4 not initialized');
      }

      const level = value as number;
      if (level > 0) {
        dimmerTo(this.platform.lares4, this.accessory.context.id, level);
        this.platform.log.info(`Set light brightness: ${this.accessory.context.details.DES} to ${level}%`);
      } else {
        switchOff(this.platform.lares4, this.accessory.context.id);
        this.platform.log.info(`Turned off light: ${this.accessory.context.details.DES}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.platform.log.error(`Failed to set brightness for light ${this.accessory.context.id} to ${value}:`, errorMessage);
      
      // Re-throw HAPStatus errors
      if (error instanceof this.platform.api.hap.HapStatusError) {
        throw error;
      }
      
      // Throw a generic service communication failure for other errors
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  setStatus(status: Lares4OutputStatus) {
    try {
      const isOn = status.STA === '1';
      
      this.service.updateCharacteristic(this.platform.Characteristic.On, isOn);
      
      if (status.POS !== undefined) {
        const brightness = parseInt(status.POS);
        if (!isNaN(brightness)) {
          this.service.updateCharacteristic(this.platform.Characteristic.Brightness, brightness);
          this.platform.log.debug(`Updated light ${this.accessory.context.id} status: on=${isOn}, brightness=${brightness}%`);
        }
      } else {
        this.platform.log.debug(`Updated light ${this.accessory.context.id} status: on=${isOn}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.platform.log.error(`Failed to update status for light ${this.accessory.context.id}:`, errorMessage);
    }
  }

  // Method to refresh the event listeners after reconnection
  public refreshEventListeners(): void {
    this.platform.log.debug(`Refreshing event listeners for light ${this.accessory.context.id}`);
    this.setupEventListeners();
  }
}
