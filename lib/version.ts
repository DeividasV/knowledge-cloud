import { execSync } from "child_process";

/**
 * App version format: MAJOR.DEPLOY_COUNT.COMMIT_COUNT
 * - MAJOR: manually bumped for significant releases
 * - DEPLOY_COUNT: number of production deploys/publishes
 *   (set via DEPLOY_COUNT env var during the Docker build)
 * - COMMIT_COUNT: total number of commits on main
 */
const MAJOR_VERSION = 1;

function getGitCommitCount(): number {
  try {
    const output = execSync("git rev-list --count main", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    return parseInt(output.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

export function getAppVersion(): string {
  const deployCount = parseInt(process.env.DEPLOY_COUNT || "0", 10) || 0;
  const commitCount = getGitCommitCount();
  return `${MAJOR_VERSION}.${deployCount}.${commitCount}`;
}
