import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { promisify } from "node:util";
import { AppError } from "../errors/catalog.ts";

const execFileAsync = promisify(execFile);

// Compara o --user-data-dir completo antes de encerrar qualquer processo.
// Processos do Chrome pessoal e subprocessos (--type=...) não são selecionados.
const CLOSE_BOT_CHROME = String.raw`
$ErrorActionPreference = 'Stop'
$profile = [IO.Path]::GetFullPath($env:GTA6PIRA_PROFILE_DIR).TrimEnd('\')
foreach ($item in @(Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'")) {
  $line = $item.CommandLine
  if (-not $line -or $line -match '(?:^|\s)--type=') { continue }
  $match = [regex]::Match($line, '(?:^|\s)--user-data-dir=(?:"(?<quoted>[^"]+)"|(?<plain>\S+))')
  if (-not $match.Success) { continue }
  $candidate = if ($match.Groups['quoted'].Success) { $match.Groups['quoted'].Value } else { $match.Groups['plain'].Value }
  try { $candidate = [IO.Path]::GetFullPath($candidate).TrimEnd('\') } catch { continue }
  if (-not [string]::Equals($candidate, $profile, [StringComparison]::OrdinalIgnoreCase)) { continue }
  Stop-Process -Id $item.ProcessId -Force -ErrorAction Stop
  Write-Output $item.ProcessId
}
`;

/** Encerra apenas o Chrome principal que usa o perfil exclusivo do bot. */
export async function closeChromeUsingBotProfile(profileDir: string): Promise<number[]> {
  if (process.platform !== "win32") return [];
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-Command", CLOSE_BOT_CHROME,
  ], {
    env: { ...process.env, GTA6PIRA_PROFILE_DIR: path.resolve(profileDir) },
    windowsHide: true,
    timeout: 15000,
  });
  return stdout.split(/\r?\n/).map(line => Number(line.trim())).filter(pid => Number.isSafeInteger(pid) && pid > 0);
}

/** Aguarda o processo terminar e o perfil ser liberado; nunca remove seus cookies. */
export async function waitForBotProfileRelease(profileDir: string, pids: readonly number[]): Promise<void> {
  const lockfile = path.join(profileDir, "lockfile");
  for (let attempt = 0; attempt < 40; attempt++) {
    const stillRunning = pids.some(pid => {
      try {
        process.kill(pid, 0);
        return true;
      } catch (error) {
        return (error as NodeJS.ErrnoException).code !== "ESRCH";
      }
    });
    let locked = false;
    try {
      await access(lockfile);
      locked = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (!stillRunning && !locked) return;
    await wait(250);
  }
  throw new AppError("CHROME_PROFILE_IN_USE");
}
