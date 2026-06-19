import type {
    IdentifierToken,
    KeywordToken,
    NewlineToken,
    OperatorToken,
    PunctuationToken,
    RegexLiteralToken,
    StringLiteralToken,
    Token,
} from './token'
import {
    keywords,
    operators,
    punctuationChars,
    punctuationSymbols,
    truthValues,
} from './kinds'
import type {
    Keyword,
    Operator,
    PunctuationSymbol,
    TruthvalueLiteral,
} from './kinds'
import { decimal } from 'decimalish'
import { ErrorReporter, Position } from '../diagnostics'

export class TokenStream {
    private source: Source
    private previousToken: Token | undefined

    private constructor(
        source: string | Source,
        private readonly errorReporter: ErrorReporter,
    ) {
        this.source = typeof source === 'string' ? new Source(source) : source
    }

    static read(source: string, errorReporter: ErrorReporter) {
        return new TokenStream(source, errorReporter)
    }

    attempt<T>(parse: (clone: TokenStream) => T): T {
        const clone = this.clone()
        const result = parse(clone)
        if (result) this.merge(clone)

        return result
    }

    clone() {
        const clone = new TokenStream(this.source.clone(), this.errorReporter)
        clone.previousToken = this.previousToken
        return clone
    }

    private merge(clone: TokenStream) {
        this.source.location = { ...clone.source.location }
        this.previousToken = clone.previousToken
    }

    isNext(kind: 'NEWLINE'): boolean
    isNext(kind: 'IDENTIFIER'): boolean
    isNext(kind: 'OPERATOR', ...operators: Operator[]): boolean
    isNext(kind: 'KEYWORD', ...keywords: Keyword[]): boolean
    isNext(kind: 'PUNCTUATION', ...symbols: PunctuationSymbol[]): boolean
    isNext(kind: Token['kind'], ...values: string[]): boolean {
        const token = this.peek(
            kind === 'NEWLINE' ? { stopAtNewline: true } : undefined,
        )
        if (!token || token.kind !== kind) return false
        if (!values || values.length === 0) return true

        switch (token.kind) {
            case 'PUNCTUATION':
                return values.includes(token.symbol)
            case 'OPERATOR':
                return values.includes(token.operator)
            case 'KEYWORD':
                return values.includes(token.keyword)
            default:
                return false
        }
    }

    expect(kind: 'NEWLINE'): NewlineToken
    expect(kind: 'IDENTIFIER'): IdentifierToken
    expect(kind: 'OPERATOR', ...operators: Operator[]): OperatorToken
    expect(kind: 'KEYWORD', ...keywords: Keyword[]): KeywordToken
    expect(
        kind: 'PUNCTUATION',
        ...symbols: PunctuationSymbol[]
    ): PunctuationToken
    expect(kind: Token['kind'], ...values: string[]): Token {
        const token = this.next(
            kind === 'NEWLINE' ? { stopAtNewline: true } : undefined,
        )

        if (!token)
            this.errorReporter.reportFatalError(
                `Expected ${values?.map((v) => `'${v}'`).join(', ') ?? kind}, but got end of file`,
                {
                    start: this.source.location,
                    end: this.source.location,
                },
            )

        const actual =
            token.kind === 'PUNCTUATION'
                ? { kind: 'punctuation', value: token.symbol }
                : token.kind === 'OPERATOR'
                  ? { kind: 'operator', value: token.operator }
                  : token.kind === 'KEYWORD'
                    ? { kind: 'keyword', value: token.keyword }
                    : undefined

        if (token.kind !== kind)
            this.errorReporter.reportFatalError(
                values && values.length > 0
                    ? `Expected ${values.map((v) => `'${v}'`).join(', ')}, but got ${token.kind} ${actual ? `'${actual.value}'` : ''}`
                    : `Expected ${kind}, but got ${token.kind} ${actual ? `'${actual.value}'` : ''}`,
                {
                    start: token.start,
                    end: token.end,
                },
            )

        if (!values || values.length === 0) return token

        if (!actual || values.includes(actual.value)) return token

        const message =
            values.length > 1
                ? `Expected one of: ${values.map((v) => `'${v}'`).join(', ')}, but got '${actual.value}'`
                : `Expected '${values[0]}', but got '${actual.value}'`
        throw this.errorReporter.reportFatalError(message, {
            start: token.start,
            end: token.end,
        })
    }

    peek(options?: { stopAtNewline: true }): Token | undefined {
        const clone = this.clone()
        return clone.next(options)
    }

    next(options?: { stopAtNewline: true } | undefined): Token | undefined {
        const token = this.readnext(options)
        if (token && token.kind !== 'NEWLINE') this.previousToken = token
        return token
    }

    private readnext(
        options?: { stopAtNewline: true } | undefined,
    ): Token | undefined {
        this.skipIgnoredCharacters({
            includingNewline: !options?.stopAtNewline,
        })
        if (!this.source.hasMoreCharacters()) return

        const current = this.source.peek(1)
        if (isReservedImplementationGlyph(current)) {
            this.errorReporter.reportFatalError(
                `Reserved implementation glyph '${current}' is not allowed in Clawr identifiers`,
                {
                    start: this.source.location,
                    end: this.source.location,
                },
            )
        }

        if (current === '"') return this.consumeStringLiteral()

        if (current === '/' && this.isRegexPosition())
            return this.consumeRegexLiteral()

        if (current === '\n') return this.collapsedNewlineToken()

        const number = this.peekNumericLiteral()
        if (number) {
            const loc = { ...this.source.location }
            this.source.skip(number.length)
            return asToken(number, loc)
        }

        if (punctuationChars.has(this.source.peek(1)))
            return this.readPunctuation()

        const identifier = this.readIdentifier()
        if (identifier) {
            const loc = { ...this.source.location }
            this.source.skip(identifier.length)
            return asToken(identifier, loc)
        }

        const loc = { ...this.source.location }
        const next = this.source.peekUntil(/[^\w.]/)
        if (next.includes('.') && !isValidDecimal(next)) {
            const length = next.indexOf('.')
            this.source.skip(length)
            return asToken(next.substring(0, length), loc)
        } else {
            this.source.skip(next.length)
            return asToken(next, loc)
        }
    }

    private readIdentifier(): string | null {
        const source = this.source.source
        let index = this.source.location.index
        if (index >= source.length) return null

        const firstCodePoint = source.codePointAt(index)
        if (firstCodePoint === undefined) return null

        const first = String.fromCodePoint(firstCodePoint)
        if (!isIdentifierStart(first)) return null

        index += first.length
        while (index < source.length) {
            const codePoint = source.codePointAt(index)
            if (codePoint === undefined) break
            const char = String.fromCodePoint(codePoint)

            if (isReservedImplementationGlyph(char)) {
                const offset = source.slice(this.source.location.index, index)
                const location = {
                    line: this.source.location.line,
                    column: this.source.location.column + [...offset].length,
                }
                this.errorReporter.reportFatalError(
                    `Reserved implementation glyph '${char}' is not allowed in Clawr identifiers`,
                    {
                        start: location,
                        end: location,
                    },
                )
            }

            if (isForbiddenUnicodeCodePoint(char)) {
                const offset = source.slice(this.source.location.index, index)
                const location = {
                    line: this.source.location.line,
                    column: this.source.location.column + [...offset].length,
                }
                this.errorReporter.reportFatalError(
                    `Forbidden Unicode character '${char}' in identifier`,
                    {
                        start: location,
                        end: location,
                    },
                )
            }

            if (!isIdentifierContinue(char)) break
            index += char.length
        }

        return source.slice(this.source.location.index, index)
    }

    private peekNumericLiteral(): string | null {
        const match = this.source.peekMatch(
            /(?:\d[\d_]*(?:\.\d[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?/,
        )

        if (!match || match.index !== this.source.location.index) return null
        const trailing = this.source.peek(match[0].length + 1)[match[0].length]
        if (trailing && /[A-Za-z_]/.test(trailing)) return null
        return match[0]
    }

    private isRegexPosition(): boolean {
        const prev = this.previousToken
        if (!prev) return true

        switch (prev.kind) {
            case 'OPERATOR':
                return true
            case 'PUNCTUATION':
                return (
                    ['(', '[', '{', ','].includes(prev.symbol) ||
                    prev.symbol.endsWith('=')
                )
            case 'KEYWORD':
                return (
                    prev.keyword === 'in' ||
                    prev.keyword === 'and' ||
                    prev.keyword === 'or'
                )
            default:
                return false
        }
    }

    private skipIgnoredCharacters({
        includingNewline,
    }: {
        includingNewline: boolean
    }) {
        this.source.skipMatching(includingNewline ? /[^\S]/ : /[^\S\n]/)

        if (this.source.peek(2) === '//') {
            this.source.skipMatching(/[^\n]/)
            this.skipIgnoredCharacters({ includingNewline })
        }
        if (this.source.peek(2) === '/*') {
            this.source.skip(2)
            this.source.skipThrough('*/')
            this.skipIgnoredCharacters({ includingNewline })
        }
    }

    private consumeStringLiteral(): StringLiteralToken {
        const m = this.source.peekMatch(/"((?:\\.|[^"\\])*)"/)
        const value =
            m?.[1] ?? this.source.source.substring(this.source.location.index)
        const start = {
            line: this.source.location.line,
            column: this.source.location.column,
        }

        this.source.skip(value.length + 2)
        return {
            kind: 'STRING_LITERAL',
            value,
            start,
            end: {
                line: this.source.location.line,
                column: this.source.location.column,
            },
        }
    }

    private consumeRegexLiteral(): RegexLiteralToken {
        const m = this.source.peekMatch(/\/((?:\\.|\[.*\]|[^/\\])+)\/([gmi]*)/)
        const pattern =
            m?.[1] ?? this.source.source.substring(this.source.location.index)
        const modifiers = m?.[2]
        const start = {
            line: this.source.location.line,
            column: this.source.location.column,
        }

        this.source.skip(pattern.length + 2)
        if (modifiers) this.source.skip(modifiers.length)
        return {
            kind: 'REGEX_LITERAL',
            pattern,
            modifiers: modifiers ? new Set(modifiers) : undefined,
            start,
            end: {
                line: this.source.location.line,
                column: this.source.location.column,
            },
        }
    }

    private collapsedNewlineToken(): NewlineToken {
        const start = {
            line: this.source.location.line,
            column: this.source.location.column,
        }
        const token: Token = {
            kind: 'NEWLINE',
            start,
            end: { line: start.line + 1, column: 1 },
        }
        this.source.skipMatching(/\s/)
        return token
    }

    private readPunctuation(): Token | undefined {
        const start = {
            line: this.source.location.line,
            column: this.source.location.column,
        }
        const symbol = this.source.peekUntil(/[\s\w"]/)

        const best = [...punctuationSymbols, ...operators]
            .filter((p) => symbol.startsWith(p))
            .reduce(
                (acc, current) => (acc.length < current.length ? current : acc),
                symbol[0],
            )

        if (operators.has(best)) {
            this.source.skip(best.length)
            return {
                kind: 'OPERATOR',
                operator: best as Operator,
                start,
                end: {
                    line: this.source.location.line,
                    column: this.source.location.column,
                },
            }
        } else {
            this.source.skip(best.length)
            return {
                kind: 'PUNCTUATION',
                symbol: best as PunctuationSymbol,
                start,
                end: {
                    line: this.source.location.line,
                    column: this.source.location.column,
                },
            }
        }
    }
}

function isReservedImplementationGlyph(char: string): boolean {
    return char === '·' || char === '¸' || char === 'ˇ' || char === '˛'
}

function isIdentifierStart(char: string): boolean {
    return char === '_' || /\p{XID_Start}/u.test(char)
}

function isIdentifierContinue(char: string): boolean {
    return char === '_' || /\p{XID_Continue}/u.test(char)
}

function isForbiddenUnicodeCodePoint(char: string): boolean {
    return (
        (/\p{Cc}/u.test(char) && !/\s/u.test(char)) ||
        /[\p{Cf}\p{Cs}\p{Co}\p{Cn}]/u.test(char)
    )
}

class Source {
    location: SourceLocation
    source: string

    constructor(source: string) {
        this.source = source
        this.location = {
            index: 0,
            line: 1,
            column: 1,
        }
    }

    clone(): Source {
        const clone = new Source(this.source)
        clone.location = { ...this.location }
        return clone
    }

    peek(count: number): string {
        return this.source.substring(
            this.location.index,
            this.location.index + count,
        )
    }

    peekMatch(regex: RegExp): RegExpExecArray | null {
        return new BetterRegex(regex).exec(this.source, this.location.index)
    }

    peekUntil(regex: RegExp): string {
        const loc = this.location
        const endIndex =
            new BetterRegex(regex).exec(this.source, loc.index)?.index ??
            this.source.length
        return this.peek(endIndex - loc.index)
    }

    skipMatching(match: RegExp) {
        while (
            this.hasMoreCharacters() &&
            match.test(this.source[this.location.index])
        ) {
            this.skip(1)
        }
    }
    skipThrough(endMarker: string) {
        const endMarkerIndex = this.source.indexOf(
            endMarker,
            this.location.index,
        )
        if (endMarkerIndex === -1) {
            this.skip(this.source.length - this.location.index)
            return
        }
        while (this.location.index < endMarkerIndex) this.skip(1)
        this.skip(endMarker.length)
    }

    skip(steps: number) {
        if (steps <= 0) return

        const target = this.location.index + steps

        while (this.location.index < target) {
            if (this.source[this.location.index] === '\n') {
                this.location.line++
                this.location.column = 1
            } else {
                this.location.column++
            }
            this.location.index++
        }
    }

    hasMoreCharacters() {
        return this.location.index < this.source.length
    }
}

function isValidDecimal(next: string) {
    try {
        decimal(next.replaceAll('_', ''))
        return true
    } catch {
        return false
    }
}

type SourceLocation = {
    line: number
    column: number
    index: number
}

class BetterRegex {
    wrapped: RegExp

    constructor(wrapped: RegExp) {
        this.wrapped = wrapped
    }

    exec(source: string, index: number): RegExpExecArray | null {
        const re = new RegExp(this.wrapped, 'g')
        re.lastIndex = index
        return re.exec(source)
    }
}

function asToken(next: string, loc: SourceLocation): Token | undefined {
    if (!next) return

    const normalized = next.normalize('NFC')

    const start: Position = { line: loc.line, column: loc.column }
    if (keywords.has(normalized)) {
        return {
            kind: 'KEYWORD',
            keyword: normalized as Keyword,
            start,
            end: {
                line: start.line,
                column: start.column + next.length,
            },
        }
    }
    if (truthValues.has(normalized)) {
        return {
            kind: 'TRUTHVALUE_LITERAL',
            value: normalized as TruthvalueLiteral,
            start,
            end: {
                line: start.line,
                column: start.column + next.length,
            },
        }
    }

    // Treat standalone or underscore-only sequences as identifiers, not numbers.
    if (/^_+$/.test(normalized)) {
        return {
            kind: 'IDENTIFIER',
            identifier: normalized,
            start,
            end: {
                line: start.line,
                column: start.column + next.length,
            },
        }
    }

    try {
        return {
            kind: 'INTEGER_LITERAL',
            value: BigInt(next.replaceAll('_', '')),
            start,
            end: {
                line: start.line,
                column: start.column + next.length,
            },
        }
    } catch {}
    try {
        const real = decimal(next.replaceAll('_', ''))
        return {
            kind: 'REAL_LITERAL',
            value: real,
            source: next.replaceAll('_', ''),
            start,
            end: {
                line: start.line,
                column: start.column + next.length,
            },
        }
    } catch {}
    return {
        kind: 'IDENTIFIER',
        identifier: normalized,
        start,
        end: {
            line: start.line,
            column: start.column + next.length,
        },
    }
}
