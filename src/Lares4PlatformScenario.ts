import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import type { Lares4HomebridgePlatform } from './Lares4HomebridgePlatform.js';

import { triggerScenario } from 'lares4-ts';

export class Lares4PlatformScenario {
  private service: Service;

  constructor(
    private readonly platform: Lares4HomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Ksenia')
      .setCharacteristic(this.platform.Characteristic.Model, 'Lares4')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, '12345676');

    this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);

    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.details.DES);

    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.handleGet.bind(this))
      .onSet(this.handleSet.bind(this));
  }

  reset() {
    this.service.updateCharacteristic(this.platform.Characteristic.On, 0);
  }

  handleGet() {
    return 0;
  }

  handleSet(value: CharacteristicValue) {
    if (value === true) {
      this.platform.log.info('Triggering scenario:', this.accessory.context.details.DES);
      triggerScenario(this.platform.lares4!, this.accessory.context.details.ID);
      setTimeout(this.reset.bind(this), 600);
    }
  }
}
