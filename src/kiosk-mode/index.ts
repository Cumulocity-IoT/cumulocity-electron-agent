import { BrowserWindow, session } from "electron";
import { AgentConfig } from "../config";
import { BasicAuth, Client, ICredentials } from "@c8y/client";
import { parse, splitCookiesString } from "set-cookie-parser";

export async function createKioskModeWindow(
  config: AgentConfig,
  credentials: ICredentials
): Promise<BrowserWindow> {
  const { baseUrl, basicAuthClient } = await performLogin(config, credentials);
  let path = `/apps/cockpit/?hideNavigator=true&noAppSwitcher=true`;
  try {
    const { data: details } = await basicAuthClient.identity.detail({
      type: "c8y_Serial",
      externalId: config.getClientId(),
    });
    const deviceId = details.managedObject?.id;
    path = `/apps/cockpit/?hideNavigator=true&noAppSwitcher=true#/device/${deviceId}/`;
  } catch (e) {
    // did not find existing device
  }

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    height: 600,
    webPreferences: {
      //   nodeIntegration: true,
    },
    show: true,
    width: 800,
    alwaysOnTop: true,
    kiosk: true,
    autoHideMenuBar: true,
  });

  // Open the DevTools.
  //   mainWindow.webContents.openDevTools();

  mainWindow.loadURL(baseUrl + path);
  return mainWindow;
}

// config.getHTTPUrl() might point to some different url than the actual tenant
export async function getBaseUrl(
  config: AgentConfig,
  credentials: ICredentials
) {
  const basicAuthClient = new Client(
    new BasicAuth(credentials),
    config.getHTTPUrl()
  );
  const { data: currentTenant } = await basicAuthClient.tenant.current();
  return { baseUrl: `https://${currentTenant.domainName}`, basicAuthClient };
}

export async function performLogin(
  config: AgentConfig,
  credentials: ICredentials
) {
  const { baseUrl, basicAuthClient } = await getBaseUrl(config, credentials);
  const login = await Client.loginViaOAuthInternal(credentials, false, baseUrl);

  const cookies = parse(splitCookiesString(login.headers.get("set-cookie")));
  const adjustedCookies = cookies.map((cookie) => {
    const newCookie: Electron.CookiesSetDetails = {
      url: baseUrl,
      path: cookie.path,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      domain: cookie.domain,
      value: cookie.value,
      name: cookie.name,
      expirationDate: cookie.expires.getTime() / 1000,
    };
    return newCookie;
  });
  adjustedCookies.forEach((cookie) => {
    session.defaultSession.cookies.set(cookie);
  });

  return { baseUrl, basicAuthClient };
}
