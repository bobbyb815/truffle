@truffle/box
===========

Truffle Box management functionality.

Handles behavior for unboxing a new project from a predefined Truffle Box.

### Usage

```javascript
const TruffleBox = require("@truffle/box");

// `@truffle/box` prompts when unboxing into non-empty directories & before potential overwrites
// a `force` option can be passed to force unboxing. default is false
const unboxOptions = { force: false };

// .unbox() validates & unboxes truffle box repos
// pass the current working directory as directory to unbox into
TruffleBox.unbox("https://github.com/trufflesuite/truffle-init-default", process.cwd(), unboxOptions);

// or specify relative path to unbox into (path must already exist)
TruffleBox.unbox("https://github.com/trufflesuite/truffle-init-default", "some/relativePath", unboxOptions);

```


Box Configuration
-----------------

Truffle Boxes are configured via a required `truffle-box.json` file in the
box repo's root directory.

This box configuration file specifies an object containing the following
properties:

- `ignore`

  A list of relative paths to files that should be removed upon box unpack.
  Useful to remove box READMEs or other artifacts that pertain to box but not
  the set-up Truffle project.

  Example:

  ```json
  "ignore": [
    "README.md",
    ".gitignore"
  ]
  ```

- `commands`

  An object mapping supported behaviors for project to invoked command strings.

  `truffle unbox` prints commands to screen upon unboxing for documentation
  purposes.

  Example:

  ```json
  "commands": {
    "compile": "truffle compile",
    "migrate": "truffle migrate",
    "test": "truffle test"
  }
  ```

- `hooks`

  An object to specify commands to run at particular steps in the unbox
  process. Maps strings identifying individual hooks to command strings.

  Example:

  ```json
  "hooks": {
    "post-unpack": "npm install"
  }
  ```

Available Unbox Hooks
---------------------

- `post-unpack`

  If provided, runs command after box files are fetched and cleaned up for a
  new project.

  Commonly useful to install dependencies, e.g.
