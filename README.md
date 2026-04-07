<p align="center">
  <img src="https://raw.githubusercontent.com/JeckAsChristopher/koala-closing/refs/heads/main/koala_closing_logo.png" alt="koala-closing" width="220" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/koala-closing">
    <img src="https://img.shields.io/npm/v/koala-closing?style=flat-square&color=cb3837&label=npm" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/koala-closing">
    <img src="https://img.shields.io/npm/dm/koala-closing?style=flat-square&color=cb3837&label=downloads" alt="npm downloads" />
  </a>
  <a href="https://www.npmjs.com/package/koala-closing">
    <img src="https://img.shields.io/npm/unpacked-size/koala-closing?style=flat-square&color=4a90d9&label=size" alt="unpacked size" />
  </a>
  <img src="https://img.shields.io/badge/maintained-yes-brightgreen?style=flat-square" alt="maintained" />
  <img src="https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen?style=flat-square&logo=node.js&logoColor=white" alt="node version" />
  <img src="https://img.shields.io/badge/license-PROPRIETARY-lightgrey?style=flat-square" alt="license" />
  <img src="https://img.shields.io/badge/obfuscation-AES--256--GCM-blueviolet?style=flat-square" alt="encryption" />
  <img src="https://img.shields.io/badge/platform-linux%20%7C%20macos%20%7C%20windows-blue?style=flat-square" alt="platform" />
</p>

# koala-closing

koala-closing is a command-line tool for protecting Node.js projects before distribution. It obfuscates every JavaScript source file through a multi-pass pipeline, encrypts the output with AES-256-GCM using a password-derived key, randomises all file and folder names in the output directory, and injects synthetic decoy files to raise the cost of static analysis. The build output is bound to a cryptographically signed license file so that the package cannot be transferred to an unauthorised party or run without a valid license present.

---

## How it works

### Protection pipeline

Each source file goes through the following stages in order.

**Comment stripping.** All line comments and block comments are removed from the source before any other transformation is applied. This eliminates documentation that would otherwise survive obfuscation as readable strings.

**Decoy injection.** A set of opaque variable declarations and synthetic functions are prepended to the source. These serve no runtime purpose but increase the apparent complexity of the code and mislead automated decompilers that use heuristics to identify entry points.

**Two-pass obfuscation.** The source is passed through `javascript-obfuscator` twice. The first pass applies the full `high` or `medium` preset: control-flow flattening, dead-code injection, string-array encoding with RC4 and Base64, string splitting, identifier renaming to hexadecimal names, unicode escape sequences for all string content, and object-key transformation. The second pass applies a lighter preset with mangled single-character identifiers on top of the first-pass output, so the two naming schemes are visually distinct and make the code harder to follow in either direction.

**AES-256-GCM encryption envelope.** The obfuscated source is encrypted with AES-256-GCM using a key derived from the build password via scrypt (N=16384, r=8, p=1). The result is wrapped in a self-contained single-line JavaScript envelope. When the file is loaded at runtime, the envelope re-derives the decryption key, decrypts the source in memory, and executes it using `new Function()`. The password is never stored in plaintext inside the envelope; it is protected with a per-build HKDF-derived wrapping key whose salt is the only value stored.

**Anti-tamper prefix.** A short snippet is prepended to every output file before the encrypted envelope. When the file is loaded, this snippet locates the license file in the output root, derives the manifest decryption key from its SHA-256 hash, decrypts `.koala_manifest.json`, looks up the expected SHA-256 hash for the current file, hashes `__filename` at runtime, and compares. Any mismatch causes the process to exit silently with code 3.

### License system

A `.license` file is generated for each project before building. It contains a plaintext header with the project name, owner, issue date, and license ID, followed by an encrypted payload line. The payload is a JSON object containing the owner name, project name, timestamp, license ID, and a salted scrypt hash of the build password. The payload is encrypted with AES-256-GCM using the password itself as the key.

At build time the license file content is hashed with SHA-256. That hash is used as the encryption key for `.koala_manifest.json`. This means the manifest can be decrypted at verify time using only the license file, without prompting for the password again.

At runtime, the obfuscated proxy `index.js` performs the same derivation. It finds the `.license` file in its own directory, hashes it, uses that hash to decrypt the manifest, cross-checks the `licenseHash` field inside the manifest, and only then loads the real entry point. If the license file is missing, replaced, or modified in any way, the proxy returns silently without loading anything and without printing any error message.

### Manifest and integrity

`.koala_manifest.json` is written at build time after all output files exist. It contains the build timestamp, project name, owner name, the license file hash, a SHA-256 hash of every `.js` file in the output directory, and the internal file map that records which original source file was written to which obfuscated path. The entire object is AES-256-GCM encrypted with the license hash as the key before being written to disk.

The `verify` command reads the license file, derives the key, decrypts the manifest, and then walks the output directory comparing every file hash. It reports files that are missing, modified, or injected since the build. If any discrepancy is found, the command logs a tamper event to `koala.audit.log` and calls `fs.rmSync` on the entire output directory before exiting.

---

## Install

```bash
npm install -g .
```

The package includes an optional native C++ addon built with node-gyp and N-API. It provides faster implementations of SHA-256 hashing, AES encryption, and random name generation. If the native build fails, every function falls back to a pure JavaScript implementation using Node's built-in `crypto` module. The fallback is transparent and produces identical output.

---

## Workflow

```bash
koala-closing init ./my-project
koala-closing generate-license ./my-project
koala-closing build ./my-project
koala-closing verify ./my-project_obfuscated
node my-project_obfuscated/index.js
```

---

## Commands

**`init <path>`**

Validates that the target directory contains a `package.json` and writes a `koala.config.json` with default settings. Prints a summary of the project name, version, and the number of JavaScript files that will be processed.

**`generate-license <path>`**

Prompts for the owner name and a password of at least ten characters, then writes a `<project-name>.license` file into the project directory. The password is required for all subsequent build operations and is not recoverable from the license file without the original input. A confirmation prompt is shown before writing.

**`build <path>`**

Runs the full protection pipeline. Verifies the license file and password before starting. Creates a new output directory at `<path><outputSuffix>` (default `_obfuscated`), processes every included JavaScript file, injects junk files if configured, copies the license file, writes the encrypted manifest, and generates the obfuscated proxy `index.js`. The original source directory is not modified. An audit log entry is written on completion.

**`verify <path>`**

Decrypts the manifest using the license file hash, then checks every file hash in the output directory without requiring a password prompt. Reports missing, modified, or injected files. Triggers self-deletion of the output directory if any tampering is detected. Safe to run repeatedly; it does not modify any files unless tampering is confirmed.

**`restore <path>`**

Decrypts and writes the original source files to a `<project>_restored` directory. This command only works if the build was run with `restoreEnabled: true`. It requires the license password. This feature is intended for internal debugging only and should never be enabled in builds that are distributed.

**`config [get|set] [key] [value]`**

Reads or writes individual fields in `koala.config.json`. Accepts a `--path` flag to specify the project directory when not running from inside it. Only the keys listed in the configuration schema below are accepted; unknown keys are rejected.

**`clean <path>`**

Removes temporary files, the restore map, and the audit log from the project directory. Does not touch the license file or the obfuscated output.

---

## Configuration

`koala.config.json` is created by `init` and can be edited manually or through the `config` command.

```json
{
  "obfuscationLevel": "high",
  "includeTests": false,
  "injectJunkFiles": true,
  "junkFileCount": 3,
  "outputSuffix": "_obfuscated",
  "chunkFolders": 3,
  "restoreEnabled": false,
  "logFile": "koala.audit.log",
  "excludePatterns": ["node_modules", ".git", "*.test.js", "*.spec.js", "*.license"]
}
```

**`obfuscationLevel`** — `"high"` runs a two-pass obfuscation with unicode escape sequences, RC4-encoded string arrays, and control-flow flattening at 90% threshold. `"medium"` runs a single pass with lighter settings and is significantly faster for large projects.

**`includeTests`** — when `false`, any directory named `tests` or `test` at the top level of the project is excluded from the build output.

**`injectJunkFiles`** — when `true`, each output chunk folder receives `junkFileCount` additional JavaScript files containing synthetic functions. These files are harmless but are included in the manifest so their presence is verified and their removal is detected.

**`chunkFolders`** — the number of randomly named subdirectories created in the output. Source files are distributed across these folders in round-robin order. Higher values make the output structure less predictable.

**`restoreEnabled`** — when `true`, each original source file is AES-256-GCM encrypted with the build password and written to `.koala_restore.enc` in the output directory. A warning is printed during the build when this option is on. It must be `false` for any build intended for distribution.

**`excludePatterns`** — list of glob-style patterns for files and directories to skip. Patterns starting with `*` are matched against the file extension. All other patterns are matched as substrings of the relative file path.

**`logFile`** — filename for the audit log. Only the basename is used; a crafted value cannot redirect log output outside the project directory.

---

## Security properties

The encrypted output cannot be decrypted without the build password. The password is never written to disk in plaintext. The per-build HKDF wrapping key used to protect the password inside each envelope is derived at build time and never stored; it is re-derived at runtime from the stored ephemeral salt.

The license file is bound to the output at build time via the manifest's `licenseHash` field. Replacing the license file with a different one, even a valid one from a different project, will cause the manifest decryption to succeed but the cross-check to fail, so the package will not run.

The anti-tamper snippet in each file uses `__filename` to hash itself at load time. If a file is modified after the build and the manifest hash is not updated, the file will refuse to execute. Since the manifest is encrypted with the license hash and the license hash is not controllable by an attacker who does not hold the license file, the manifest cannot be regenerated without that file.

The `verify` command adds a second layer of the same check at the command line, covering all files in the output directory simultaneously, and performs the additional step of deleting the directory on failure.

`restoreEnabled` is documented and warned against for production use. When it is off, there is no embedded copy of the original source anywhere in the output.

---

## Audit log

Every command that modifies or inspects a project appends a timestamped entry to `koala.audit.log` in the project directory. Log entries are single lines with ISO 8601 timestamps. Newline characters in user-supplied strings such as the owner name are stripped before writing to prevent log injection. The log file is excluded from the build output by default and is removed by the `clean` command.

---

## Notes

Running `verify` on a directory that does not contain `.koala_manifest.json` is a no-op; the self-deletion guard checks for the manifest before removing anything. This prevents the tool from being misused to delete an arbitrary directory by pointing it at a path that lacks a manifest.

The native addon is loaded at startup if available and falls back silently. All functionality is identical in both modes. The only observable difference is performance on large projects with many files.
