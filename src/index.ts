import { app } from "electron";
import * as dotenv from "dotenv";
import * as mqtt from "mqtt";
import { getOrRequestCredentials, getRestClient } from "./credentials";
import { addHardwareInfos } from "./hardware";
import { setupMeasurementScheduler } from "./measurements";
import { logger } from "./logger";
import { registerListenerForOperations } from "./operations";
import { AgentConfig } from "./config";
import { AgentStatus, createStatusEvent } from "./event";
import { createKioskModeWindow } from "./kiosk-mode";

Object.assign(global, { WebSocket: require("ws") });

const platformTopicsToSubscribe = [
  "s/dt",
  "s/e",
  "s/dc/#",
  "error",
  "notification/operations",
  "devicecontrol/notifications",
  "notification/realtime",
];

dotenv.config();

async function start() {
  const config = new AgentConfig();
  const clientId = config.getClientId();
  const httpUrl = config.getHTTPUrl();
  const mqttUrl = config.getMQTTUrl();
  if (!clientId) {
    process.exit(1);
  }
  const credentials = await getOrRequestCredentials(clientId, httpUrl, mqttUrl);

  const restClient = getRestClient(credentials, httpUrl);

  const mqttClient = mqtt.connect(mqttUrl, {
    username: `${credentials.tenant}/${credentials.user}`,
    password: `${credentials.password}`,
    clientId,
  });
  mqttClient.on("connect", function () {
    createStatusEvent(mqttClient, AgentStatus.STARTUP);
    logger.info("connected to platform");
    platformTopicsToSubscribe.forEach((topic) => {
      mqttClient.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          logger.error(`failed to subscribe on platform to ${topic}`);
        }
      });
    });

    addHardwareInfos(mqttClient, restClient, clientId);
    createKioskModeWindow(config, credentials);
  });
  setupMeasurementScheduler(mqttClient, config);

  mqttClient.on("packetreceive", (packet) => {
    logger.debug(`Packet received: ${packet.cmd}: ${packet.messageId}`);
  });

  mqttClient.on("reconnect", () => {
    createStatusEvent(mqttClient, AgentStatus.RECONNECT);
  });

  mqttClient.on("disconnect", () => {
    createStatusEvent(mqttClient, AgentStatus.DISCONNECT);
  });

  mqttClient.on("close", () => {
    createStatusEvent(mqttClient, AgentStatus.CLOSE);
  });

  mqttClient.on("error", (e) => {
    const errorAsAny = e as any;
    if (errorAsAny && errorAsAny["code"] === 5) {
      process.exit(5);
    }
    logger.error(JSON.stringify(e));
    createStatusEvent(mqttClient, AgentStatus.ERROR);
  });

  registerListenerForOperations(mqttClient, restClient, config);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", start);

// Prevents the process from exiting when all electron windows are closed..
app.on("window-all-closed", () => {
  logger.info("All electron windows closed.");
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
