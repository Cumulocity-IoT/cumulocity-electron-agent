import { Client } from "@c8y/client";
import { MqttClient } from "mqtt";
import {
  NetworkInterfaceInfo,
  networkInterfaces,
  hostname,
  platform,
} from "os";
import { system } from "systeminformation";
import { read, removeFile } from "./file-persistence";
import { logger } from "./logger";

const clientIdFile = "clientId.json";

export function getHostname(): string {
  return hostname();
}

export function getPlatform(): NodeJS.Platform {
  return platform();
}

export function getClientId(): string {
  return readClientIdFromFileOrGenerateIt();
}

function readClientIdFromFileOrGenerateIt(): string {
  let clientId: string = read(clientIdFile);
  if (clientId) {
    // TODO: migration process remove me
    removeFile(clientIdFile);
    return clientId;
  }
  const infos = getPreferredNetworkDetails();
  if (!infos) {
    return null;
  }
  for (const detail of infos.details) {
    if (correctInterfaceDetails(detail, infos.name)) {
      clientId = `${getPlatform()}-${detail.mac.replace(/:/g, "")}`;
      break;
    }
  }
  return clientId ? clientId : null;
}

export function getPreferredNetworkDetails(): {
  name: string;
  details: NetworkInterfaceInfo[];
} {
  const interfaces = networkInterfaces();
  const interfaceNames = Object.keys(interfaces).sort((a, b) =>
    a.localeCompare(b)
  );

  // Preferr eth0 over all other interfaces
  const preferredInterfaceName = "eth0";
  if (interfaceNames.includes(preferredInterfaceName)) {
    const details = interfaces[preferredInterfaceName];
    for (const detail of details) {
      if (correctInterfaceDetails(detail, preferredInterfaceName)) {
        return { name: preferredInterfaceName, details };
      }
    }
  }

  for (const name of interfaceNames) {
    const details = interfaces[name];
    for (const detail of details) {
      if (correctInterfaceDetails(detail, name)) {
        return { name, details };
      }
    }
  }
  return null;
}

function correctInterfaceDetails(
  detail: NetworkInterfaceInfo,
  name: string
): boolean {
  if (
    !name.startsWith("v") &&
    !name.startsWith("V") &&
    detail.mac &&
    detail.mac !== "00:00:00:00:00:00"
  ) {
    return true;
  }
  return false;
}

export function addHardwareInfos(
  client: MqttClient,
  restClient: Client,
  clientId: string
): void {
  createDevice(client, clientId);
  addHardwareModel(client, clientId);
  addSendingInterval(client, 3);
  addAgentDetails(restClient, clientId).catch(() => {
    logger.warn("Failed to add agent details.");
  });
  addFirmwareDetails(client);
}

function addFirmwareDetails(client: MqttClient): void {
  client.publish("s/us", `115,typescript-agent,0.0.1`, {
    qos: 1,
  });
}

async function addAgentDetails(
  restClient: Client,
  clientId: string
): Promise<void> {
  const details = await restClient.identity.detail({
    type: "c8y_Serial",
    externalId: clientId,
  });
  const agentDetailsToAdd = {
    id: `${details.data.managedObject.id}`,
    c8y_Agent: { name: "typescript-agent", version: "0.0.1" },
  };
  await restClient.inventory.update(agentDetailsToAdd);
}

function createDevice(client: MqttClient, clientId: string) {
  client.publish("s/us", `100,${getHostname() || clientId}`, {
    qos: 1,
  });
}

async function addHardwareModel(client: MqttClient, clientId: string) {
  let serial = clientId;
  let model: string = getPlatform();
  let version = "";
  try {
    const systemInfo = await system();
    if (systemInfo.serial && systemInfo.serial.length > 3) {
      serial = systemInfo.serial;
    }
    if (systemInfo.model && systemInfo.model.length > 3) {
      model = systemInfo.model;
    }
    if (systemInfo.version && systemInfo.version.length > 3) {
      version = systemInfo.version;
    }
  } catch (e) {
    logger.warn(`Failed to retrieve system info, falling back to defaults.`);
  }
  client.publish("s/us", `110,"${serial}","${model}","${version}"`, {
    qos: 1,
  });
}

function addSendingInterval(client: MqttClient, sendinInterval: number) {
  client.publish("s/us", `117,${sendinInterval}`, {
    qos: 1,
  });
}
