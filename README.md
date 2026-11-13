<!-- markdownlint-disable MD041 MD033 -->
<img src="./images/rawry-150.png" alt="Rawry" style="float: right; margin: 10px;">

# Clawr Example Compiler

[MIT License](./LICENSE)

> [!quote]
> Let us change our traditional attitude to the construction of programs: Instead of imagining that our main task is to instruct a computer what to do, let us concentrate rather on explaining to human beings what we want a computer to do.
> — Donald Knuth

Clawr is a language with three main goals: clarity, a focus on modelling, and easy refactoring. The name is a portmanteau of the word ”clarity,” and a lion’s roar (or “rawr”). And as a bonus, the first four letters spell out the word _claw_.

The code is organised in packages:

- Frontend: [./packages/frontend/](./packages/frontend/)
- Backend: [./packages/backend/](./packages/backend/)
- Runtime: [./packages/runtime/](./packages/runtime/)
- Executable: [./packages/rwrc/](./packages/rwrc/)
- CIR JSON Specification: [./packages/cir/](./packages/cir/)
- VSCode Extension: [./packages/vscode/](./packages/vscode/)

## Hardware Agnostic Language Semantics

The `@clawr/frontend` package is a compiler frontend. It parses and analyzes .clawr source code and outputs an AST called the Clawr Intermediate Representation (CIR). This is then interpreted by the backend and lowered to machine code that runs on the target platform. Many backends — for various target platforms — can reuse the same frontend as the CIR is standardized.

The `@clawr/cir` package defines the Clawr Intermediate Representation data structures. These structures are standardized and portable. Any backend should be able to parse the input from any frontend and lower it to its target platform architecture. The specification is documented at <https://clawrlang.github.io/clawr-doc/cir-reference/>.

The `@clawr/backend` package provides an example backend that produces Mac binaries via C intermediries and clang. The hope is that a rich ecosystem of compiler backends will grow in the future. The backend determines the hardware/OS architecture the final product will run on. Clawr as a language — and the compiler frontend — is agnostic to this. The backend could even be ternary!

The complete documentation can be found here: <https://clawrlang.github.io/clawr-doc/> (source: <https://github.com/clawrlang/clawr-doc>)

### Support for Ternary Chipsets

In the 1950s, the USSR constructed the SETUN computer. It used ternary logic with ternary gates. It was cancelled after only a few years, but it did manage to prove that ternary computing is feasible. The idea of ternary chipsets has reawakened in later years and while commercial production still seems rather distant, it may be a mistake to dismiss the idea out-of-hand.

The Clawr language is designed to be agnostic to hardware bases and layout. Numeric variables in Clawr do not have sizes (such as `uint32`, `int64`, `double` etc), but ranges of allowed values. Hardware support and size optimization are concerns left to the backend's lowering strategy.

## Getting started as a contributor

[How to contribute](./CONTRIBUTING)

This project is written in TypeScript for [Node.js](https://nodejs.org/en/download).

```sh
git submodule update --init --recursive
npm install
npm test
npm run test:unit     # Quick unit tests only
npm run test:backend  # Run backend tests
npm run test:e2e      # Run end-to-end tests
npm run test:all      # Run all tests, including runtime and VS Code extension tests

npx bun test packages/frontend/tests/unit/parser/module-parser.spec.ts # Run a single test fixture
```

The standard-library declarations and their ordered manifest live in the
documentation repository, pinned as a Git submodule. The compiler's build
embeds them; the standalone executable does not need the checkout at runtime.
The pinned documentation commit must be available from the submodule remote
for a fresh clone.

GitHub Actions runs `npm run test:all` on each push. It builds shared
dependencies once before running the compiler, runtime, and VS Code suites.

### Multi-file programs

Pass source files in order. Multiple files require an output name:

```sh
packages/rwrc/dist/rwrc build types.clawr main.clawr --name example -o dist
```

The files share one program scope and must contain exactly one `@main`, even
when building a single file. Named aliases must precede their uses. This is
not yet a system of separately importable modules or packages.

The VS Code extension discovers `.clawr` files per workspace folder in lexical
path order, excluding dependencies and generated output. Set
`clawr.sourceFiles` to an ordered array of paths relative to the workspace
folder to match a particular CLI build. Cross-file go-to-definition supports
top-level types and functions; rename remains single-file.

The CIR schema in `./schema/` is the source for both editor validation of `.cir` fixtures and runtime validation by the backend parser. The schema is updated automatically from the Clawr documentation.

### Runtime

The example runtime does not change much and is not included in the main test suite. It can be built and tested using the following command:

```sh
npm run test:runtime  # Rebuild the runtime library (liClawr.dylib) and run the runtime tests
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

### IDE Integration

There is a VS Code extension that can be started through the `F5` function key. It automatically opens up to a folder containing some sample Clawr source files.
