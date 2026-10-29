const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');

process.on('uncaughtException', (err) => {
    try { dialog.showErrorBox('Ошибка запуска FK Hub', err.stack || String(err)); } catch {}
});

function ensureAdmin() {
    if (app.isPackaged) return true;
    try {
        execSync('net session >nul 2>&1');
        return true;
    } catch {
        const exe = process.execPath.replace(/'/g, "''");
        const psCmd = `Start-Process -FilePath '${exe}' -ArgumentList '"${app.getAppPath().replace(/'/g, "''")}"' -Verb RunAs`;
        exec(`powershell -NoProfile -Command "${psCmd}"`, () => app.quit());
        return false;
    }
}

let win;

function runCmd(cmd) {
    return new Promise((resolve) => {
        exec(`chcp 65001 >nul & ${cmd}`, { encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024 * 10 }, (err, stdout) => {
            resolve({ ok: !err, out: stdout ? stdout.trim() : '' });
        });
    });
}

function runPS(script) {
    const psFile = path.join(os.tmpdir(), `fkhub_ps_${Date.now()}_${Math.random().toString(36).slice(2)}.ps1`);
    const content = `\uFEFF$ProgressPreference = 'SilentlyContinue'\r\n$ErrorActionPreference = 'SilentlyContinue'\r\n[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\r\n` + script;
    fs.writeFileSync(psFile, content, { encoding: 'utf8' });
    return new Promise((resolve) => {
        exec(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${psFile}"`, { encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024 * 10 }, (err, stdout) => {
            try { fs.unlinkSync(psFile); } catch {}
            resolve({ ok: !err, out: stdout ? stdout.trim() : '' });
        });
    });
}

function openConsoleBatch(name, lines) {
    const batPath = path.join(os.tmpdir(), `fkhub_${name}.bat`);
    const content = [
        '@echo off',
        'chcp 65001 >nul',
        'title FK Hub',
        ...lines,
        'echo.',
        'pause'
    ].join('\r\n');
    fs.writeFileSync(batPath, content, { encoding: 'utf8' });
    exec(`start "FK Hub" cmd.exe /c "${batPath}"`);
    return { ok: true };
}

function restartExplorer() {
    return new Promise((resolve) => {
        exec('taskkill /f /im explorer.exe', { windowsHide: true }, () => {
            setTimeout(() => {
                exec('start explorer.exe', { windowsHide: true }, () => {
                    setTimeout(resolve, 600);
                });
            }, 400);
        });
    });
}

app.whenReady().then(() => {
    if (!ensureAdmin()) return;

    win = new BrowserWindow({
        width: 1040,
        height: 720,
        minWidth: 940,
        minHeight: 620,
        frame: false,
        show: true,
        title: 'FK Hub',
        backgroundColor: '#121212',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            sandbox: false
        }
    });
    win.loadFile(path.join(__dirname, 'index.html'));
});

ipcMain.on('win-min', () => win && win.minimize());
ipcMain.on('win-close', () => app.quit());
ipcMain.on('open-donate', () => shell.openExternal('https://www.donationalerts.com/r/fordik130'));

async function getRegistryAndSystemStatus() {
    const queries = [
        ['uwp1', 'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications" /v GlobalUserDisabled /reg:64'],
        ['uwp2', 'reg query "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\AppPrivacy" /v LetAppsRunInBackground /reg:64'],
        ['do', 'reg query "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization" /v DODownloadMode /reg:64'],
        ['edge', 'reg query "HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge" /v StartupBoostEnabled /reg:64'],
        ['hiber', 'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power" /v HibernateEnabled /reg:64'],
        ['telem', 'reg query "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" /v AllowTelemetry /reg:64'],
        ['c1', 'reg query "HKCU\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot" /v TurnOffWindowsCopilot /reg:64'],
        ['c2', 'reg query "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsCopilot" /v TurnOffWindowsCopilot /reg:64'],
        ['c3', 'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v ShowCopilotButton /reg:64'],
        ['uac', 'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v PromptOnSecureDesktop /reg:64'],
        ['delay', 'reg query "HKCU\\Control Panel\\Desktop" /v MenuShowDelay /reg:64'],
        ['wall', 'reg query "HKCU\\Control Panel\\Desktop" /v JPEGImportQuality /reg:64'],
        ['rec1', 'reg query "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Explorer" /v HideRecommendedSection /reg:64'],
        ['rec2', 'reg query "HKCU\\Software\\Policies\\Microsoft\\Windows\\Explorer" /v HideRecommendedSection /reg:64'],
        ['mouse', 'reg query "HKCU\\Control Panel\\Mouse" /v MouseSpeed /reg:64'],
        ['sticky', 'reg query "HKCU\\Control Panel\\Accessibility\\StickyKeys" /v Flags /reg:64'],
        ['dvr', 'reg query "HKCU\\System\\GameConfigStore" /v GameDVR_Enabled /reg:64'],
        ['net', 'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v NetworkThrottlingIndex /reg:64'],
        ['timer', 'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\kernel" /v GlobalTimerResolutionRequests /reg:64'],
        ['loc', 'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v LaunchTo /reg:64'],
        ['homeNS', 'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Desktop\\NameSpace\\{f874310e-b6b7-47dc-bc84-b9e6b38f5903}" /reg:64'],
        ['galNS', 'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Desktop\\NameSpace\\{e88865ea-0e1c-4e20-9aa6-edcd0212c87c}" /reg:64'],
        ['netEnum1', 'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\NonEnum" /v "{F02C1A0D-BE21-4350-88B0-7367FC96EF3C}" /reg:64'],
        ['netEnum2', 'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\NonEnum" /v "{F02C1A0D-BE21-4350-88B0-7367FC96EF3C}" /reg:64'],
        ['prv', 'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer" /v ShowRecent /reg:64'],
        ['ctx', 'reg query "HKCU\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32" /reg:64'],
        ['ext', 'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v HideFileExt /reg:64'],
        ['hid', 'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v Hidden /reg:64'],
        ['b1', 'reg query "HKCU\\Software\\Policies\\Microsoft\\Windows\\Explorer" /v DisableSearchBoxSuggestions /reg:64'],
        ['b2', 'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search" /v BingSearchEnabled /reg:64']
    ];

    const batchCmd = queries.map(([k, q]) => `echo ___${k}___ & ${q} 2>nul`).join(' & ');
    const res = await runCmd(batchCmd);
    const raw = {};

    const parts = res.out.split(/___([a-zA-Z0-9_]+)___/);
    for (let i = 1; i < parts.length; i += 2) {
        raw[parts[i]] = (parts[i + 1] || '').trim();
    }

    const dword = (k) => {
        const s = raw[k] || '';
        const m = s.match(/REG_(?:DWORD|QWORD)\s+0x([0-9a-fA-F]+)/i);
        return m ? parseInt(m[1], 16) : null;
    };

    const sz = (k) => {
        const s = raw[k] || '';
        const m = s.match(/REG_SZ\s+([^\r\n]+)/i);
        return m ? m[1].trim() : null;
    };

    const exists = (k) => Boolean(raw[k] && raw[k].includes('HKEY_'));

    const copOff = (dword('c1') === 1 || dword('c2') === 1 || dword('c3') === 0);
    const netVal = dword('net');

    const opt = {
        uwp: dword('uwp1') === 1 || dword('uwp2') === 2,
        do: dword('do') === 0,
        edge: dword('edge') === 0,
        hiber: dword('hiber') === 0,
        telem: dword('telem') === 0,
        copilot: copOff,
        uac: dword('uac') === 0,
        delay: sz('delay') === '20',
        wall: dword('wall') === 100,
        rec: dword('rec1') === 1 || dword('rec2') === 1,
        mouse: sz('mouse') === '0',
        sticky: sz('sticky') === '506',
        dvr: dword('dvr') === 0,
        net: netVal === 0xffffffff || netVal === 4294967295,
        timer: dword('timer') === 1
    };

    const exp = {
        loc: dword('loc') === 1,
        home: !exists('homeNS'),
        gal: !exists('galNS'),
        netw: dword('netEnum1') === 1 || dword('netEnum2') === 1,
        prv: dword('prv') === 0,
        ctx: exists('ctx'),
        ext: dword('ext') === 0,
        hid: dword('hid') === 1
    };

    return {
        opt,
        exp,
        copOff,
        bingOff: dword('b1') === 1 || dword('b2') === 0
    };
}

ipcMain.handle('get-status', async (e, includeBloat = true) => {
    const base = await getRegistryAndSystemStatus();
    const result = { opt: base.opt, exp: base.exp };

    if (includeBloat) {
        const appx = await runPS(`(Get-AppxPackage).Name -join '|'`);
        const n = appx.out || '';
        const has = (rx) => new RegExp(rx, 'i').test(n);

        result.bloat = {
            cam: has('Microsoft\\.WindowsCamera'),
            dev: has('Microsoft\\.Windows\\.DevHome'),
            cop: !base.copOff && has('Microsoft\\.Copilot|Windows\\.Ai'),
            bing: !base.bingOff,
            clip: has('Clipchamp'),
            news: has('BingNews'),
            teams: has('MSTeams|MicrosoftTeams'),
            todo: has('Todos'),
            outlook: has('OutlookForWindows'),
            power: has('PowerAutomateDesktop'),
            quick: has('QuickAssist'),
            snotes: has('MicrosoftStickyNotes'),
            feed: has('WindowsFeedbackHub'),
            voice: has('WindowsSoundRecorder'),
            calc: has('WindowsCalculator'),
            snip: has('ScreenSketch')
        };
    }

    return result;
});

ipcMain.handle('toggle-opt', async (e, id, val) => {
    const cmds = {
        uwp: val ? `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications" /v GlobalUserDisabled /t REG_DWORD /d 1 /f /reg:64 & reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search" /v BackgroundAppGlobalToggle /t REG_DWORD /d 0 /f /reg:64 & reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\AppPrivacy" /v LetAppsRunInBackground /t REG_DWORD /d 2 /f /reg:64`
                 : `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications" /v GlobalUserDisabled /t REG_DWORD /d 0 /f /reg:64 & reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search" /v BackgroundAppGlobalToggle /t REG_DWORD /d 1 /f /reg:64 & reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\AppPrivacy" /v LetAppsRunInBackground /f /reg:64`,
        do: val ? `reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization" /v DODownloadMode /t REG_DWORD /d 0 /f /reg:64 & sc stop DoSvc & sc config DoSvc start= disabled & sc stop WerSvc & sc config WerSvc start= disabled & sc stop MapsBroker & sc config MapsBroker start= disabled`
                : `reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization" /v DODownloadMode /f /reg:64 & sc config DoSvc start= delayed-auto & sc config WerSvc start= demand & sc config MapsBroker start= delayed-auto`,
        edge: val ? `reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge" /v StartupBoostEnabled /t REG_DWORD /d 0 /f /reg:64 & reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge" /v BackgroundModeEnabled /t REG_DWORD /d 0 /f /reg:64 & reg add "HKCU\\Software\\Policies\\Microsoft\\Edge" /v StartupBoostEnabled /t REG_DWORD /d 0 /f /reg:64 & reg add "HKCU\\Software\\Policies\\Microsoft\\Edge" /v BackgroundModeEnabled /t REG_DWORD /d 0 /f /reg:64`
                  : `reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge" /v StartupBoostEnabled /f /reg:64 & reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge" /v BackgroundModeEnabled /f /reg:64 & reg delete "HKCU\\Software\\Policies\\Microsoft\\Edge" /v StartupBoostEnabled /f /reg:64 & reg delete "HKCU\\Software\\Policies\\Microsoft\\Edge" /v BackgroundModeEnabled /f /reg:64`,
        hiber: val ? `powercfg /h off & reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power" /v HibernateEnabled /t REG_DWORD /d 0 /f /reg:64 & reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power" /v HiberbootEnabled /t REG_DWORD /d 0 /f /reg:64`
                   : `powercfg /h on & reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power" /v HibernateEnabled /t REG_DWORD /d 1 /f /reg:64 & reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power" /v HiberbootEnabled /t REG_DWORD /d 1 /f /reg:64`,
        telem: val ? `reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" /v AllowTelemetry /t REG_DWORD /d 0 /f /reg:64 & reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\DataCollection" /v AllowTelemetry /t REG_DWORD /d 0 /f /reg:64 & reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo" /v Enabled /t REG_DWORD /d 0 /f /reg:64 & sc stop DiagTrack & sc config DiagTrack start= disabled & sc stop dmwappushservice & sc config dmwappushservice start= disabled`
                   : `reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" /v AllowTelemetry /f /reg:64 & reg delete "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\DataCollection" /v AllowTelemetry /f /reg:64 & reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo" /v Enabled /t REG_DWORD /d 1 /f /reg:64 & sc config DiagTrack start= auto & sc start DiagTrack`,
        copilot: val ? `reg add "HKCU\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot" /v TurnOffWindowsCopilot /t REG_DWORD /d 1 /f /reg:64 & reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsCopilot" /v TurnOffWindowsCopilot /t REG_DWORD /d 1 /f /reg:64 & reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v ShowCopilotButton /t REG_DWORD /d 0 /f /reg:64 & taskkill /f /im Copilot.exe 2>nul`
                     : `reg delete "HKCU\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot" /v TurnOffWindowsCopilot /f /reg:64 & reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsCopilot" /v TurnOffWindowsCopilot /f /reg:64 & reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v ShowCopilotButton /t REG_DWORD /d 1 /f /reg:64`,
        uac: val ? `reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v ConsentPromptBehaviorAdmin /t REG_DWORD /d 5 /f /reg:64 & reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v PromptOnSecureDesktop /t REG_DWORD /d 0 /f /reg:64`
                 : `reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v ConsentPromptBehaviorAdmin /t REG_DWORD /d 5 /f /reg:64 & reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v PromptOnSecureDesktop /t REG_DWORD /d 1 /f /reg:64`,
        delay: val ? `reg add "HKCU\\Control Panel\\Desktop" /v MenuShowDelay /t REG_SZ /d 20 /f /reg:64`
                   : `reg add "HKCU\\Control Panel\\Desktop" /v MenuShowDelay /t REG_SZ /d 400 /f /reg:64`,
        wall: val ? `reg add "HKCU\\Control Panel\\Desktop" /v JPEGImportQuality /t REG_DWORD /d 100 /f /reg:64`
                  : `reg delete "HKCU\\Control Panel\\Desktop" /v JPEGImportQuality /f /reg:64`,
        rec: val ? `reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Explorer" /v HideRecommendedSection /t REG_DWORD /d 1 /f /reg:64 & reg add "HKCU\\Software\\Policies\\Microsoft\\Windows\\Explorer" /v HideRecommendedSection /t REG_DWORD /d 1 /f /reg:64 & reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v Start_IrisRecommendations /t REG_DWORD /d 0 /f /reg:64`
                 : `reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Explorer" /v HideRecommendedSection /f /reg:64 & reg delete "HKCU\\Software\\Policies\\Microsoft\\Windows\\Explorer" /v HideRecommendedSection /f /reg:64 & reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v Start_IrisRecommendations /t REG_DWORD /d 1 /f /reg:64`,
        sticky: val ? `reg add "HKCU\\Control Panel\\Accessibility\\StickyKeys" /v Flags /t REG_SZ /d 506 /f /reg:64 & reg add "HKCU\\Control Panel\\Accessibility\\Keyboard Response" /v Flags /t REG_SZ /d 122 /f /reg:64 & reg add "HKCU\\Control Panel\\Accessibility\\ToggleKeys" /v Flags /t REG_SZ /d 58 /f /reg:64`
                    : `reg add "HKCU\\Control Panel\\Accessibility\\StickyKeys" /v Flags /t REG_SZ /d 510 /f /reg:64 & reg add "HKCU\\Control Panel\\Accessibility\\Keyboard Response" /v Flags /t REG_SZ /d 126 /f /reg:64 & reg add "HKCU\\Control Panel\\Accessibility\\ToggleKeys" /v Flags /t REG_SZ /d 62 /f /reg:64`,
        dvr: val ? `reg add "HKCU\\System\\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 0 /f /reg:64 & reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR" /v AllowGameDVR /t REG_DWORD /d 0 /f /reg:64 & reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v AppCaptureEnabled /t REG_DWORD /d 0 /f /reg:64`
                 : `reg add "HKCU\\System\\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 1 /f /reg:64 & reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR" /v AllowGameDVR /f /reg:64 & reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v AppCaptureEnabled /t REG_DWORD /d 1 /f /reg:64`,
        net: val ? `reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v NetworkThrottlingIndex /t REG_DWORD /d 0xffffffff /f /reg:64 & reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v SystemResponsiveness /t REG_DWORD /d 10 /f /reg:64`
                 : `reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v NetworkThrottlingIndex /t REG_DWORD /d 10 /f /reg:64 & reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v SystemResponsiveness /t REG_DWORD /d 20 /f /reg:64`,
        timer: val ? `reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\kernel" /v GlobalTimerResolutionRequests /t REG_DWORD /d 1 /f /reg:64`
                   : `reg delete "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\kernel" /v GlobalTimerResolutionRequests /f /reg:64`
    };

    if (id === 'mouse') {
        const s = val ? ['0', '0', '0'] : ['1', '6', '10'];
        const arr = val ? '0,0,0' : '6,10,1';
        await runCmd(`reg add "HKCU\\Control Panel\\Mouse" /v MouseSpeed /t REG_SZ /d ${s[0]} /f /reg:64 & reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold1 /t REG_SZ /d ${s[1]} /f /reg:64 & reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold2 /t REG_SZ /d ${s[2]} /f /reg:64`);
        return await runPS(`
            $s = '[DllImport("user32.dll")] public static extern bool SystemParametersInfo(uint a, uint b, int[] c, uint d);'
            $t = Add-Type -MemberDefinition $s -Name U -Namespace W -PassThru
            $t::SystemParametersInfo(4, 0, @(${arr}), 3) | Out-Null
        `);
    }

    if (cmds[id]) {
        return await runCmd(cmds[id]);
    }
});

ipcMain.handle('toggle-exp', async (e, id, val) => {
    const Adv = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced`;
    const Exp = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer`;
    const NS64 = `HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Desktop\\NameSpace`;
    const NS32 = `HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Desktop\\NameSpace`;
    const NS2  = `HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Desktop\\NameSpace_41040327`;
    const NonEnumCU = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\NonEnum`;
    const NonEnumLM = `HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\NonEnum`;

    const cmds = {
        loc: `reg add "${Adv}" /v LaunchTo /t REG_DWORD /d ${val ? 1 : 2} /f /reg:64`,
        home: val ? `reg delete "${NS64}\\{f874310e-b6b7-47dc-bc84-b9e6b38f5903}" /f /reg:64 & reg delete "${NS32}\\{f874310e-b6b7-47dc-bc84-b9e6b38f5903}" /f & reg delete "${NS2}\\{f874310e-b6b7-47dc-bc84-b9e6b38f5903}" /f /reg:64 & reg add "HKCU\\Software\\Classes\\CLSID\\{f874310e-b6b7-47dc-bc84-b9e6b38f5903}" /v System.IsPinnedToNameSpaceTree /t REG_DWORD /d 0 /f /reg:64`
                  : `reg add "${NS64}\\{f874310e-b6b7-47dc-bc84-b9e6b38f5903}" /ve /t REG_SZ /d "CLSID_MSGraphHomeFolder" /f /reg:64 & reg add "${NS32}\\{f874310e-b6b7-47dc-bc84-b9e6b38f5903}" /ve /t REG_SZ /d "CLSID_MSGraphHomeFolder" /f & reg add "${NS2}\\{f874310e-b6b7-47dc-bc84-b9e6b38f5903}" /ve /t REG_SZ /d "CLSID_MSGraphHomeFolder" /f /reg:64 & reg add "HKCU\\Software\\Classes\\CLSID\\{f874310e-b6b7-47dc-bc84-b9e6b38f5903}" /v System.IsPinnedToNameSpaceTree /t REG_DWORD /d 1 /f /reg:64`,
        gal: val ? `reg delete "${NS64}\\{e88865ea-0e1c-4e20-9aa6-edcd0212c87c}" /f /reg:64 & reg delete "${NS32}\\{e88865ea-0e1c-4e20-9aa6-edcd0212c87c}" /f & reg add "HKCU\\Software\\Classes\\CLSID\\{e88865ea-0e1c-4e20-9aa6-edcd0212c87c}" /v System.IsPinnedToNameSpaceTree /t REG_DWORD /d 0 /f /reg:64`
                 : `reg add "${NS64}\\{e88865ea-0e1c-4e20-9aa6-edcd0212c87c}" /ve /t REG_SZ /d "{e88865ea-0e1c-4e20-9aa6-edcd0212c87c}" /f /reg:64 & reg add "${NS32}\\{e88865ea-0e1c-4e20-9aa6-edcd0212c87c}" /ve /t REG_SZ /d "{e88865ea-0e1c-4e20-9aa6-edcd0212c87c}" /f & reg add "HKCU\\Software\\Classes\\CLSID\\{e88865ea-0e1c-4e20-9aa6-edcd0212c87c}" /v System.IsPinnedToNameSpaceTree /t REG_DWORD /d 1 /f /reg:64`,
        netw: val ? `reg add "${NonEnumCU}" /v "{F02C1A0D-BE21-4350-88B0-7367FC96EF3C}" /t REG_DWORD /d 1 /f /reg:64 & reg add "${NonEnumLM}" /v "{F02C1A0D-BE21-4350-88B0-7367FC96EF3C}" /t REG_DWORD /d 1 /f /reg:64`
                  : `reg delete "${NonEnumCU}" /v "{F02C1A0D-BE21-4350-88B0-7367FC96EF3C}" /f /reg:64 & reg delete "${NonEnumLM}" /v "{F02C1A0D-BE21-4350-88B0-7367FC96EF3C}" /f /reg:64`,
        prv: val ? `reg add "${Exp}" /v ShowRecent /t REG_DWORD /d 0 /f /reg:64 & reg add "${Exp}" /v ShowFrequent /t REG_DWORD /d 0 /f /reg:64 & reg add "${Exp}" /v ShowCloudFilesInQuickAccess /t REG_DWORD /d 0 /f /reg:64 & reg add "${Adv}" /v Start_TrackDocs /t REG_DWORD /d 0 /f /reg:64 & del /f /q "%APPDATA%\\Microsoft\\Windows\\Recent\\*" 2>nul`
                 : `reg add "${Exp}" /v ShowRecent /t REG_DWORD /d 1 /f /reg:64 & reg add "${Exp}" /v ShowFrequent /t REG_DWORD /d 1 /f /reg:64 & reg add "${Exp}" /v ShowCloudFilesInQuickAccess /t REG_DWORD /d 1 /f /reg:64 & reg add "${Adv}" /v Start_TrackDocs /t REG_DWORD /d 1 /f /reg:64`,
        ctx: val ? `reg add "HKCU\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32" /ve /d "" /f /reg:64`
                 : `reg delete "HKCU\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}" /f /reg:64`,
        ext: `reg add "${Adv}" /v HideFileExt /t REG_DWORD /d ${val ? 0 : 1} /f /reg:64`,
        hid: `reg add "${Adv}" /v Hidden /t REG_DWORD /d ${val ? 1 : 2} /f /reg:64 & reg add "${Adv}" /v ShowSuperHidden /t REG_DWORD /d ${val ? 1 : 0} /f /reg:64`
    };

    if (cmds[id]) {
        await runCmd(cmds[id]);
        if (id === 'ctx' || id === 'netw') {
            await restartExplorer();
        } else if (id === 'home' || id === 'gal' || id === 'ext' || id === 'hid') {
            await runPS(`(New-Object -ComObject Shell.Application).Windows() | ForEach-Object { try { $_.Refresh() } catch {} }`);
        }
    }
});

ipcMain.handle('toggle-bloat', async (e, id, install) => {
    const map = {
        cam: ['Microsoft.WindowsCamera', '9WZDNCRFJBBG'],
        dev: ['Microsoft.Windows.DevHome', '9N80HKQCQ8KG'],
        clip: ['Clipchamp.Clipchamp', '9P1J8S7CCWWT'],
        news: ['Microsoft.BingNews', '9WZDNCRFHVFW'],
        teams: ['MSTeams|MicrosoftTeams', 'XP8BT8DW290MPQ'],
        todo: ['Microsoft.Todos', '9NBLGGH5R558'],
        outlook: ['Microsoft.OutlookForWindows', '9NRX63209R7B'],
        power: ['Microsoft.PowerAutomateDesktop', '9NFTCH6J7FHV'],
        quick: ['MicrosoftCorporationII.QuickAssist', '9P7BP5VNWKX5'],
        snotes: ['Microsoft.MicrosoftStickyNotes', '9NBLGGH4QGHW'],
        feed: ['Microsoft.WindowsFeedbackHub', '9NBLGGH4R32N'],
        voice: ['Microsoft.WindowsSoundRecorder', '9WZDNCRFHWKN'],
        calc: ['Microsoft.WindowsCalculator', '9WZDNCRFHVN5'],
        snip: ['Microsoft.ScreenSketch', '9MZ95KL8MR0L']
    };
    if (id === 'cop') {
        if (!install) {
            await runCmd(`taskkill /f /im Copilot.exe 2>nul & reg add "HKCU\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot" /v TurnOffWindowsCopilot /t REG_DWORD /d 1 /f /reg:64 & reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsCopilot" /v TurnOffWindowsCopilot /t REG_DWORD /d 1 /f /reg:64 & reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v ShowCopilotButton /t REG_DWORD /d 0 /f /reg:64`);
            return await runPS(`Get-AppxPackage -AllUsers | Where-Object {$_.Name -match 'Copilot|Windows.Ai'} | Remove-AppxPackage -AllUsers -EA 0`);
        }
        return await runCmd(`reg delete "HKCU\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot" /v TurnOffWindowsCopilot /f /reg:64 & reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsCopilot" /v TurnOffWindowsCopilot /f /reg:64 & reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v ShowCopilotButton /t REG_DWORD /d 1 /f /reg:64 & winget install --id 9NHT9RB2F4HD --source msstore --accept-package-agreements --accept-source-agreements --silent`);
    }
    if (id === 'bing') {
        if (!install) {
            await runCmd(`reg add "HKCU\\Software\\Policies\\Microsoft\\Windows\\Explorer" /v DisableSearchBoxSuggestions /t REG_DWORD /d 1 /f /reg:64 & reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search" /v BingSearchEnabled /t REG_DWORD /d 0 /f /reg:64 & reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search" /v CortanaConsent /t REG_DWORD /d 0 /f /reg:64`);
            return await runPS(`Get-AppxPackage *BingSearch* -AllUsers -EA 0 | Remove-AppxPackage -AllUsers -EA 0`);
        }
        return await runCmd(`reg delete "HKCU\\Software\\Policies\\Microsoft\\Windows\\Explorer" /v DisableSearchBoxSuggestions /f /reg:64 & reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search" /v BingSearchEnabled /f /reg:64 & reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search" /v CortanaConsent /f /reg:64`);
    }
    const [pkg, wgId] = map[id];
    if (install) {
        return await runCmd(`winget install --id "${wgId}" --source msstore --accept-package-agreements --accept-source-agreements --silent`);
    } else {
        return await runPS(`Get-AppxPackage -AllUsers | Where-Object {$_.Name -match '${pkg}'} | Remove-AppxPackage -AllUsers -EA 0; Get-AppxPackage | Where-Object {$_.Name -match '${pkg}'} | Remove-AppxPackage -EA 0`);
    }
});

ipcMain.handle('run-action', async (e, act) => {
    if (act === 'restore-point') {
        await runCmd(`sc config vss start= demand & net start vss & sc config swprv start= demand & net start swprv & reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\SystemRestore" /v SystemRestorePointCreationFrequency /t REG_DWORD /d 0 /f /reg:64`);
        return await runPS(`Enable-ComputerRestore -Drive 'C:\\'; Checkpoint-Computer -Description 'FK_Hub' -RestorePointType 'MODIFY_SETTINGS'`);
    }
    if (act === 'activate') {
        exec(`start "FK Hub - Активация" powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "irm https://get.activated.win | iex"`);
        return { ok: true };
    }
    if (act === 'clean-temp') {
        await runCmd(`del /q /f /s "%TEMP%\\*" 2>nul & del /q /f /s "%SystemRoot%\\Temp\\*" 2>nul & del /q /f /s "%LOCALAPPDATA%\\D3DSCache\\*" 2>nul & del /q /f /s "%LOCALAPPDATA%\\NVIDIA\\DXCache\\*" 2>nul & del /q /f /s "%LOCALAPPDATA%\\NVIDIA\\GLCache\\*" 2>nul & del /q /f /s "%LOCALAPPDATA%\\AMD\\DxCache\\*" 2>nul`);
        return { ok: true };
    }
    if (act === 'restart-exp') {
        await restartExplorer();
        return { ok: true };
    }
    if (act === 'flush-dns') {
        return await runCmd(`ipconfig /flushdns`);
    }
    if (act === 'reset-net') {
        return await runCmd(`netsh winsock reset & netsh int ip reset & ipconfig /flushdns`);
    }
    if (act === 'ncpa') {
        exec(`control ncpa.cpl`);
        return { ok: true };
    }
    if (act === 'ping-test') {
        return openConsoleBatch('ping', [
            'echo === 1. Проверка ICMP Ping (Яндекс 77.88.8.8) ===',
            'ping -n 4 77.88.8.8',
            'echo.',
            'echo === 2. Проверка ICMP Ping (Google 8.8.8.8) ===',
            'ping -n 4 8.8.8.8',
            'echo.',
            'echo === 3. Точный замер TCP-задержки (порт 443, обход блокировки ICMP) ===',
            'powershell -NoProfile -Command "$targets = @((\'Yandex\',\'77.88.8.8\'),(\'Cloudflare\',\'1.1.1.1\'),(\'Google\',\'8.8.8.8\')); foreach($t in $targets){ $sw=[Diagnostics.Stopwatch]::StartNew(); $c=New-Object Net.Sockets.TcpClient; try{ $ar=$c.BeginConnect($t[1],443,$null,$null); if($ar.AsyncWaitHandle.WaitOne(2000)){ $c.EndConnect($ar); $sw.Stop(); Write-Host (\'  [\' + $t[0] + \' \' + $t[1] + \':443] Задержка: \' + $sw.ElapsedMilliseconds + \' мс\') -ForegroundColor Green } else { Write-Host (\'  [\' + $t[0] + \'] Таймаут\') -ForegroundColor Red } } catch { Write-Host (\'  [\' + $t[0] + \'] Ошибка\') -ForegroundColor Red } finally { $c.Close() } }"'
        ]);
    }
    if (act === 'chkdsk') {
        return openConsoleBatch('chkdsk', [
            'echo === Быстрая проверка диска C: на ошибки ===',
            'chkdsk C: /scan'
        ]);
    }
    if (act === 'sfc') {
        return openConsoleBatch('sfc', [
            'echo === Проверка целостности системных файлов (SFC) ===',
            'sfc /scannow'
        ]);
    }
    if (act === 'dism') {
        return openConsoleBatch('dism', [
            'echo === Восстановление образа системы (DISM) ===',
            'DISM.exe /Online /Cleanup-image /Restorehealth'
        ]);
    }
    if (act === 'runtimes') {
        return openConsoleBatch('runtimes', [
            'echo === Включение DirectPlay ===',
            'dism /Online /Enable-Feature /FeatureName:DirectPlay /All /NoRestart',
            'echo.',
            'echo === Установка DirectX ===',
            'winget install --id Microsoft.DirectX -e --accept-package-agreements --accept-source-agreements',
            'echo.',
            'echo === Установка пакетов Microsoft Visual C++ (2005-2022) ===',
            'for %%i in (2005.x86 2005.x64 2008.x86 2008.x64 2010.x86 2010.x64 2012.x86 2012.x64 2013.x86 2013.x64 2015+.x86 2015+.x64) do (',
            '    echo Установка Microsoft.VCRedist.%%i ...',
            '    winget install --id Microsoft.VCRedist.%%i -e --accept-package-agreements --accept-source-agreements',
            ')',
            'echo.',
            'echo === Установка всех компонентов завершена! ==='
        ]);
    }
});