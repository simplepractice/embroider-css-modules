import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  convertToMap,
  convertToObject,
  readPackageJson,
} from '@codemod-utils/json';

import type { Options, PackageJson } from '../../../types/index.js';
import { getVersion } from '../../../utils/blueprints.js';

function updateDevDependencies(
  packageJson: PackageJson,
  options: Options,
): void {
  const { project } = options;

  const devDependencies = convertToMap(packageJson['devDependencies']);

  const packagesToDelete = ['ember-css-modules'];

  packagesToDelete.forEach((packageName) => {
    devDependencies.delete(packageName);
  });

  const packagesToInstall = new Set([
    '@embroider/compat',
    '@embroider/core',
    '@embroider/webpack',
    'autoprefixer',
    'embroider-css-modules',
    'postcss',
    'postcss-loader',
    'webpack',
  ]);

  if (project.hasTypeScript) {
    packagesToInstall.add('type-css-modules');
  }

  [...packagesToInstall].sort().forEach((packageName) => {
    const version = getVersion(packageName, options);

    devDependencies.set(packageName, version);
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  packageJson['devDependencies'] = convertToObject(devDependencies);
}

function updateScripts(packageJson: PackageJson, options: Options): void {
  const { project } = options;

  const scripts = convertToMap(packageJson.scripts);

  if (project.hasTypeScript) {
    scripts.set('prelint:types', 'type-css-modules --src app');
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  packageJson['scripts'] = convertToObject(scripts);
}

export function updatePackageJson(options: Options): void {
  const { projectRoot } = options;

  const packageJson = readPackageJson(options);
  updateDevDependencies(packageJson, options);
  updateScripts(packageJson, options);

  const destination = join(projectRoot, 'package.json');
  const file = JSON.stringify(packageJson, null, 2) + '\n';

  writeFileSync(destination, file, 'utf8');
}
