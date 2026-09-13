import { Plugin } from "@opencode-ai/sdk"
import { execSync } from "child_process"
import { join, dirname } from "path"
import { existsSync } from "fs"

function findVault(startDir: string): string | null {
  let dir = startDir
  const maxDepth = 10
  for (let i = 0; i < maxDepth; i++) {
    if (existsSync(join(dir, ".respectedbrain-version"))) {
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

function getBridgeScript(vaultPath: string): string {
  return join(vaultPath, ".beyin", "hooks", "bridge.py")
}

function getPythonCommand(): string {
  if (process.platform === "win32") return "py -3"
  return "python3"
}

function runBridge(vaultPath: string, event: string): void {
  const bridge = getBridgeScript(vaultPath)
  execSync(`${getPythonCommand()} "${bridge}" --provider opencode --event ${event} --global-hook`, {
    encoding: "utf-8",
    timeout: 15000,
    stdio: "inherit",
  })
}

export const respectedBrainPlugin: Plugin = async (_ctx) => ({
  "chat.message": async (_input, _output) => {
    try {
      const cwd = process.cwd()
      const vault = findVault(cwd)
      if (!vault) return
      runBridge(vault, "prompt")
    } catch {
      // Silently ignore errors to not block user messages
    }
  },
  "event": async ({ event }) => {
    try {
      const cwd = process.cwd()
      const vault = findVault(cwd)
      if (!vault) return
      switch (event.type) {
        case "session.created":
          runBridge(vault, "start")
          break
        case "session.deleted":
          runBridge(vault, "end")
          break
        case "session.idle":
          runBridge(vault, "precompact")
          break
        case "session.compacted":
          break
      }
    } catch {
      // Silently ignore
    }
  },
  "experimental.session.compacting": async (_input, _output) => {
    try {
      const cwd = process.cwd()
      const vault = findVault(cwd)
      if (!vault) return
      runBridge(vault, "precompact")
    } catch {
      // Silently ignore
    }
  },
  "config": async (_config) => {
    // Agent and skills are managed via filesystem (agents/beyin.md, skills/)
    // No additional config injection needed
  }
})
