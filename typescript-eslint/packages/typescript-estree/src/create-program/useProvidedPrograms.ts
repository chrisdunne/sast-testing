import debug from 'debug';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import type { ASTAndDefiniteProgram } from './shared';
import { CORE_COMPILER_OPTIONS, getAstFromProgram } from './shared';

const log = debug('typescript-eslint:typescript-estree:useProvidedProgram');

export interface ProvidedProgramsSettings {
  filePath: string;
  tsconfigRootDir: string;
}

function useProvidedPrograms(
  programInstances: Iterable<ts.Program>,
  { filePath, tsconfigRootDir }: ProvidedProgramsSettings,
): ASTAndDefiniteProgram | undefined {
  log('Retrieving ast for %s from provided program instance(s)', filePath);

  let astAndProgram: ASTAndDefiniteProgram | undefined;
  for (const programInstance of programInstances) {
    astAndProgram = getAstFromProgram(programInstance, filePath);
    // Stop at the first applicable program instance
    if (astAndProgram) {
      break;
    }
  }

  if (!astAndProgram) {
    const relativeFilePath = path.relative(
      tsconfigRootDir || process.cwd(),
      filePath,
    );
    const errorLines = [
      '"parserOptions.programs" has been provided for @typescript-eslint/parser.',
      `The file was not found in any of the provided program instance(s): ${relativeFilePath}`,
    ];

    throw new Error(errorLines.join('\n'));
  }

  astAndProgram.program.getTypeChecker(); // ensure parent pointers are set in source files

  return astAndProgram;
}

/**
 * Utility offered by parser to help consumers construct their own program instance.
 *
 * @param configFile the path to the tsconfig.json file, relative to `projectDirectory`
 * @param projectDirectory the project directory to use as the CWD, defaults to `process.cwd()`
 */
function createProgramFromConfigFile(
  configFile: string,
  projectDirectory?: string,
): ts.Program {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (ts.sys === undefined) {
    throw new Error(
      '`createProgramFromConfigFile` is only supported in a Node-like environment.',
    );
  }

  const parsed = ts.getParsedCommandLineOfConfigFile(
    configFile,
    CORE_COMPILER_OPTIONS,
    {
      onUnRecoverableConfigFileDiagnostic: diag => {
        throw new Error(formatDiagnostics([diag])); // ensures that `parsed` is defined.
      },
      fileExists: fs.existsSync,
      getCurrentDirectory: () =>
        (projectDirectory && path.resolve(projectDirectory)) || process.cwd(),
      readDirectory: ts.sys.readDirectory,
      readFile: file => fs.readFileSync(file, 'utf-8'),
      useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
    },
  );
  const result = parsed!; // parsed is not undefined, since we throw on failure.
  if (result.errors.length) {
    throw new Error(formatDiagnostics(result.errors));
  }
  const host = ts.createCompilerHost(result.options, true);
  return ts.createProgram(result.fileNames, result.options, host);
}

function formatDiagnostics(diagnostics: ts.Diagnostic[]): string | undefined {
  return ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: f => f,
    getCurrentDirectory: process.cwd,
    getNewLine: () => '\n',
  });
}

export { useProvidedPrograms, createProgramFromConfigFile };
