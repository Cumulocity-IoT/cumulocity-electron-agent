import { BasicAuth, Client, ICredentials, ICurrentTenant } from "@c8y/client";
import { logger } from "./logger";
import { bootstrap } from "./bootstrap";
import { read, write } from "./file-persistence";

const defaultCredsFile = "credentials.json";

export function readCredentials(fromFile = defaultCredsFile): ICredentials {
  return read(fromFile);
}

export function writeCredentials(
  creds: ICredentials,
  toFile = defaultCredsFile
): void {
  write(creds, toFile);
}

export function getAuthHeader(): string {
  const credentials = readCredentials();
  return (
    "Basic " +
    Buffer.from(
      `${credentials.tenant}/${credentials.user}:${credentials.password}`
    ).toString("base64")
  );
}

export async function ensureCredentialsAreValid(
  creds: ICredentials,
  httpUrl: string
): Promise<boolean> {
  const restClient = getRestClient(creds, httpUrl);
  let currentTenant: ICurrentTenant;
  while (!currentTenant) {
    try {
      currentTenant = (await restClient.tenant.current()).data;
      return true;
    } catch (e) {
      if (!e || !e.res || !e.res.status) {
        logger.warn(
          `Your network connection does not seems to be ready yet. We will try again in 5 seconds.`
        );
        await new Promise((res) => {
          setTimeout(res, 5_000);
        });
      } else if (
        e &&
        e.res &&
        typeof e.res.status === "number" &&
        (e.res.status > 500 || e.res.status < 400)
      ) {
        logger.warn(
          `Unexpected status code ${e.res.status}. We will try again in 30 seconds.`
        );
        await new Promise((res) => {
          setTimeout(res, 30_000);
        });
      } else if (
        e &&
        e.res &&
        e.res.status === 401 &&
        e.data &&
        e.data.message &&
        typeof e.data.message === "string" &&
        e.data.message.includes("locked")
      ) {
        logger.warn(
          `Your current credentials are locked, please unlock them. In 30 seconds we will check again if they are unlocked again.`
        );
        await new Promise((res) => {
          setTimeout(res, 30_000);
        });
      } else if (
        e &&
        e.res &&
        typeof e.res.status === "number" &&
        e.res.status < 500 &&
        e.res.status >= 400
      ) {
        logger.warn(e);
        logger.warn(
          `Your credentials do not seem to be valid, falling back to bootstrap mode.`
        );
        break;
      }
    }
  }

  return false;
}

export function getRestClient(creds: ICredentials, httpUrl: string): Client {
  return new Client(new BasicAuth(creds), `${httpUrl}`);
}

export async function getOrRequestCredentials(
  clientId: string,
  httpUrl: string,
  platformUrl: string
): Promise<ICredentials> {
  let credentials = readCredentials();
  if (credentials) {
    logger.info(
      `Loaded credentials from disk for tenant: ${credentials.tenant}, user: ${credentials.user}`
    );
    const valid = await ensureCredentialsAreValid(credentials, httpUrl);
    if (!valid) {
      logger.info(
        `Stored credentials are no longer valid, returning to bootstrap mode.`
      );
      credentials = null;
    }
  }
  if (!credentials) {
    credentials = await bootstrap(clientId, platformUrl);
    logger.info(
      `Received credentials for tenant: ${credentials.tenant}, user: ${credentials.user}, persisting them..`
    );
    writeCredentials(credentials);
  }
  return credentials;
}
