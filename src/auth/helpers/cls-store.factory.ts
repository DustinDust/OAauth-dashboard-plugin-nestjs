import { RedisService } from '@liaoliaots/nestjs-redis';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsModuleFactoryOptions } from 'nestjs-cls';
import { LocalFileService } from 'src/auth/services/local-file.service';
import { IClsStore } from '../interfaces/cls-store.interface';
import { clsZod } from './cls-store.zod';

export const clsFactory: (
  ...args: any[]
) => ClsModuleFactoryOptions | Promise<ClsModuleFactoryOptions> = async (
  redisService: RedisService,
  localFileService: LocalFileService,
  configService: ConfigService,
) => {
  const logger = new Logger();
  return {
    middleware: {
      mount: true,
      setup: async (cls) => {
        const configString = await redisService
          .getClient()
          .get(configService.get('REDIS_AUTH_CONFIG_KEY') || 'AUTH_CONFIG');
        if (!configString) {
          logger.log(
            'Fail to retrieve data from redis, procceeding with local config files',
          );
          const data = await localFileService.dataFromFile<IClsStore>(
            `${process.cwd()}/cls.json`,
          );
          console.log(data);
          let zodParsedData;
          try {
            zodParsedData = clsZod.parse(data);
            console.log(zodParsedData);
          } catch (e) {
            logger.error(e);
          }
          await redisService
            .getClient()
            .set(
              configService.get('REDIS_AUTH_CONFIG_KEY') || 'AUTH_CONFIG',
              JSON.stringify(zodParsedData),
            );
          for (const key in zodParsedData) {
            cls.set(key, data[key]);
          }
          return;
        } else {
          const config = JSON.parse(configString);
          let parsedConfig;
          try {
            parsedConfig = clsZod.parse(config);
            console.log(parsedConfig);
          } catch (e) {
            logger.error(e);
          }
          for (const key in parsedConfig) {
            cls.set(key, config[key]);
          }
        }
      },
    },
  };
};
