# cumulocity-electron-agent

A Cumulocity agent in an electron application. This is agent is not production ready and was just created for demo purposes.
The agent was packaged as an electron app to allow using Chromium for WebRTC video streaming.

## Supported operations

This agent supports the follwing operations:

- c8y_Restart
- c8y_RemoteAccessConnect
- c8y_LogfileRequest
- c8y_Configuration
- c8y_Command

In addition the `c8y_Webcam` operation has been added for testing. The implementation for `c8y_Webcam` might change in the future.

## Confirmed working hardware

- Raspberry Pi 4 running Ubuntu 22.04 Desktop (arm64)
- USB Webcam (Logitech C925e)

The agent also runs just fine on normal laptops using their integrated cameras.
Cameras connected via CSI to the Raspberry Pi have not been tested yet.

## Installation instructions (Raspberry Pi)

- Download Ubuntu Desktop 22.04 (64-bit) [here](https://ubuntu.com/download/raspberry-pi)
- Flash it using e.g. [Balena etcher](https://www.balena.io/etcher) onto an sd card
- Bootup the pi and set it up (configure `ubuntu` as the username during setup)
- Install an ssh server in case you want it: `sudo apt install openssh-server`
- Download the latest deb package of the agent for arm64
- Install the agent using: `dpkg -i cumulocity-electron-agent_<version>_arm64.deb`
- To be able to run the agent via ssh or in a systemd service, install xvfb using `sudo apt install xvfb`
- You should now be able to start the agent using `xvfb-run cumulocity-electron-agent`
  Once the agent started up, you should see a logline like:

```
Starting bootstrap process against tenant: wss://mqtt.cumulocity.com:443/mqtt
```

- In case you would like to run the agent against a different tenant, you can adjust the config using `nano ./cfg/agent-config.json` and restart the agent.
- The device is now in bootstrapping mode and you can get it's client id from the logline:

```
Connected for bootstrapping using clientId: linux-<mac>
```

- You can now register the device using Cumulocity's usual bootstrapping process
- You can add the [cumulocity-electron-agent.service](./cumulocity-electron-agent.service) to run the agent as a systemd service in the background.

For the webcam UI install the [webrtc plugin](https://github.com/SoftwareAG/cumulocity-webrtc-webcam-plugin).

## Useful links 

📘 Explore the Knowledge Base   
Dive into a wealth of Cumulocity IoT tutorials and articles in our [Tech Community Knowledge Base](https://tech.forums.softwareag.com/tags/c/knowledge-base/6/cumulocity-iot).  

💡 Get Expert Answers    
Stuck or just curious? Ask the Cumulocity IoT experts directly on our [Forum](https://tech.forums.softwareag.com/tags/c/forum/1/Cumulocity-IoT).   

🚀 Try Cumulocity IoT    
See Cumulocity IoT in action with a [Free Trial](https://techcommunity.softwareag.com/en_en/downloads.html).   

✍️ Share Your Feedback    
Your input drives our innovation. If you find a bug, please create an issue in the repository. If you’d like to share your ideas or feedback, please post them [here](https://tech.forums.softwareag.com/c/feedback/2). 

More to discover 
* [How to install a Microfrontend Plugin on a tenant and use it in an app?](https://tech.forums.softwareag.com/t/how-to-install-a-microfrontend-plugin-on-a-tenant-and-use-it-in-an-app/268981)  
* [Cumulocity IoT Web Development Tutorial - Part 1: Start your journey](https://tech.forums.softwareag.com/t/cumulocity-iot-web-development-tutorial-part-1-start-your-journey/259613) 
* [The power of micro frontends – How to dynamically extend Cumulocity IoT Frontends](https://tech.forums.softwareag.com/t/the-power-of-micro-frontends-how-to-dynamically-extend-cumulocity-iot-frontends/266665)  

---

This tools are provided as-is and without warranty or support. They do not constitute part of the Software AG product suite. Users are free to use, fork and modify them, subject to the license agreement. While Software AG welcomes contributions, we cannot guarantee to include every contribution in the master project.
