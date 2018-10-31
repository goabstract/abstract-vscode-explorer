"use strict";
import * as vscode from "vscode";
import * as Abstract from "abstract-sdk";
import * as path from "path";
import * as cp from "child_process";
import prettyHtml from "json-pretty-html";

interface Entry {
  id: string;
  title: string;
  type: string;
  obj: any;
}

function descriptorForEntry(entry: Entry): any {
  const type = entry.type;
  const obj = entry.obj;
  if (type === "organization") {
    return { organizationId: entry.id };
  } else if (type === "project") {
    return { projectId: entry.id };
  } else if (type === "branch") {
    return { projectId: obj.projectId, branchId: obj.branchId };
  } else if (type === "file") {
    return {
      projectId: obj.projectId,
      branchId: obj.branchId,
      fileId: obj.fileId
    };
  } else if (type === "page") {
    return {
      projectId: obj.projectId,
      branchId: obj.branchId,
      fileId: obj.fileId,
      pageId: obj.pageId
    };
  } else if (type === "layer") {
    return {
      projectId: obj.projectId,
      branchId: obj.branchId,
      fileId: obj.fileId,
      pageId: obj.pageId,
      layerId: obj.layerId,
      sha: obj.lastChangedAtSha
    };
  }
}

export class AbstractProvider implements vscode.TreeDataProvider<Entry> {
  abstractClient: any;
  extensionPath: string;

  constructor(context: vscode.ExtensionContext, accessToken: string) {
    this.abstractClient = Abstract.Client({
      accessToken,
      transport: Abstract.TRANSPORTS.API
    });
    this.extensionPath = context.extensionPath;
  }

  getTreeItem(element: Entry): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      element.title,
      element.type === "layer"
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Collapsed
    );
    treeItem.iconPath = vscode.Uri.file(
      path.join(this.extensionPath, "resources", element.type + ".svg")
    );

    if (element.type === "layer") {
      treeItem.command = {
        command: "abstractItem.viewDetails",
        title: "View Details",
        arguments: [element]
      };
    }

    return treeItem;
  }

  async getChildren(element?: Entry): Promise<Entry[]> {
    const nameSort = function(one: any, two: any) {
      return one.name > two.name ? 1 : -1;
    };
    if (!element) {
      const orgs: Array<any> = await this.abstractClient.organizations.list();
      return orgs.sort(nameSort).map(function(org: any): Entry {
        return {
          id: org.id,
          title: org.name,
          type: "organization",
          obj: { ...org, organizationId: org.id }
        };
      });
    } else if (element.type === "organization") {
      const projects: Array<any> = await this.abstractClient.projects.list(
        {
          organizationId: element.id
        },
        {
          filter: "active"
        }
      );
      return projects.sort(nameSort).map(function(project: any): Entry {
        return {
          id: project.id,
          title: project.name,
          type: "project",
          obj: { ...project, projectId: project.id }
        };
      });
    } else if (element.type === "project") {
      const branches: Array<any> = await this.abstractClient.branches.list(
        {
          projectId: element.id
        },
        {
          filter: "active"
        }
      );

      return branches.sort(nameSort).map(function(branch: any): Entry {
        return {
          id: branch.id,
          title: branch.name,
          type: "branch",
          obj: { ...branch, branchId: branch.id }
        };
      });
    } else if (element.type === "branch") {
      const files: Array<any> = await this.abstractClient.files.list({
        projectId: element.obj.projectId,
        branchId: element.id
      });
      return files.sort(nameSort).map(function(file: any): Entry {
        return {
          id: file.id,
          title: file.name,
          type: "file",
          obj: { ...file, branchId: element.id, fileId: file.id }
        };
      });
    } else if (element.type === "file") {
      const pages: Array<any> = await this.abstractClient.pages.list({
        projectId: element.obj.projectId,
        branchId: element.obj.branchId,
        fileId: element.id
      });
      return pages.map(function(page: any): Entry {
        return {
          id: page.id,
          title: page.name,
          type: "page",
          obj: { ...page, branchId: element.obj.branchId, pageId: page.id }
        };
      });
    } else if (element.type === "page") {
      const layers: Array<any> = await this.abstractClient.layers.list(
        {
          projectId: element.obj.projectId,
          branchId: element.obj.branchId,
          fileId: element.obj.fileId
        },
        {
          pageId: element.id,
          limit: 500
        }
      );
      return layers.map(function(layer: any): Entry {
        return {
          id: layer.id,
          title: layer.name,
          type: "layer",
          obj: { ...layer, branchId: element.obj.branchId, layerId: layer.id }
        };
      });
    }
    return [];
  }

  async preview(item: Entry): Promise<Buffer | null> {
    if (item.type === "layer") {
      const layerDescriptor = {
        projectId: item.obj.projectId,
        branchId: item.obj.branchId,
        fileId: item.obj.fileId,
        pageId: item.obj.pageId,
        layerId: item.obj.id,
        sha: item.obj.lastChangedAtSha
      };
      const buffer = await this.abstractClient.previews.raw(layerDescriptor);

      return new Buffer(buffer);
    }
    return null;
  }
}

function webUrlForItem(item: Entry) {
  const type = item.type;
  const baseUrl = "https://app.goabstract.com";
  let url = baseUrl;
  if (type === "organization") {
    url = `${url}/organizations/${item.id}`;
  } else if (type === "layer") {
    url = `${url}/projects/${item.obj.projectId}/branches/${
      item.obj.branchId
    }/commits/${item.obj.lastChangedAtSha}/files/${item.obj.fileId}/layers/${
      item.id
    }`;
  } else {
    if (item.obj.projectId) {
      url = `${url}/projects/${item.obj.projectId}`;
      if (item.obj.branchId) {
        url = `${url}/branches/${item.obj.branchId}`;
        if (item.obj.fileId) {
          url = `${url}/files/${item.obj.fileId}`;
          if (item.obj.pageId) {
            url = `${url}/pages/${item.obj.pageId}`;
          }
        }
      }
    }
  }

  if (url === baseUrl) return null;
  return url;
}

function appUrlForItem(item: Entry) {
  const type = item.type;
  const baseUrl = "abstract://app/share?kind=";
  let url = baseUrl;
  if (type === "organization") {
    url = `${url}${type}&organizationId=${item.id}`;
  } else if (type === "project") {
    url = `${url}${type}&projectId=${item.id}`;
  } else if (type == "branch") {
    url = `${url}${type}&projectId=${item.obj.projectId}&branchId=${item.id}`;
  } else if (type === "file") {
    url = `${url}${type}&projectId=${item.obj.projectId}&branchId=${
      item.obj.branchId
    }&fileId=${item.id}`;
  } else if (type === "page") {
    url = `${url}${type}&projectId=${item.obj.projectId}&branchId=${
      item.obj.branchId
    }&fileId=${item.obj.fileId}&pageId=${item.id}`;
  } else if (type === "layer") {
    url = `${url}${type}&projectId=${item.obj.projectId}&branchId=${
      item.obj.branchId
    }&fileId=${item.obj.fileId}&pageId=${item.obj.pageId}&layerId=${
      item.id
    }&commitSha=${item.obj.lastChangedAtSha}`;
  }

  if (url === baseUrl) return null;
  return url;
}

export class AbstractExplorer {
  private abstractExplorer: vscode.TreeView<Entry>;
  private abstractTreeProvider: AbstractProvider;

  constructor(context: vscode.ExtensionContext, accessToken: string) {
    this.abstractTreeProvider = new AbstractProvider(context, accessToken);
    this.abstractExplorer = vscode.window.createTreeView("abstractExplorer", {
      treeDataProvider: this.abstractTreeProvider
    });

    vscode.commands.registerCommand("abstractItem.openInWeb", this.openInWeb);
    vscode.commands.registerCommand("abstractItem.openInApp", this.openInApp);
    vscode.commands.registerCommand(
      "abstractItem.viewDetails",
      async (item: Entry) => {
        await this.viewDetails(item);
      }
    );
  }

  private openInWeb(item: any) {
    const url = webUrlForItem(item);
    if (url) {
      vscode.commands.executeCommand("vscode.open", vscode.Uri.parse(url));
    }
  }

  private openInApp(item: any) {
    const url = appUrlForItem(item);
    if (url) {
      // vscode.open does not work with custom protocols :(
      cp.spawn("open", [url]);
    }
  }

  private async viewDetails(item: Entry) {
    const panel = vscode.window.createWebviewPanel(
      "abstractDescriptor",
      item.obj.name || `${item.type} Details`,
      vscode.ViewColumn.One,
      {
        enableScripts: true
      }
    );
    let imageData;
    if (item.type === "layer") {
      const buffer = await this.abstractTreeProvider.preview(item);
      if (buffer) {
        imageData = buffer.toString("base64");
      }
    }
    panel.webview.html = `<!DOCTYPE html>
    <html lang="en">
    <style>
    body {
      font-family: Menlo, Monaco, "Courier New", monospace;
      font-weight: normal;
      font-size: 14px;
      line-height: 16px;
      letter-spacing: 0;
      background-color: #24282A;
      color: #d4d4d4;
      text-align: left;
      border-top: 1px solid #121516;
      padding-top: 10px;
      padding-bottom: 10px;
      margin: 0;
    }
    .json-pretty {
      padding-left: 30px;
      padding-right: 30px;
    }
    .json-selected {
      background-color: rgba(139, 191, 228, 0.19999999999999996);
    }

    .json-string {
      color: #6caedd;
    }

    .json-key {
      color: #ec5f67;
    }

    .json-boolean {
      color: #99c794;
    }

    .json-number {
      color: #99c794;
    }
    </style>
    <body>
      <div style="display:flex;justify-content:space-between;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;">
          <div style="min-width:0;overflow:auto;">
            <h2>Object Data</h2>
            ${prettyHtml(item.obj)}
          </div>
          <div style="min-width:0;overflow:auto;">
          <h2>Descriptor</h2>
            ${prettyHtml(descriptorForEntry(item))}
          </div>
        </div>
        <div>
          <img src="data:image/png;base64,${imageData}">
        </div>
      </div>
    </body>
    </html>
    `;
  }
}
