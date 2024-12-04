import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import { switchOn, switchOff, dimmerTo, Lares4OutputStatus } from 'lares4-ts';

import type { Lares4HomebridgePlatform } from './Lares4HomebridgePlatform.js';

export class Lares4PlatformLight {
  private service: Service;

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

    this.platform.lares4?.outputs_status_emitter.subscribe((output_status) => {
      if (output_status.id === this.accessory.context.id) {
        this.setStatus(output_status.status);
      }
    });
  }

  setStatus(accessoryStatus: Lares4OutputStatus) {
    const state = accessoryStatus.STA ?? "OFF";
    const level = accessoryStatus.POS ?? undefined;

    this.service.updateCharacteristic(this.platform.Characteristic.On, state === 'ON');
    if (level) this.service.updateCharacteristic(this.platform.Characteristic.Brightness, level);
  }

  setOn(value: CharacteristicValue) {
    if (value) switchOn(this.platform.lares4!, this.accessory.context.details.ID);
    else switchOff(this.platform.lares4!, this.accessory.context.details.ID);
  }

  getOn(): CharacteristicValue {
    return this.platform.lares4!.status.outputs?.[this.accessory.context.id]?.STA === 'ON';
  }

  setLevel(value: CharacteristicValue) {
    dimmerTo(this.platform.lares4!, this.accessory.context.details.ID, Number(value));
  }
}
