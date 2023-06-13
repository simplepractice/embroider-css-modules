/* eslint-disable @typescript-eslint/ban-ts-comment */
import { readFileSync } from 'node:fs';
import { join, parse } from 'node:path';

import { ASTJavaScript as AST } from '@codemod-utils/ast';
import { processTemplate } from '@codemod-utils/blueprints';
import { createFiles } from '@codemod-utils/files';

import type {
  Entities,
  OptionsForImportStyles,
} from '../../../../types/index.js';
import { blueprintsRoot } from '../../../../utils/blueprints.js';
import { parseEntityName } from '../../../../utils/string.js';

type Data = {
  __styles__: string;
  fileName: string;
  isTypeScript: boolean;
};

function removeTemplateOnlyComponentMethod(file: string, data: Data): string {
  const traverse = AST.traverse(data.isTypeScript);

  const ast = traverse(file, {
    visitCallExpression(path) {
      if (path.value.callee.name !== 'templateOnlyComponent') {
        return false;
      }

      const superClass = AST.builders.identifier('Component');

      if (data.isTypeScript) {
        superClass.typeAnnotation = path.value.typeParameters;
      }

      return AST.builders.classExpression(
        null,
        AST.builders.classBody([
          AST.builders.classProperty(
            AST.builders.identifier(data.__styles__),
            AST.builders.identifier(data.__styles__),
          ),
        ]),
        superClass,
      );
    },

    visitImportDeclaration(path) {
      if (path.value.source.value !== '@ember/component/template-only') {
        return false;
      }

      const defaultImport = path.value.specifiers.find(
        (specifier: { type: string }) =>
          specifier.type === 'ImportDefaultSpecifier',
      );

      if (defaultImport?.local?.name !== 'templateOnlyComponent') {
        return false;
      }

      return AST.builders.importDeclaration(
        [
          AST.builders.importDefaultSpecifier(
            AST.builders.identifier('Component'),
          ),
        ],
        AST.builders.literal('@glimmer/component'),
      );
    },
  });

  return AST.print(ast);
}

function importStylesInClass(file: string, data: Data): string {
  const traverse = AST.traverse(data.isTypeScript);

  // Find the last import statement
  let lastImportDeclarationPath: unknown;

  const ast = traverse(file, {
    visitImportDeclaration(path) {
      if (!lastImportDeclarationPath) {
        lastImportDeclarationPath = path;
        // @ts-ignore: Assume that types from external packages are correct
      } else if (path.node.start > lastImportDeclarationPath.node.start) {
        lastImportDeclarationPath = path;
      }

      return false;
    },
  });

  // Append the styles import
  // @ts-ignore: Assume that types from external packages are correct
  const nodes = ast.program.body;
  // @ts-ignore: Assume that types from external packages are correct
  const index = lastImportDeclarationPath?.name ?? -1;

  nodes.splice(
    index + 1,
    0,
    AST.builders.importDeclaration(
      [
        AST.builders.importDefaultSpecifier(
          AST.builders.identifier(data.__styles__),
        ),
      ],
      AST.builders.literal(`./${data.fileName}.css`),
    ),
  );

  return AST.print(ast);
}

function addStylesAsClassProperty(file: string, data: Data): string {
  const traverse = AST.traverse(data.isTypeScript);

  const ast = traverse(file, {
    visitClassDeclaration(path) {
      const { body } = path.node.body;

      const nodesToAdd = [
        AST.builders.classProperty(
          AST.builders.identifier(data.__styles__),
          AST.builders.identifier(data.__styles__),
        ),
      ];

      if (body.length > 0) {
        // @ts-ignore: Assume that types from external packages are correct
        nodesToAdd.push(AST.builders.noop());
      }

      body.unshift(...nodesToAdd);

      return false;
    },
  });

  return AST.print(ast);
}

function createClass(
  entityName: string,
  { customizations, options }: OptionsForImportStyles,
): void {
  const { blueprintFilePaths, getFilePath } = customizations;

  const entity = parseEntityName(entityName);
  const filePath = getFilePath(entityName);

  const fileMap = new Map(
    blueprintFilePaths.map((blueprintFilePath) => {
      const blueprintFile = readFileSync(
        join(blueprintsRoot, blueprintFilePath),
        'utf8',
      );

      const file = processTemplate(blueprintFile, {
        entity,
        options,
      });

      return [filePath, file];
    }),
  );

  createFiles(fileMap, options);
}

function updateClass(
  entityName: string,
  { customizations, options }: OptionsForImportStyles,
): void {
  const { getFilePath } = customizations;
  const { __styles__, projectRoot } = options;

  const filePath = getFilePath(entityName);
  const { ext: fileExtension, name: fileName } = parse(filePath);

  const data = {
    __styles__,
    fileName,
    isTypeScript: fileExtension === '.ts',
  };

  try {
    let file = readFileSync(join(projectRoot, filePath), 'utf8');
    file = removeTemplateOnlyComponentMethod(file, data);
    file = importStylesInClass(file, data);
    file = addStylesAsClassProperty(file, data);

    const fileMap = new Map([[filePath, file]]);

    createFiles(fileMap, options);
  } catch (error) {
    let message = `WARNING: updateClass could not update \`${filePath}\`. Please update the file manually.`;

    if (error instanceof Error) {
      message += ` (${error.message})`;
    }

    console.warn(`${message}\n`);
  }
}

export function importStyles(
  entities: Entities,
  options: OptionsForImportStyles,
): void {
  for (const [entityName, extensions] of entities) {
    const hasClass = extensions.has('.js') || extensions.has('.ts');
    const hasStylesheet = extensions.has('.css');

    if (!hasStylesheet) {
      continue;
    }

    if (!hasClass) {
      createClass(entityName, options);

      continue;
    }

    updateClass(entityName, options);
  }
}