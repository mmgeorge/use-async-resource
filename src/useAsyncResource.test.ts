import { act, renderHook } from '@testing-library/react-hooks';

import { useAsyncResource } from './useAsyncResource';
import { resourceCache } from './cache';
import { suspendFor } from './test.helpers';

describe('useAsyncResource', () => {
  const apiFn = (id: number) => Promise.resolve({ id, name: 'test name' });
  const apiSimpleFn = () => Promise.resolve({ message: 'success' });

  afterEach(() => {
    resourceCache(apiFn).clear();
    resourceCache(apiSimpleFn).clear();
  });

  it('should create a new data reader', async () => {
    // get the data reader from the custom hook, with params
    const { result } = renderHook(() => useAsyncResource(apiFn, 1));
    const [dataReader] = result.current;

    // wait for it to fulfill
    await suspendFor(dataReader);

    // should be able to get raw data from the data reader
    expect(dataReader()).toStrictEqual({ id: 1, name: 'test name' });

    // same for api functions without params
    const { result: simpleResult } = renderHook(() => useAsyncResource(apiSimpleFn, []));
    const [simpleData] = simpleResult.current;
    await suspendFor(simpleData);
    expect(simpleData()).toStrictEqual({ message: 'success' });
  });

  it('should trigger an update for the data reader', async () => {
    // get the data reader and the updater function from the custom hook
    const { result } = renderHook(() => useAsyncResource(apiFn, 1));
    const [dataReader, updateDataReader] = result.current;

    // wait for it to fulfill
    await suspendFor(dataReader);

    // make sure we're able to get raw data from it
    expect(dataReader(u => u.id)).toStrictEqual(1);

    // call the updater function with new params
    act(() => updateDataReader(2));

    // this should generate a brand new data reader
    const [newDataReader] = result.current;
    // we will need to wait for its fulfillment
    await suspendFor(newDataReader);

    // check that it's indeed a new one
    expect(newDataReader).not.toStrictEqual(dataReader);
    // and that it returns different data
    expect(newDataReader(u => u.id)).toStrictEqual(2);
  });

  it('should reuse a cached data reader', async () => {
    // get the data reader and the updater function from the custom hook
    const { result } = renderHook(() => useAsyncResource(apiFn, 1));
    const [dataReader, updateDataReader] = result.current;

    // wait for it to fulfill
    await suspendFor(dataReader);

    // call the updater function with new params
    act(() => updateDataReader(2));

    // this should generate a brand new data reader
    const [newDataReader] = result.current;
    // we will need to wait for its fulfillment
    await suspendFor(newDataReader);

    // call the updater one more time, but with the previous param
    act(() => updateDataReader(1));

    // the new data reader should use the previously cached version
    const [cachedDataReader] = result.current;
    // so nothing to wait for
    expect(cachedDataReader).not.toThrow();

    // make sure it's the exact same as the very first one
    expect(cachedDataReader).toStrictEqual(dataReader);
    // and that it returns the same data
    expect(cachedDataReader(u => u.id)).toStrictEqual(1);
  });

  it('should create a lazy data reader', async () => {
    // initialize a lazy data reader
    const { result } = renderHook(() => useAsyncResource(apiFn));
    const [dataReader, updateDataReader] = result.current;

    // it should be available immediately, but should return `undefined`
    expect(dataReader).not.toThrow();
    expect(dataReader()).toStrictEqual(undefined);

    // triggering an api call
    act(() => updateDataReader(1));
    const [updatedDataReader] = result.current;

    // requires waiting for a fulfillment
    await suspendFor(updatedDataReader);

    // finally, we should have some data available
    expect(updatedDataReader(u => u.id)).toStrictEqual(1);
  });

  it('should call the api function again if the cache is cleared', async () => {
    // get the data reader and the updater function from the custom hook
    const { result } = renderHook(() => useAsyncResource(apiFn, 1));
    const [dataReader, updateDataReader] = result.current;
    await suspendFor(dataReader);

    // clear the cache before calling the updater with the previous param
    resourceCache(apiFn, 1).delete();

    // call the updater function with same params
    act(() => updateDataReader(1));
    // this should generate a brand new data reader
    const [newDataReader] = result.current;
    // and we will need to wait for its fulfillment
    await suspendFor(newDataReader);

    // make sure it's different than the first one
    expect(newDataReader).not.toStrictEqual(dataReader);
    // but that it returns the same data
    expect(newDataReader(u => u.id)).toStrictEqual(1);
  });
});