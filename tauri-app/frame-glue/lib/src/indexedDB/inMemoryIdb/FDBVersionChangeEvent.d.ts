import { default as FakeEvent } from './lib/FakeEvent';
declare class FDBVersionChangeEvent extends FakeEvent {
    newVersion: number | null;
    oldVersion: number;
    constructor(type: "blocked" | "success" | "upgradeneeded" | "versionchange", parameters?: {
        newVersion?: number | null;
        oldVersion?: number;
    });
    toString(): string;
}
export default FDBVersionChangeEvent;
