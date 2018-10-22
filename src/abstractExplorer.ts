"use strict";
import * as vscode from "vscode";
import * as Abstract from "abstract-sdk";
import * as path from "path";

interface Entry {
  uri: vscode.Uri;
  id: string;
  title: string;
  type: string;
  obj: any;
}

export class AbstractProvider implements vscode.TreeDataProvider<Entry> {
  abstractClient: any;
  extensionPath: string;

  constructor(context: vscode.ExtensionContext, apiToken: string) {
    this.abstractClient = Abstract.Client({
      abstractToken: apiToken,
      transport: Abstract.TRANSPORTS.API
    });
    this.extensionPath = context.extensionPath;
  }

  getTreeItem(element: Entry): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      element.uri,
      element.type === "layer"
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Collapsed
    );
    treeItem.label = element.title;
    treeItem.iconPath = vscode.Uri.file(
      path.join(this.extensionPath, "resources", element.type + ".svg")
    );

    if (element.type === "layer") {
      // opens layer in inspect mode in browser
      treeItem.command = {
        command: "vscode.open",
        title: "Open",
        arguments: [
          vscode.Uri.parse(
            `https://app.goabstract.com/projects/${
              element.obj.projectId
            }/branches/${element.obj.branchId}/commits/${
              element.obj.lastChangedAtSha
            }/files/${element.obj.fileId}/layers/${element.id}?mode=build`
          )
        ]
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
          uri: vscode.Uri.parse("abstract://org/" + org.id),
          id: org.id,
          title: org.name,
          type: "organization",
          obj: org
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
          uri: vscode.Uri.parse("abstract://project/" + project.id),
          id: project.id,
          title: project.name,
          type: "project",
          obj: project
        };
      });
    } else if (element.type === "project") {
      const branches: Array<any> = (await this.abstractClient.branches.list(
        {
          projectId: element.id
        },
        {
          filter: "active"
        }
      )).data.branches;

      return branches.sort(nameSort).map(function(branch: any): Entry {
        return {
          uri: vscode.Uri.parse("abstract://branch/" + branch.id),
          id: branch.id,
          title: branch.name,
          type: "branch",
          obj: branch
        };
      });
    } else if (element.type === "branch") {
      const files: Array<any> = (await this.abstractClient.files.list({
        projectId: element.obj.projectId,
        branchId: element.id
      })).files;
      return files.sort(nameSort).map(function(file: any): Entry {
        return {
          uri: vscode.Uri.parse("abstract://file/" + file.id),
          id: file.id,
          title: file.name,
          type: "file",
          obj: { ...file, branchId: element.id }
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
          uri: vscode.Uri.parse("abstract://page/" + page.id),
          id: page.id,
          title: page.name,
          type: "page",
          obj: { ...page, branchId: element.obj.branchId }
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
          uri: vscode.Uri.parse("abstract://layer/" + layer.id),
          id: layer.id,
          title: layer.name,
          type: "layer",
          obj: { ...layer, branchId: element.obj.branchId }
        };
      });
    }
    return [];
  }
}

export class AbstractExplorer {
  private abstractExplorer: vscode.TreeView<Entry>;

  constructor(context: vscode.ExtensionContext, apiToken: string) {
    const treeDataProvider = new AbstractProvider(context, apiToken);
    this.abstractExplorer = vscode.window.createTreeView("abstractExplorer", {
      treeDataProvider
    });

    // possible to do this?
    vscode.commands.registerCommand("abstractExplorer.previewLayer", layer =>
      this.previewLayer(layer)
    );
  }

  private previewLayer(layer: any) {
    // TODO: download layer and show in editor. possible?
    // vscode.window.showTextDocument(...)
  }
}
