export interface RuntimeErrorOptions extends ErrorOptions {
    detail?: Readonly<Record<string, unknown>>;
}

export class RuntimeError<TCode extends string = string> extends Error {
    readonly code: TCode;
    readonly detail?: Readonly<Record<string, unknown>>;

    constructor(code: TCode, message: string, options: RuntimeErrorOptions = {}) {
        super(message, { cause: options.cause });

        this.name = new.target.name;
        this.code = code;
        this.detail = options.detail;
    }
}
