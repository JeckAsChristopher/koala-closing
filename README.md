<p align="center">
  <img src="https://img.shields.io/npm/v/koala-closing?style=for-the-badge">
  <img src="https://img.shields.io/npm/dw/koala-closing?style=for-the-badge">
  <img src="https://img.shields.io/npm/l/koala-closing?style=for-the-badge">
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/JeckAsChristopher/koala-closing/refs/heads/main/koala_closing_logo.png" width="250"/>
</p>

# koala-closing

this tool encrypts nodejs projects so people cant just read your code. it wraps files in aes-256 and messes with names and adds junk files to make it hard to reverse. there is a verify command that checks if anything was changed and deletes the folder if it detects tampering.

## how to install

npm install -g .

if the native c++ part doesnt build it just uses javascript instead.

## how to use it

1. koala-closing init ./my-project
   this makes the config file.

2. koala-closing generate-license ./my-project
   type in a name and password to make the license file.

3. koala-closing build ./my-project
   this builds the protected version in ./my-project_obfuscated/

4. koala-closing verify ./my-project_obfuscated
   checks if the files are okay.

5. node my-project_obfuscated/index.js
   run your app.

## the commands

init <path> - setup the config file.
generate-license <path> - make a license with a password.
build <path> - run the protection logic.
verify <path> - checks hashes against the manifest. if it fails it deletes the folder.
restore <path> - get back original code if you turned on restoreEnabled.
config - change settings in the json file.
clean - delete temp files.

## how verify works

it uses the license file itself to decrypt the manifest. if someone swaps the license or changes even one byte in a js file it triggers the self-delete.

## output

it randomizes folder names and file names. the main entry point is a proxy index.js file.

## some notes

the password isnt stored in plain text. we use a split-key system that locks the code to the specific node version and os it was built on. if you need to recover files you need the original password. dont leave restoreEnabled on for real releases.
