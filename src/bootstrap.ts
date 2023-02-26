import { ICredentials } from "@c8y/client";
import { schedule, ScheduledTask } from "node-cron";
import * as mqtt from "mqtt";
import { readCredentials, writeCredentials } from "./credentials";
import { logger } from "./logger";

export async function bootstrap(
  clientId: string,
  platformUrl: string
): Promise<ICredentials> {
  logger.info(`Starting bootstrap process against tenant: ${platformUrl}`);
  const bootstrapCreds = getBootstrapCredentials();
  return new Promise((res) => {
    let task: ScheduledTask;
    const bootstrapClient = mqtt.connect(platformUrl, {
      username: `${bootstrapCreds.tenant}/${bootstrapCreds.user}`,
      password: `${bootstrapCreds.password}`,
      clientId,
    });
    bootstrapClient.on("message", function (topic, message) {
      // message is Buffer
      const msg = String(message);
      if (topic === "s/dcr" && msg.startsWith("70,")) {
        if (task) {
          task.stop();
        }
        bootstrapClient.end(true, {}, function () {
          const credsCSV = msg.replace("70,", "").split(",");
          const creds: ICredentials = {
            tenant: credsCSV[0],
            user: credsCSV[1],
            password: credsCSV[2],
          };
          res(creds);
        });
      }
    });
    bootstrapClient.on("error", (e) => {
      logger.error(e);
    });
    bootstrapClient.on("outgoingEmpty", () => {
      logger.error("offline");
    });
    bootstrapClient.on("connect", function () {
      logger.info(`Connected for bootstrapping using clientId: ${clientId}`);
      bootstrapClient.subscribe("s/dcr", function (err) {
        if (!err && !task) {
          task = schedule("*/10 * * * * *", () => {
            logger.info(`Requesting credentials for clientId: ${clientId}`);
            bootstrapClient.publish("s/ucr", "");
          });
        }
      });
    });
  });
}

function getBootstrapCredentials(): ICredentials {
  const bootstrapFile = "./bootstrap-credentials.json";
  let creds: ICredentials = readCredentials(bootstrapFile);
  if (!creds || !creds.password || !creds.user || !creds.tenant) {
    creds = {
      tenant: "management",
      user: "devicebootstrap",
      password: "Fhdt1bb1f",
    };
    writeCredentials(creds, bootstrapFile);
  }
  return creds;
}
