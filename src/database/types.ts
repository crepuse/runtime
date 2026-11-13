export type CrepuseCountRange = readonly [min: number, max: number | null];

export interface CrepuseExpectation {
    rows?: CrepuseCountRange;
    affected?: CrepuseCountRange;
}

export interface CrepuseStatement<TRow = unknown, TRows extends TRow[] = TRow[], TParam = unknown> {
    name: string;
    sql: string;
    params: TParam[];
    expect?: CrepuseExpectation;
}

export interface CrepuseResult<TRows extends unknown[] = unknown[]> {
    rows: TRows;
    affected: number;
}

export interface CrepuseDatabase<TParam = unknown> {
    run(statement: CrepuseStatement<unknown, unknown[], TParam>): Promise<CrepuseResult>;

    query<TRow = unknown>(statement: CrepuseStatement<TRow, TRow[], TParam>): Promise<TRow[]>;

    batch(
        statements: readonly CrepuseStatement<unknown, unknown[], TParam>[],
    ): Promise<CrepuseResult[]>;
}
