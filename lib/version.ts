import { execSync } from "child_process";

/**
 * App version format: MAJOR.MINOR.PATCH
 * - MAJOR: manually bumped for significant releases
 * - MINOR: number of merges to main (proxy for production deploys)
 * - PATCH: total number of commits on main
 */
const MAJOR_VERSION = 1;

function getGitCount(args: string[]): number {
  try {
    const output = execSync(`git rev-list --count ${args.join(" ")}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    return parseInt(output.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

export function getAppVersion(): string {
  const merges = getGitCount(["--merges", "main"]);
  const commits = getGitCount(["main"]);
  return `${MAJOR_VERSION}.${merges}.${commits}`;
}
