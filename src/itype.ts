import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import ts from "typescript";
import { hash } from "crypto";

function getWorkspaceStubRoot(): string | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return undefined;

  const stubRoot = path.join(folder.uri.fsPath, ".itypes");
  if (!fs.existsSync(stubRoot)) {
    fs.mkdirSync(stubRoot, { recursive: true });
  }

  return stubRoot;
}

function getPythonStubPath(tsFilePath: string) {
  const root = getWorkspaceStubRoot();
  if (!root) throw new Error("No workspace folder open");

  const folder = vscode.workspace.workspaceFolders![0].uri.fsPath;

  const relative = path.relative(folder, tsFilePath);

  const pyPath = path.join(root, relative.replace(/\.i\.ts$/, ".pyi"));

  const dir = path.dirname(pyPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return pyPath;
}

function ensureStubPathConfigured() {
  const config = vscode.workspace.getConfiguration("python.analysis");
  const current = config.get<string>("stubPath");

  if (current === ".itypes") return;

  config.update("stubPath", ".itypes", vscode.ConfigurationTarget.Workspace);
}

function removePythonStub(tsFileUri: vscode.Uri) {
  const tsFilePath = tsFileUri.fsPath;
  const pyFilePath = getPythonStubPath(tsFilePath);
  if (fs.existsSync(pyFilePath)) {
    fs.unlinkSync(pyFilePath);
  }
}

function generatePythonTypeDicts(tsFileUri: vscode.Uri) {
  const tsFilePath = tsFileUri.fsPath;
  const pyFilePath = getPythonStubPath(tsFilePath);

  const program = ts.createProgram({
    rootNames: [tsFilePath],
    options: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      strict: true,
    },
  });

  const checker = program.getTypeChecker();
  const source = program.getSourceFile(tsFilePath);

  // Function to convert TypeScript types to Python type annotations
  // returns a tuple of [use, defn] where `use` is the type annotation to be used in the stub, and `defn` is any additional import or definition needed for that type
  function convertType(
    type: ts.Type,
    defnSet: Set<string>,
    symbName?: string,
  ): string {
    if (type.flags & ts.TypeFlags.String) return "str";
    if (type.flags & ts.TypeFlags.Number) return "float";
    if (type.flags & ts.TypeFlags.Boolean) return "bool";
    if (type.flags & ts.TypeFlags.Void) return "None";
    if (type.flags & ts.TypeFlags.Any) {
      defnSet.add("from typing import Any");
      return "Any";
    }

    if (type.flags & ts.TypeFlags.Union) {
      const union = type as ts.UnionType;
      defnSet.add("from typing import Union");
      return `Union[${union.types.map((t) => convertType(t, defnSet)).join(",")}]`;
    }

    if (type.flags & ts.TypeFlags.StringLiteral) {
      const lit = (type as ts.StringLiteralType).value;
      defnSet.add("from typing import Literal");
      return `Literal["${lit}"]`;
    }

    if (type.flags & ts.TypeFlags.NumberLiteral) {
      const lit = (type as ts.NumberLiteralType).value;
      defnSet.add("from typing import Literal");
      return `Literal[${lit}]`;
    }

    if (checker.isArrayLikeType(type)) {
      const ref = type as ts.TypeReference;
      const elems = checker.getTypeArguments(ref)!;
      const elem = elems[0];
      return `list[${convertType(elem, defnSet)}]`;
    }

    if (checker.isTupleType(type)) {
      const ref = type as ts.TypeReference;
      const elems = checker.getTypeArguments(ref)!;
      return `tuple[${elems.map((e) => convertType(e, defnSet)).join(",")}]`;
    }

    // at this point we're fairly certain that it's an object.
    // there's a chance that the object is already defined as a TypedDict,
    // so we check right before returning the definition.

    const props = type.getProperties();
    if (props.length === 0) return "dict"; // fallback for empty objects

    const fields = props.map((prop) => {
      const propType = checker.getTypeOfSymbolAtLocation(
        prop,
        prop.valueDeclaration!,
      );
      const typeStr = convertType(propType, defnSet);
      return `"${prop.name}": ${typeStr}`;
    });

    defnSet.add("from typing import TypedDict");
    if (symbName) {
      return `TypedDict("${symbName}", {${fields.join(",")}})`;
    } else {
      // anonymous object type, generate a random name for it to avoid collisions
      const body = `{${fields.join(",")}}`;
      const bodyHash = hash("sha256", body).slice(0, 8);
      const randomName = `_AnonymousType_${bodyHash}`;
      const defn = `${randomName} = TypedDict("${randomName}", {${fields.join(",")}})`;
      defnSet.add(defn);
      return randomName;
    }
  }

  // begin type extraction
  const moduleSymbol = checker.getSymbolAtLocation(source!);
  const exports = checker.getExportsOfModule(moduleSymbol!);

  const defnSet = new Set<string>();
  const typeDicts: string[] = [];

  for (const sym of exports) {
    const type = checker.getDeclaredTypeOfSymbol(sym);
    const typeStr = convertType(type, defnSet, sym.name);

    typeDicts.push(`${sym.name} = ${typeStr}`);
  }

  const content = `${Array.from(defnSet).join("\n")}\n\n${typeDicts.join("\n")}\n`;

  vscode.window.showInformationMessage(
    `Generated Python stub for ${path.basename(tsFilePath)}`,
  );
  fs.writeFileSync(pyFilePath, content, "utf8");
}

export function activate(context: vscode.ExtensionContext) {
  ensureStubPathConfigured();

  // 1. Type provider:
  vscode.workspace.findFiles("**/*.i.ts").then((files) => {
    files.forEach((uri) => generatePythonTypeDicts(uri));
  });

  const watcher = vscode.workspace.createFileSystemWatcher("**/*.i.ts");

  watcher.onDidCreate((uri) => generatePythonTypeDicts(uri));
  watcher.onDidChange((uri) => generatePythonTypeDicts(uri));
  watcher.onDidDelete((uri) => removePythonStub(uri));

  context.subscriptions.push(watcher);
}
