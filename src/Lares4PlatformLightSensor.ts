import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import { Lares4SensorStatus, Lares4DomusStatus } from 'lares4-ts';

import type { Lares4HomebridgePlatform } from './Lares4HomebridgePlatform.js';

export class Lares4PlatformLightSensor {
  private service: Service;

  constructor(
    private readonly platform: Lares4HomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Ksenia')
      .setCharacteristic(this.platform.Characteristic.Model, 'Lares4')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, '12345672');

    this.service = this.accessory.getService(this.platform.Service.LightSensor) || this.accessory.addService(this.platform.Service.LightSensor);
    this.service.setCharacteristic(this.platform.Characteristic.Name, `Thermostat ${accessory.context.sensor.details.ID}`);

    this.service.getCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel)
      .onGet(this.getCurrentAmbientLightLevel.bind(this));

    this.platform.lares4?.sensors_status_emitter.subscribe((sensor_status) => {
      if (sensor_status.id === this.accessory.context.sensor.id) {
        this.setStatus(sensor_status.status);
      }
    });
  }

  setStatus(accessoryStatus: Lares4SensorStatus) {
    const lht = (accessoryStatus.DOMUS as Lares4DomusStatus)?.LHT ?? 0.1;
    this.service.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, Math.max(parseFloat(lht), 0.1));
  }

  getCurrentAmbientLightLevel(): CharacteristicValue {
    return Math.max(parseFloat((this.platform.lares4!.status.sensors?.[this.accessory.context.sensor.id].DOMUS as Lares4DomusStatus).LHT) ?? 0.1, 0.1);
  }
}
