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

### Ternary Support

In the 1950s, the USSR created the SETUN computer. It used ternary logic with ternary gates. It was cancelled after only a few years, but it did manage to prove that ternary computing is feasible. The idea of ternary chipsets has been reawaken in later years and should not be dismissed out of hand. Clawr supports both ternary _and_ binary (Boolean) logic. It's syntax and semantics are designed to be agnostic to the numeric base, allowing applications that run on a plethora of different hardware foundations.

Clawr tries to be open to future ternary hardware (though the specifics are still very fluid). For that reason, Clawr is designed to be **fully agnostic** to both the hardware and the backend lowering strategy. Numeric values in Clawr do not have sized types, and they do not assume any numeric base. Instead they use ranges to hint to the backend when it can make optimizations.

Instead of a Boolean type, Clawr has `truthvalue`, which can be `true`, `false` or `ambiguous` (ternary truth). The `ambiguous` state is neither `true` nor `false`. You can use `truthvalue` as a Boolean value by simply never utilizing `ambiguous` at all. The standard operators, `!`, `&&` and `||` apply in the traditional way expected from binary languages, and they extend naturally when `ambiguous` is introduced.

Raw data in Clawr comes in two varieties: binary and ternary streams. Both are available for any hardware. The idea is that it should be possible to communicate between binary and ternary systems. A ternary system will likely prefer ternary file system and might transmit such files to a binary computer, so both types must be available in both hardware contexts.

Binary and ternary data both support lanewise operations (a.k.a. “bitwise” on binary and “tritwise” on ternary). The traditional binary lanewise operations `~`, `&` and `|` work on both variations, similarly to how `!`, `&&` and `||` work on scalar truth-values.

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
