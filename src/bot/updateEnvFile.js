import logger from '../utils/logger.js';
import * as fs from 'node:fs/promises';

async function updateEnvFile(key, value) {
  try {
    const envFilePath = '.env';
    let envData = await fs.readFile(envFilePath, 'utf8');

    const regex = new RegExp('^' + key + '=.*$', 'm');
    if (regex.test(envData)) {
      // If the key exists, replace the line
      envData = envData.replace(regex, key + '=' + value);
    } else {
      // If the key doesn't exist, append it
      envData += `
${key}=${value}`;
    }

    await fs.writeFile(envFilePath, envData, 'utf8');
    logger.info(`.env file updated with new value for \${key}`);
  } catch (error) {
    logger.error(`Error updating .env file: \${error}`);
  }
}

export default updateEnvFile;