import { TokenStream } from '../lexer'
import { KeywordToken } from '../lexer/token'
import { ResolvedIsolationLevel } from '../model'
import {
    VARIABLE_SEMANTICS,
    VariableSemantics,
} from '../model/variable-declaration'

export class SemanticsKeywordParser {
    static readToken(
        stream: TokenStream,
    ): (KeywordToken & { keyword: VariableSemantics }) | undefined {
        if (stream.isNext('KEYWORD', ...VARIABLE_SEMANTICS)) {
            return stream.expect('KEYWORD', ...VARIABLE_SEMANTICS)
        }
    }

    static parse(stream: TokenStream): SemanticsKeyword | undefined {
        const token = SemanticsKeywordParser.readToken(stream)
        return token ? SemanticsKeyword[token.keyword] : undefined
    }
}

export class SemanticsKeyword {
    private constructor(
        public readonly isolationLevel: ResolvedIsolationLevel,
        public readonly isImmutable: boolean,
    ) {}

    static readonly const = new SemanticsKeyword('ISOLATED', true)
    static readonly mut = new SemanticsKeyword('ISOLATED', false)
    static readonly ref = new SemanticsKeyword('SHARED', true)
    static readonly mutref = new SemanticsKeyword('SHARED', false)
}
