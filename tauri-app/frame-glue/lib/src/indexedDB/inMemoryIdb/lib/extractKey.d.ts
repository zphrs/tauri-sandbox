import { KeyPath, Value } from './types';
declare const extractKey: (keyPath: KeyPath, value: Value) => {
    type: "found";
    key: unknown;
} | {
    type: "notFound";
    key?: undefined;
};
export default extractKey;
