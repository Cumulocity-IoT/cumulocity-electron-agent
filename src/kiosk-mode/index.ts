import { BrowserWindow, session } from "electron";
import { AgentConfig } from "../config";
import { Client, ICredentials } from "@c8y/client";
import { parse } from "set-cookie-parser";

export async function createKioskModeWindow(
  config: AgentConfig,
  credentials: ICredentials
): Promise<BrowserWindow> {
  await performLogin(config, credentials);

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    height: 600,
    webPreferences: {
      //   nodeIntegration: true,
    },
    show: true,
    width: 800,
    alwaysOnTop: true,
    kiosk: false,
    autoHideMenuBar: true,
  });

  // Open the DevTools.
  //   mainWindow.webContents.openDevTools();

  mainWindow.loadURL(
    config.getHTTPUrl() +
      `/apps/cockpit/index.html?hideNavigator=true&noAppSwitcher=true#/device/5113660455/dashboard/8113914388`
  );
  return mainWindow;
}

export async function performLogin(
  config: AgentConfig,
  credentials: ICredentials
) {
  const login = await Client.loginViaOAuthInternal(
    credentials,
    false,
    config.getHTTPUrl()
  );
  
  // cookie parsing could be improved..
  const cookies = login.headers
    .get("set-cookie")
    .split(", ")
    .map((setCookie) => parse(setCookie))
    .reduceRight((prev, curr) => prev.concat(curr), [])
    .filter((tmp) => !!tmp.name);
  const oneCookie = parse(login.headers.get("set-cookie"))[0];
  const adjustedCookies = cookies.map((cookie) => {
    const newCookie: Electron.CookiesSetDetails = {
      url: config.getHTTPUrl(),
      path: cookie.path,
      httpOnly: cookie.name === "authorization",
      secure: true,
      value: cookie.value,
      name: cookie.name,
      expirationDate: oneCookie.expires.getTime() / 1000,
    };
    return newCookie;
  });
  adjustedCookies.forEach((cookie) => {
    session.defaultSession.cookies.set(cookie);
  });
}
