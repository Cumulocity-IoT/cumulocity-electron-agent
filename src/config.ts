import { read, write } from "./file-persistence";
import { getClientId } from "./hardware";
import { logger } from "./logger";
import {
  httpProtocols,
  IConfiguration,
  mqttProtocols,
} from "./models/configuration";

const platformDomain = "mqtt.cumulocity.com";

export class AgentConfig {
  private readonly configFile = "agent-config.json";
  configuration: IConfiguration;

  constructor() {
    const configuration = read(this.configFile);
    const validConfiguration =
      this.makeSureMandatoryFieldsAreSet(configuration);
    this.configuration = validConfiguration;

    write(this.configuration, this.configFile);
  }

  public getMQTTUrl(): string {
    if (
      this.configuration.mqttProtocol === "ws" ||
      this.configuration.mqttProtocol === "wss"
    ) {
      return `${this.configuration.mqttProtocol}://${this.configuration.domain}:${this.configuration.mqttPort}/mqtt`;
    }
    return `${this.configuration.mqttProtocol}://${this.configuration.domain}:${this.configuration.mqttPort}`;
  }

  public getClientId(): string {
    return this.configuration.clientId;
  }

  public getDomain(): string {
    return this.configuration.domain;
  }

  public getHTTPUrl(): string {
    return `${this.configuration.httpProtocol}://${this.configuration.domain}:${this.configuration.httpPort}`;
  }

  public getValue(key: keyof IConfiguration) {
    return this.configuration[key];
  }

  public setValue(key: keyof IConfiguration, value: unknown) {
    if (this.isValidValueForKey(value, key)) {
      this.configuration[key] = value;
    } else {
      throw Error(`Invalid Value for key: ${key}`);
    }

    write(this.configuration, this.configFile);
  }

  public getWholeConfiguration(): IConfiguration {
    return JSON.parse(JSON.stringify(this.configuration));
  }

  public replaceConfiguration(config: Partial<IConfiguration>) {
    if (!this.allParametersValid(config)) {
      throw Error(
        `At least on parameter of the provided configuration has an invalid value.`
      );
    }

    this.configuration = this.makeSureMandatoryFieldsAreSet(config);
  }

  private allParametersValid(config: Partial<IConfiguration>): boolean {
    for (const key of Object.keys(config)) {
      if (!this.isValidValueForKey(config[key], key)) {
        return false;
      }
    }
    return true;
  }

  private getDefaultConfiguration(): IConfiguration {
    const validDefaultConfiguration: IConfiguration = {
      domain: platformDomain,
      httpPort: 443,
      mqttPort: 8883,
      httpProtocol: "https",
      mqttProtocol: "mqtts",
      clientId: getClientId(),
    };

    const conf: Partial<IConfiguration> = {};
    for (const key of Object.keys(validDefaultConfiguration).sort((a, b) =>
      a.localeCompare(b)
    )) {
      conf[key] = validDefaultConfiguration[key];
    }
    return conf as IConfiguration;
  }

  private makeSureMandatoryFieldsAreSet(
    configuration?: Partial<IConfiguration>
  ): IConfiguration {
    const validDefaultConfiguration = this.getDefaultConfiguration();

    if (!configuration) {
      configuration = {};
    }

    for (const key of Object.keys(configuration).sort((a, b) =>
      a.localeCompare(b)
    )) {
      if (this.isValidValueForKey(configuration[key], key)) {
        validDefaultConfiguration[key] = configuration[key];
      } else {
        logger.warn(
          `Invalid key: ${key} in config with value: ${configuration[key]}, using default value: ${validDefaultConfiguration[key]}`
        );
      }
    }

    write(validDefaultConfiguration, this.configFile);
    return validDefaultConfiguration;
  }

  private isValidPort(port: unknown): boolean {
    return typeof port === "number" && port > 0;
  }

  private isValidStringWithLength(param: unknown): boolean {
    return typeof param === "string" && param.length > 0;
  }

  private isValidProtocolIncludedInList(
    value: unknown,
    list: ReadonlyArray<string>
  ): boolean {
    return typeof value === "string" && list.includes(value);
  }

  private isValidValueForKey(
    value: unknown,
    key: keyof IConfiguration
  ): boolean {
    switch (key) {
      case "domain": {
        return this.isValidStringWithLength(value);
      }
      case "clientId": {
        return this.isValidStringWithLength(value);
      }
      case "httpProtocol": {
        return this.isValidProtocolIncludedInList(value, httpProtocols);
      }
      case "mqttProtocol": {
        return this.isValidProtocolIncludedInList(value, mqttProtocols);
      }
      case "httpPort": {
        return this.isValidPort(value);
      }
      case "mqttPort": {
        return this.isValidPort(value);
      }
      default: {
        return true;
      }
    }
  }
}
