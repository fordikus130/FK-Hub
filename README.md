# FK Hub

![Version](https://img.shields.io/github/v/release/fordik130/fk-hub?style=flat-square&color=blue)
![License](https://img.shields.io/github/license/fordik130/fk-hub?style=flat-square&color=green)

A compact and fast tool for comprehensive Windows optimization and network configuration. Combines useful system tweaks, service management, and junk removal into a single minimalist interface.

---

## 🎉 Support Me

[<img src="https://img.shields.io/badge/DonationAlerts-F58220?style=for-the-badge&logo=donationalerts&logoColor=white" alt="DonationAlerts">](https://www.donationalerts.com/r/fordik130)

---

> [!CAUTION]
> ### Antivirus Warning
> Antiviruses and SmartScreen may falsely flag the application as suspicious due to the lack of a digital signature and interaction with the Windows registry.
> 
> If the program is blocked upon startup:
> 1. Click **"More info"** and select **"Run anyway"**.
> 2. Add the executable file to your antivirus exclusions.
> 
> Always scan files downloaded from the internet using [VirusTotal](https://www.virustotal.com/).

---

## Navigation

- [🚀 Quick Start](#-quick-start)
- [✨ Features](#-features)
- [🛠️ Network & System](#️-network--system)
- [⚙️ System Requirements](#️-system-requirements)

---

## 🚀 Quick Start

Go to the [releases](../../releases) page and download the latest installer:
- `FK Hub Setup x.x.x.exe` (for Windows 10/11 x64)

Upon first launch, the program will automatically request administrator privileges required to modify the registry and configure services. The application is managed through a user-friendly graphical interface.

---

## ✨ Features

- **Performance & Services:** Disable background UWP apps, unnecessary services (`WerSvc`, `MapsBroker`, `Delivery Optimization`), and Edge background startup.
- **Privacy:** Disable telemetry, advertising ID, Copilot AI, and UAC screen dimming.
- **Interface & Explorer:** Enable the classic right-click context menu, show file extensions and hidden folders, and hide unnecessary sidebar items.
- **Gaming & Network:** Disable background GameDVR recording, remove multimedia network throttling, and enable a global high-precision timer.
- **App Management:** One-click removal of preinstalled bloatware.

---

## 🛠️ Network & System

- Create a system restore point before applying tweaks
- Quick Windows activation
- Clear DNS cache and reset network stack (Winsock & IP)
- Quick network latency test (Ping)
- Check system file integrity (`CHKDSK`, `SFC`, `DISM`)
- Install components (`DirectPlay`, `DirectX`, `Visual C++ 2005-2022`)

---

> [!IMPORTANT]
> **Tweaks not applying or settings resetting?**
> Make sure you are running the application as an administrator. Some registry parameters require `SYSTEM`/`Administrator` privileges to successfully modify.

---

## ⚙️ System Requirements

- Built with `electron-builder` powered by Node.js. Build configuration is set via `package.json` with a standard NSIS installer generator.
- **Minimum Supported OS:** Windows 10 / 11 (x64)
