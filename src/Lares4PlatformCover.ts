import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { observe } from '@nx-js/observer-util';
import { debounceWithLock, rollTo, Lares4OutputStatus } from 'lares4-ts';

import { Lares4HomebridgePlatform } from './Lares4HomebridgePlatform';

function roundPercentage(value: number) {
  return Math.max(Math.round(value / 10)) * 10;
}

const debouncedRollTo = debounceWithLock<typeof rollTo>(rollTo, 500);

export class Lares4PlatformCover {
  private service: Service;

  constructor(
    private readonly platform: Lares4HomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Ksenia')
      .setCharacteristic(this.platform.Characteristic.Model, 'Lares4')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, '12345676');

    this.service = this.accessory.getService(this.platform.Service.Window) || this.accessory.addService(this.platform.Service.Window);

    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.details.DES);

    this.service.getCharacteristic(this.platform.Characteristic.CurrentPosition)
      .onGet(this.getPosition.bind(this));
    
    this.service.getCharacteristic(this.platform.Characteristic.PositionState)
      .onGet(this.getPositionState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetPosition)
      .onGet(this.getTargetPosition.bind(this))
      .onSet(this.setTargetPosition.bind(this));

    this.platform.lares4?.outputs_status_emitter.subscribe((output_status) => {
      if (output_status.id === this.accessory.context.id) {
        this.setStatus(output_status.status);
      }
    });

  }

  setStatus(accessoryStatus: Lares4OutputStatus) {
    const position = accessoryStatus.POS ?? "0";
    const roundedPosition = roundPercentage(Number(position));

    const state = accessoryStatus.STA ?? "";
    let positionState = this.platform.Characteristic.PositionState.STOPPED;
    if (state === "UP") positionState = this.platform.Characteristic.PositionState.INCREASING;
    if (state === "DOWN") positionState = this.platform.Characteristic.PositionState.DECREASING;

    const targetPosition = accessoryStatus.TPOS ?? "0";
    const roundedTargetPosition = roundPercentage(Number(targetPosition));

    this.service.updateCharacteristic(this.platform.Characteristic.CurrentPosition, roundedPosition);
    this.service.updateCharacteristic(this.platform.Characteristic.PositionState, positionState);
    this.service.updateCharacteristic(this.platform.Characteristic.TargetPosition, roundedTargetPosition);
  }

  getPosition(): CharacteristicValue {
    const position = this.platform.lares4!.status.outputs?.[this.accessory.context.id]?.POS ?? "0";
    const roundedPosition = roundPercentage(Number(position));
    return roundedPosition.toString();
  }

  getPositionState(): CharacteristicValue {
    const status = this.platform.lares4!.status.outputs?.[this.accessory.context.id]?.STA ?? "0";
    if (status === "UP") return this.platform.Characteristic.PositionState.INCREASING;
    if (status === "DOWN") return this.platform.Characteristic.PositionState.DECREASING;
    return this.platform.Characteristic.PositionState.STOPPED;
  }

  getTargetPosition(): CharacteristicValue {
    const position = this.platform.lares4!.status.outputs?.[this.accessory.context.id]?.TPOS ?? "0";
    const roundedPosition = roundPercentage(Number(position));
    return roundedPosition.toString();
  }

  

  setTargetPosition(value: CharacteristicValue) {
    try {
      const position = this.platform.lares4!.status.outputs?.[this.accessory.context.id]?.POS ?? "0";
      const timeout = this.platform.config!.coverTimeout * 1000;
      const timeout_percentage = Math.abs(Number(value) - Number(position)) / 100;
      if (position === value) return;
      debouncedRollTo(
        timeout * timeout_percentage,
        this.platform.lares4!,
        this.accessory.context.details.ID,
        Number(value)
      );
    } catch (error) {
      this.platform.log.error(`Failed to set target position: ${error}`);
    }
  }
}
