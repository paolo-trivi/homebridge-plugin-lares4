import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { DateTime } from 'luxon';

import { 
  setThermostatTarget,
  setThermostatMode,
  setThermostatManualTimeout,
  Lares4DomusStatus,
  Lares4ThermostatConfiguration,
  Lares4ThermostatActModes,
  Lares4ThermostatSeasons,
  Lares4ThermostatSeasonConfiguration,
  Lares4SensorStatus,
  Lares4TemperatureStatus,
} from 'lares4-ts';

import { Lares4HomebridgePlatform } from './Lares4HomebridgePlatform.js';

const SEASONS = {
  [Lares4ThermostatSeasons.WINTER]: 'WIN',
  [Lares4ThermostatSeasons.SUMMER]: 'SUM',
};

function getThermostatTimeoutValue(timeoutValue: number): string {
  if (timeoutValue === 0) {
    return '00:00';
  }
  const now = DateTime.now();
  const nearestHour = now.minute >= 30 ? now.hour + 1 : now.hour;
  const target = DateTime.fromObject({ hour: nearestHour }).plus({ hour: timeoutValue });
  return target.toFormat('HH:mm');
}

export class Lares4PlatformThermostat {
  private thermostat: Service;

  constructor(
    private readonly platform: Lares4HomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Ksenia')
      .setCharacteristic(this.platform.Characteristic.Model, 'Lares4')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, '12345671');

    this.thermostat = this.accessory.getService(this.platform.Service.Thermostat) || this.accessory.addService(this.platform.Service.Thermostat);
    this.thermostat.setCharacteristic(this.platform.Characteristic.Name, `Thermostat ${accessory.context.sensor.details.ID}`);

    this.thermostat.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
      .onGet(this.getCurrentHeatingCoolingState.bind(this));

    this.thermostat.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .onGet(this.getTargetHeatingCoolingState.bind(this))
      .onSet(this.setTargetHeatingCoolingState.bind(this))
      .setProps({
        validValues: [
          this.platform.Characteristic.TargetHeatingCoolingState.OFF,
          this.platform.Characteristic.TargetHeatingCoolingState.HEAT,
          this.platform.Characteristic.TargetHeatingCoolingState.COOL,
        ],
      });

    this.thermostat.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    this.thermostat.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this));

    this.platform.lares4?.sensors_status_emitter.subscribe((output_status) => {
      if (output_status.id === this.accessory.context.sensor.id) {
        this.setSensorStatus(output_status.status);
      }
    });

    this.platform.lares4?.temperatures_status_emitter.subscribe((temperature_status) => {
      if (temperature_status.id === this.accessory.context.sensor.id) {
        this.setTemperatureStatus(temperature_status.status);
      }
    });
  }

  setSensorStatus(accessoryStatus: Lares4SensorStatus) {
    const domus = accessoryStatus.DOMUS as Lares4DomusStatus;
    const { TEM, HUM } = domus;
    this.thermostat.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, parseFloat(TEM));
    this.thermostat.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, parseFloat(HUM));
  }

  setTemperatureStatus(temperatureStatus: Lares4TemperatureStatus) {
    const { TEMP, THERM: { ACT_MODEL, ACT_SEA } } = temperatureStatus;
    this.thermostat.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, parseFloat(TEMP));
    
    let targetHeatingCoolingState = this.platform.Characteristic.TargetHeatingCoolingState.OFF;
    let currentHeatingCoolingState = this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
    if (ACT_MODEL !== Lares4ThermostatActModes.OFF) {
      if (ACT_SEA === Lares4ThermostatSeasons.WINTER) {
        currentHeatingCoolingState = this.platform.Characteristic.CurrentHeatingCoolingState.HEAT;
        targetHeatingCoolingState = this.platform.Characteristic.TargetHeatingCoolingState.HEAT;
      }
      if (ACT_SEA === Lares4ThermostatSeasons.SUMMER) {
        currentHeatingCoolingState = this.platform.Characteristic.CurrentHeatingCoolingState.COOL;
        targetHeatingCoolingState = this.platform.Characteristic.TargetHeatingCoolingState.COOL;
      }
    }
    this.thermostat.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState, targetHeatingCoolingState);
    this.thermostat.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState, currentHeatingCoolingState);
  }
  
  getCurrentTemperature(): CharacteristicValue {
    return parseFloat((this.platform.lares4!.status.sensors?.[this.accessory.context.sensor.id].DOMUS as Lares4DomusStatus).TEM);
  }

  getTargetTemperature(): CharacteristicValue {
    const configuration = this.platform.lares4!.configuration.thermostats?.[this.accessory.context.configuration.id] as Lares4ThermostatConfiguration;
    const season = configuration.ACT_SEA as Lares4ThermostatSeasons;
    return parseFloat((configuration[SEASONS[season] as keyof Lares4ThermostatConfiguration] as Lares4ThermostatSeasonConfiguration).TM);
  }

  setTargetTemperature(value: CharacteristicValue) {
    const configuration = this.platform.lares4!.configuration.thermostats?.[this.accessory.context.configuration.id] as Lares4ThermostatConfiguration;
    const season = configuration.ACT_SEA as Lares4ThermostatSeasons;
    setThermostatTarget(this.platform.lares4!, this.accessory.context.configuration.id, season, value as number);
  }

  getCurrentHeatingCoolingState(): CharacteristicValue {
    const configuration = this.platform.lares4!.configuration.thermostats?.[this.accessory.context.configuration.id] as Lares4ThermostatConfiguration;
    const act_mode = configuration.ACT_MODE as Lares4ThermostatActModes;
    const season = configuration.ACT_SEA as Lares4ThermostatSeasons;

    if (act_mode !== Lares4ThermostatActModes.OFF) {
      if (season === Lares4ThermostatSeasons.WINTER) {
        return this.platform.Characteristic.CurrentHeatingCoolingState.HEAT;
      }
      if (season === Lares4ThermostatSeasons.SUMMER) {
        return this.platform.Characteristic.CurrentHeatingCoolingState.COOL;
      }
    }
    return this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
  }

  getTargetHeatingCoolingState(): CharacteristicValue {
    const configuration = this.platform.lares4!.configuration.thermostats?.[this.accessory.context.configuration.id] as Lares4ThermostatConfiguration;
    const act_mode = configuration.ACT_MODE as Lares4ThermostatActModes;
    const season = configuration.ACT_SEA as Lares4ThermostatSeasons;

    if (act_mode !== Lares4ThermostatActModes.OFF) {
      if (season === Lares4ThermostatSeasons.WINTER) {
        return this.platform.Characteristic.TargetHeatingCoolingState.HEAT;
      }
      if (season === Lares4ThermostatSeasons.SUMMER) {
        return this.platform.Characteristic.TargetHeatingCoolingState.COOL;
      }
    }
    return this.platform.Characteristic.TargetHeatingCoolingState.OFF;
  }

  setTargetHeatingCoolingState(value: CharacteristicValue) {
    const timeoutValue = getThermostatTimeoutValue(this.platform.config.thermostatManualTimeout);
    if (value === this.platform.Characteristic.TargetHeatingCoolingState.OFF) {
      setThermostatMode(this.platform.lares4!, this.accessory.context.configuration.details.ID, Lares4ThermostatActModes.OFF);
    } else {
      setThermostatMode(this.platform.lares4!, this.accessory.context.configuration.details.ID, Lares4ThermostatActModes.MANUAL_TIMER);
      setThermostatManualTimeout(this.platform.lares4!, this.accessory.context.configuration.details.ID, timeoutValue);
    }
  }
}
