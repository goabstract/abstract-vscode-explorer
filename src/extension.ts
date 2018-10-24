"use strict";
import * as vscode from "vscode";
import { AbstractExplorer } from "./abstractExplorer";

export async function activate(context: vscode.ExtensionContext) {
  const accessToken = await vscode.window.showInputBox({
    prompt: "Enter API token",
    ignoreFocusOut: true
  });
  if (accessToken) {
    new AbstractExplorer(context, accessToken);
  } else {
    vscode.window.showErrorMessage("Cannot use Abstract Explorer without an API token");
  }
}

export function deactivate() {}
