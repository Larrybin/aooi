import { getTimestamp } from './time';

const hasLocalStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

// get data from cache
export const cacheGet = (key: string): string | null => {
  if (!hasLocalStorage()) {
    return null;
  }

  const valueWithExpires = window.localStorage.getItem(key);
  if (!valueWithExpires) {
    return null;
  }

  const valueArr = valueWithExpires.split(':');
  if (!valueArr || valueArr.length < 2) {
    return valueWithExpires;
  }

  const expiresAt = Number(valueArr[0]);
  const currTimestamp = getTimestamp();

  if (expiresAt > 0 && expiresAt < currTimestamp) {
    // value expired
    cacheRemove(key);

    return null;
  }

  const searchStr = `${valueArr[0]}:`;
  const value = valueWithExpires.replace(searchStr, '');

  return value;
};

// set data to cache
// expiresAt: absolute timestamp, -1 means no expire
export const cacheSet = (
  key: string,
  value: string,
  expiresAt: number = 0
) => {
  if (!hasLocalStorage()) {
    return;
  }

  if (!expiresAt) {
    window.localStorage.setItem(key, value);
    return;
  }

  const valueWithExpires = `${expiresAt}:${value}`;

  window.localStorage.setItem(key, valueWithExpires);
};

// remove data from cache
export const cacheRemove = (key: string) => {
  if (!hasLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(key);
};

// clear all datas from cache
export const cacheClear = () => {
  if (!hasLocalStorage()) {
    return;
  }

  window.localStorage.clear();
};
