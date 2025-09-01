import { default as FDBRequest } from './FDBRequest';
import { EventCallback } from './lib/types';
declare class FDBOpenDBRequest extends FDBRequest {
    onupgradeneeded: EventCallback | null;
    onblocked: EventCallback | null;
    toString(): string;
}
export default FDBOpenDBRequest;
