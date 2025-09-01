import { Key } from './types';
declare const valueToKey: (input: unknown, seen?: Set<object>) => Key | Key[];
export default valueToKey;
