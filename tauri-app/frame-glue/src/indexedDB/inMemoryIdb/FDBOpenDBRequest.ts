// changed by @zphrs

import FDBRequest from "./FDBRequest"
import type { EventCallback } from "./lib/types"

class FDBOpenDBRequest extends FDBRequest {
    public onupgradeneeded: EventCallback | null = null
    public onblocked: EventCallback | null = null

    public toString() {
        return "[object IDBOpenDBRequest]"
    }
}

export default FDBOpenDBRequest
