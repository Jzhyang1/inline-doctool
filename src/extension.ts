import * as vscode from "vscode";
import { activate as activateIdoc } from "./idoc";
import { activate as activateItypes } from "./itype";

export function activate(context: vscode.ExtensionContext) {
  activateIdoc(context);
  activateItypes(context);
}
