"use strict";
import * as vscode from "vscode";
import { AbstractExplorer } from "./abstractExplorer";
import { storeApiToken, readApiToken } from "./security";

export async function activate(context: vscode.ExtensionContext) {
  let accessToken = await readApiToken();
  if (!accessToken) {
    const userEnteredAccessToken = await vscode.window.showInputBox({
      prompt: "Enter API token",
      ignoreFocusOut: true
    });

    if (!userEnteredAccessToken) {
      vscode.window.showErrorMessage(
        "Cannot use Abstract Explorer without an API token"
      );
      return;
    }
    accessToken = userEnteredAccessToken;
    storeApiToken(userEnteredAccessToken);
  }

  new AbstractExplorer(context, accessToken);
}

export function deactivate() {}
