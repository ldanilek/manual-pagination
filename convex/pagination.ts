import { Doc, TableNames } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";

export type IndexKey = any[];

export type PageRequest<T extends TableNames> = {
    table: T;
    startIndexKey?: IndexKey; // default: start of table
    endIndexKey?: IndexKey; // default: end of table or stop at maxRows
    maxRows?: number; // default 100
    order?: string; // default: asc
    index?: string; // default: by_creation_time
    // default: [_creationTime, _id]
    // TODO: helper to construct from schema.
    indexFields?: string[];
};

export type PageResponse<T extends TableNames> = {
    page: Doc<T>[];
    hasMore: boolean;
};

const equalValues = (a: any, b: any): boolean => {
    // TODO: better compare values
    return a === b;
}

const exclType = (boundType: 'gt' | 'lt' | 'gte' | 'lte') => {
    if (boundType === 'gt' || boundType === 'gte') {
        return 'gt';
    }
    return 'lt';
}

const splitRange = (
    indexFields: string[],
    startBound: IndexKey,
    endBound: IndexKey,
    startBoundType: 'gt' | 'lt' | 'gte' | 'lte',
    endBoundType: 'gt' | 'lt' | 'gte' | 'lte',
) => {
    // Three stages:
    // 1. reduce down from startBound to common prefix
    // 2. range with common prefix
    // 3. build back up from common prefix to endBound
    let commonPrefix = (q: any) => q;
    while (
        startBound.length > 0 && endBound.length > 0 &&
        equalValues(startBound[0], endBound[0])
    ) {
        const prevCommonPrefix = commonPrefix;
        const indexField = indexFields[0];
        indexFields = indexFields.slice(1);
        const eqBound = startBound[0];
        startBound = startBound.slice(1);
        endBound = endBound.slice(1);
        commonPrefix = (q: any) => prevCommonPrefix(q).eq(indexField, eqBound);
    }
    const makeCompare = (
        boundType: 'gt' | 'lt' | 'gte' | 'lte',
        key: IndexKey,
    ) => {
        return (q: any) => {
            q = commonPrefix(q);
            let i = 0;
            for (; i < key.length - 1; i++) {
                q = q.eq(indexFields[i], key[i]);
            }
            if (i < key.length) {
                q = q[boundType](indexFields[i], key[i]);
            }
            return q;
        };
    };
    // Stage 1.
    const startRanges = [];
    while (startBound.length > 1) {
        startRanges.push(
            makeCompare(startBoundType, startBound.slice())
        );
        startBoundType = exclType(startBoundType);
        startBound = startBound.slice(0, -1);
    }
    // Stage 3.
    const endRanges = [];
    while (endBound.length > 1) {
        endRanges.push(
            makeCompare(endBoundType, endBound.slice())
        );
        endBoundType = exclType(endBoundType);
        endBound = endBound.slice(0, -1);
    }
    endRanges.reverse();
    // Stage 2.
    let middleRange;
    if (endBound.length === 0) {
        middleRange = makeCompare(startBoundType, startBound.slice());
    } else if (startBound.length === 0) {
        middleRange = makeCompare(endBoundType, endBound.slice());
    } else {
        const startValue = startBound[0];
        const endValue = endBound[0];
        middleRange = (q: any) => {
            q = commonPrefix(q);
            q = q[startBoundType](indexFields[0], startValue);
            q = q[endBoundType](indexFields[0], endValue);
            return q;
        };
    }
    return [...startRanges, middleRange, ...endRanges];
};

export const getIndexKey = (
    doc: Doc<any>,
    indexFields: string[] = ["_creationTime", "_id"],
): IndexKey => {
    const key = [];
    for (const field of indexFields) {
        let obj = doc;
        for (const subfield of field.split('.')) {
            obj = obj[subfield];
        }
        key.push(obj);
    }
    return key;
}

export const getPage = async <T extends TableNames>(
    ctx: QueryCtx,
    request: PageRequest<T>,
): Promise<PageResponse<T>> => {
    const index = request.index ?? "by_creation_time";
    const indexFields = request.indexFields ?? ["_creationTime", "_id"];
    const startIndexKey = request.startIndexKey ?? [];
    const endIndexKey = request.endIndexKey ?? [];
    const startBoundType = request.order === 'desc' ? 'lt' : 'gt';
    const endBoundType = request.order === 'desc' ? 'gte' : 'lte';
    let split = splitRange(
        indexFields,
        startIndexKey,
        endIndexKey,
        startBoundType,
        endBoundType,
    );
    const limit = request.maxRows ?? 100;
    const rows = [];
    let hasMore = false;
    while (rows.length < limit && split.length > 0) {
        const countNeeded = limit - rows.length;
        const nextChunk = await ctx.db
            .query(request.table)
            .withIndex(index, split[0])
            .take(countNeeded + 1);
        for (let i = 0; i < countNeeded && i < nextChunk.length; i++) {
            rows.push(nextChunk[i]);
        }
        if (nextChunk.length > countNeeded) {
            hasMore = true;
        }
        split = split.slice(1);
    } 
    if (split.length > 0) {
        hasMore = true;
    }
    return {
        page: rows,
        hasMore,
    };
};
