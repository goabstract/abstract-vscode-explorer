"use strict";
import * as vscode from "vscode";
import { AbstractExplorer } from "./abstractExplorer";

export async function activate(context: vscode.ExtensionContext) {
  const apiToken = await vscode.window.showInputBox({
    prompt: "Enter API token",
    ignoreFocusOut: true
  });
  if (apiToken) {
    new AbstractExplorer(context, apiToken);
  } else {
    vscode.window.showErrorMessage(
      "Cannot use Abstract Explorer without an API token"
    );
  }
}

export function deactivate() {}
