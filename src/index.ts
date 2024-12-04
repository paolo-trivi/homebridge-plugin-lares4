import type { API } from 'homebridge';

import { Lares4HomebridgePlatform } from './Lares4HomebridgePlatform.js';
import { PLATFORM_NAME } from './settings.js';

/**
 * This method registers the platform with Homebridge
 */
export default (api: API) => {
  api.registerPlatform(PLATFORM_NAME, Lares4HomebridgePlatform);
};
