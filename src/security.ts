import * as cp from "child_process";

export async function storeApiToken(password: string) {
    return cp.spawn("security", [
        "add-generic-password",
        "-a AbstractApiToken",
        "-s com.goabstract.apiToken",
        `-w ${password}`
    ]);
}

export async function readApiToken() {
    return cp.spawnSync("security", [
      "find-generic-password",
      "-a AbstractApiToken",
      "-s com.goabstract.apiToken",
      `-w`
    ]).stdout.toString().trim();
}