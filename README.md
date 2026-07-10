<!-- markdownlint-disable MD041 MD033 -->
<a href="./users/rawry.md">
<img src="./images/rawry-150.png" alt="Rawry" style="float: right; margin: 10px;">
</a>

# Clawr Semantic Library

[MIT License](./LICENSE)

> [!quote]
> Let us change our traditional attitude to the construction of programs: Instead of imagining that our main task is to instruct a computer what to do, let us concentrate rather on explaining to human beings what we want a computer to do.
> — Donald Knuth

Clawr is a language with three main goals: clarity, a focus on modelling, and easy refactoring. The name is a portmanteau of the word ”clarity,” and a lion’s roar (or “rawr”). And as a bonus, the first four letters spell out the word _claw_.

## Hardware Agnostic Language Frontend

The _Clawr Semantic Library_ is a compiler frontend. It generates an AST (abstract syntax tree) that can be used by IDE extensions and by compiler backends.

This repository provides an example backend that produces Mac binaries via C and clang. But the hope is that a rich ecosystem of compiler backends will grow in the future. The backend determines the hardware/OS architecture the final product will run on. Clawr as a language — and the compiler frontend — is agnostic to this. The backend could even be ternary!

For more information on the AST formats, you can look at some of the following resources. Please note that Clawr is a work in progress. It is not yet feature-complete, and much of its syntax and semantics are eligible for redesign.

- Backend documentation: <https://github.com/clawrlang/clawr-doc/blob/main/backend/README.md>
- Example runtime code: [./src/runtime/](./src/runtime/)
- Example extension: <https://github.com/clawrlang/vscode-extension>
- Complete documentation can be found here: <https://github.com/clawrlang/clawr-doc>

### Example Binary Backend with C Runtime

This repository includes a backend for creating Mac binaries. This exists for two reasons: (1) to test and prove that the language is feasible, and (2) as an example for inspiring the development of other backends.

Clawr is designed to be hardware agnostic. A backend that e.g. lowers to ternary can probably not emit C code. For that reason, the backend is _not_ considered an integral part of the main Clawr project. Instead, the Clawr Semantic Library is a frontend (lexer, parser and semantic/static analysis). There could be many backends — all named Clawr — that reuse the frontend but employ very different strategies to lower to machine code.

### Support for Ternary Chipsets

In the 1950s, the USSR constructed the SETUN computer. It used ternary logic with ternary gates. It was cancelled after only a few years, but it did manage to prove that ternary computing is feasible. The idea of ternary chipsets has reawakened in later years and should not be dismissed out of hand.

The Clawr language is designed to be agnostic to hardware bases and layout. Numeric variables in Clawr do not have sizes (such as `uint32`, `int64`, `double` etc), but ranges of allowed values. Hardware support and size optimization are concerns left to the backend's lowering strategy.

## Getting started as a contributor

[How to contribute](./CONTRIBUTING)

This project is written in TypeScript for [Node.js](https://nodejs.org/en/download).

```sh
npm install
npm test
npm run test:unit     # Quick unit tests only
npm run test:backend  # Run backend tests
npm run test:e2e      # Run end-to-end tests

npm run build:schema  # Add a JSON schema file to tests/backend/cases to help editing test cases
# NOTE: Actually using the updated schema requires manually pasting the dist/cir.schema.json
# file content into .vscode/settings.json

npx bun test ./tests/unit/parser/module-parser.spec.ts # Run a single test module
```

### Runtime

The example runtime does not change much and is not included in the main test suite. It can be built and tested using the following commands:

```sh
npm run build:runtime # Build/update dist/libClawr.A.dylib
npm run test:runtime  # Rebuild and run the runtime tests
```

## IDE Configuration (Visual Studio Code)

The repository includes settings for VS Code.

### Default Tasks

There is a tasks.json file that is set up to run the `npm` scripts from a keyboard shortcut.

- ⇧⌘U: Run unit tests
- ⇧⌘B: Run full compiler test suite (not runtime tests)

> [!note]
> **Windows/Linux Users**
>
> The listed keyboard shortcuts are for Mac, but VS Code also runs on Windows
> and Linux. Keyboard shortcuts can often be translated between operating
> systems by replacing the command (⌘) key with `Ctrl` (or vice versa). If you
> are not on a Mac, try using `Shift+Ctrl+U` and `Shift+Ctrl+B` to run the
> tasks.
