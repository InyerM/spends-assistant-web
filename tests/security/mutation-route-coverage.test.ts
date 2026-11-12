import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

const root = process.cwd();
const unsafe = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
function files(directory: string): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? files(path.join(directory, entry.name))
        : [path.join(directory, entry.name)],
    );
}
function source(file: string): ts.SourceFile {
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
}
function functions(file: ts.SourceFile): Map<string, ts.FunctionDeclaration> {
  return new Map(
    file.statements
      .filter(ts.isFunctionDeclaration)
      .flatMap((node) => (node.name ? [[node.name.text, node] as const] : [])),
  );
}
function resolveFunction(
  file: ts.SourceFile,
  name: string,
): [ts.SourceFile, ts.FunctionDeclaration] | null {
  const local = functions(file).get(name);
  if (local) return [file, local];
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
      continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    const imported = bindings.elements.find((element) => element.name.text === name);
    if (!imported) continue;
    const specifier = statement.moduleSpecifier.text;
    const base = specifier.startsWith('@/')
      ? path.join(root, specifier.slice(2))
      : specifier.startsWith('.')
        ? path.resolve(path.dirname(file.fileName), specifier)
        : null;
    if (!base) return null;
    const target = [base + '.ts', path.join(base, 'index.ts')].find((candidate) =>
      fs.existsSync(candidate),
    );
    if (!target) return null;
    const targetSource = source(target);
    const declaration = functions(targetSource).get(imported.propertyName?.text ?? name);
    if (declaration) return [targetSource, declaration];
  }
  return null;
}

it('passes each unsafe handler Request through local/shared wrappers to the authentication boundary', () => {
  const violations: string[] = [];
  let handlers = 0;
  for (const route of files(path.join(root, 'app/api')).filter((file) =>
    file.endsWith('/route.ts'),
  )) {
    const routeSource = source(route);
    for (const statement of routeSource.statements) {
      if (
        ts.isVariableStatement(statement) &&
        statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name) && unsafe.has(declaration.name.text))
            violations.push(
              path.relative(root, route) +
                ' unsafe variable export needs explicit Request coverage',
            );
        }
      }
      if (
        ts.isExportDeclaration(statement) &&
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.some((element) => unsafe.has(element.name.text))
      )
        violations.push(
          path.relative(root, route) + ' unsafe alias export needs explicit Request coverage',
        );
    }
    for (const declaration of functions(routeSource).values()) {
      if (
        !declaration.name ||
        !unsafe.has(declaration.name.text) ||
        !declaration.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
      )
        continue;
      handlers++;
      const label = path.relative(root, route) + ':' + declaration.name.text;
      const requestParameters = declaration.parameters
        .filter(
          (parameter) =>
            parameter.type &&
            /\b(?:NextRequest|Request)\b/.test(parameter.type.getText(routeSource)),
        )
        .flatMap((parameter) => (ts.isIdentifier(parameter.name) ? [parameter.name.text] : []));
      const visited = new Set<string>();
      function trace(file: ts.SourceFile, fn: ts.FunctionDeclaration, aliases: string[]): boolean {
        const key = file.fileName + ':' + fn.pos + ':' + aliases.join(',');
        if (visited.has(key)) return false;
        visited.add(key);
        let guarded = false;
        function visit(node: ts.Node): void {
          if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
            const name = node.expression.text;
            const passed = node.arguments.map(
              (argument) => ts.isIdentifier(argument) && aliases.includes(argument.text),
            );
            if (name === 'getUserClient') {
              if (!passed[0])
                violations.push(label + ' drops Request at ' + path.relative(root, file.fileName));
              else guarded = true;
            } else if (name === 'hasSameRequestOrigin' && passed[0]) {
              // The legal-acceptance exception authenticates before terms are accepted.
              if (route.endsWith('/api/legal/acceptance/route.ts')) guarded = true;
            } else {
              const target = resolveFunction(file, name);
              if (target) {
                const nextAliases = target[1].parameters.flatMap((parameter, index) =>
                  passed[index] && ts.isIdentifier(parameter.name) ? [parameter.name.text] : [],
                );
                guarded = trace(target[0], target[1], nextAliases) || guarded;
              }
            }
          }
          ts.forEachChild(node, visit);
        }
        if (fn.body) visit(fn.body);
        return guarded;
      }
      if (!requestParameters.length || !trace(routeSource, declaration, requestParameters))
        violations.push(label + ' has no verified Request authentication path');
    }
  }
  expect(handlers).toBeGreaterThanOrEqual(82);
  expect(violations).toEqual([]);
});
