import { MaybeThenable, IMetadata, ISplitFiltersValidation } from '../dtos/types';
import { ILogger } from '../logger/types';
import { IReadinessManager } from '../readiness/types';
import { SplitIO, ImpressionDTO } from '../types';

/** Splits cache */

export interface ISplitsCacheBase {
  addSplit(name: string, split: string): MaybeThenable<boolean>,
  addSplits(entries: [string, string][]): MaybeThenable<boolean[]>,
  removeSplit(name: string): MaybeThenable<number>,
  removeSplits(names: string[]): MaybeThenable<number>,
  getSplit(name: string): MaybeThenable<string | null>,
  getSplits(names: string[]): MaybeThenable<Record<string, string | null>>, // `fetchMany` in spec
  setChangeNumber(changeNumber: number): MaybeThenable<boolean>,
  getChangeNumber(): MaybeThenable<number>,
  getAll(): MaybeThenable<string[]>,
  getSplitNames(): MaybeThenable<string[]>,
  trafficTypeExists(trafficType: string): MaybeThenable<boolean>,
  usesSegments(): MaybeThenable<boolean>,
  clear(): MaybeThenable<void | boolean>,
  checkCache(): MaybeThenable<boolean>,
}

export interface ISplitsCacheSync extends ISplitsCacheBase {
  addSplit(name: string, split: string): boolean,
  addSplits(entries: [string, string][]): boolean[]
  removeSplit(name: string): number
  removeSplits(names: string[]): number
  getSplit(name: string): string | null
  getSplits(names: string[]): Record<string, string | null>
  setChangeNumber(changeNumber: number): boolean
  getChangeNumber(): number
  getAll(): string[]
  getSplitNames(): string[]
  trafficTypeExists(trafficType: string): boolean
  usesSegments(): boolean
  clear(): void
  checkCache(): boolean
  killLocally(name: string, defaultTreatment: string, changeNumber: number): boolean
}

export interface ISplitsCacheAsync extends ISplitsCacheBase {
  addSplit(name: string, split: string): Promise<boolean>,
  addSplits(entries: [string, string][]): Promise<boolean[]>,
  removeSplit(name: string): Promise<number>,
  removeSplits(names: string[]): Promise<number>,
  getSplit(name: string): Promise<string | null>,
  getSplits(names: string[]): Promise<Record<string, string | null>>,
  setChangeNumber(changeNumber: number): Promise<boolean>,
  getChangeNumber(): Promise<number>,
  getAll(): Promise<string[]>,
  getSplitNames(): Promise<string[]>,
  trafficTypeExists(trafficType: string): Promise<boolean>,
  usesSegments(): Promise<boolean>,
  clear(): Promise<boolean>,
  checkCache(): Promise<boolean>,
}

/** Segments cache */

export interface ISegmentsCacheBase {
  addToSegment(name: string, segmentKeys: string[]): MaybeThenable<boolean> // different signature on Server and Client-Side
  removeFromSegment(name: string, segmentKeys: string[]): MaybeThenable<boolean> // different signature on Server and Client-Side
  isInSegment(name: string, key?: string): MaybeThenable<boolean> // different signature on Server and Client-Side
  registerSegments(names: string[]): MaybeThenable<boolean> // only for Server-Side
  getRegisteredSegments(): MaybeThenable<string[]> // only for Server-Side
  setChangeNumber(name: string, changeNumber: number): MaybeThenable<boolean> // only for Server-Side
  getChangeNumber(name: string): MaybeThenable<number> // only for Server-Side
  clear(): MaybeThenable<void | boolean>
}

// Same API for both variants: SegmentsCache and MySegmentsCache (client-side API)
export interface ISegmentsCacheSync extends ISegmentsCacheBase {
  addToSegment(name: string, segmentKeys: string[]): boolean
  removeFromSegment(name: string, segmentKeys: string[]): boolean
  isInSegment(name: string, key?: string): boolean
  registerSegments(names: string[]): boolean
  getRegisteredSegments(): string[]
  setChangeNumber(name: string, changeNumber: number): boolean
  getChangeNumber(name: string): number
  resetSegments(names: string[]): boolean // only for Sync Client-Side
  clear(): void
}

export interface ISegmentsCacheAsync extends ISegmentsCacheBase {
  addToSegment(name: string, segmentKeys: string[]): Promise<boolean>
  removeFromSegment(name: string, segmentKeys: string[]): Promise<boolean>
  isInSegment(name: string, key?: string): Promise<boolean>
  registerSegments(names: string[]): Promise<boolean>
  getRegisteredSegments(): Promise<string[]>
  setChangeNumber(name: string, changeNumber: number): Promise<boolean>
  getChangeNumber(name: string): Promise<number>
  clear(): Promise<boolean>
}

/**
 * Producer API of Recorder caches (Impressions, Events and Metrics cache), used by recorders to push data.
 */
export interface IRecorderCacheProducerBase<TArgs extends any[]> {
  track(...args: TArgs): MaybeThenable<boolean | void>
}

/**
 * Consumer API of Recorder caches, used by submitters to pop data and post it to Split BE.
 */
export interface IRecorderCacheConsumerSync<TState> {
  isEmpty(): boolean // check if cache is empty. Return true if the cache was just created or cleared.
  clear(): void // clear cache data
  state(): TState // get cache data
}

export interface IRecorderCacheSync<TArgs extends any[], TState> extends IRecorderCacheProducerBase<TArgs>, IRecorderCacheConsumerSync<TState> {
  track(...args: TArgs): boolean | void
}

export interface IRecorderCacheAsync<TArgs extends any[]> extends IRecorderCacheProducerBase<TArgs> {
  track(...args: TArgs): Promise<boolean | void>
}

/** Impressions cache */

export interface IImpressionsCacheBase extends IRecorderCacheProducerBase<[ImpressionDTO[]]> {
  track(data: ImpressionDTO[]): MaybeThenable<boolean>
}

export interface IImpressionsCacheSync extends IImpressionsCacheBase, IRecorderCacheSync<[ImpressionDTO[]], ImpressionDTO[]> {
  track(data: ImpressionDTO[]): boolean
}

export interface IImpressionsCacheAsync extends IImpressionsCacheBase, IRecorderCacheAsync<[ImpressionDTO[]]> {
  track(data: ImpressionDTO[]): Promise<boolean>
}

/** Impression counts cache */

export interface IImpressionCountsCacheBase extends IRecorderCacheProducerBase<[string, number, number]> {
  track(featureName: string, timeFrame: number, amount: number): MaybeThenable<void>
}

export interface IImpressionCountsCacheSync extends IImpressionCountsCacheBase, IRecorderCacheSync<[string, number, number], Record<string, number>> {
  track(featureName: string, timeFrame: number, amount: number): void
}

export interface IImpressionCountsCacheAsync extends IImpressionCountsCacheBase, IRecorderCacheAsync<[string, number, number]> {
  track(featureName: string, timeFrame: number, amount: number): Promise<void>
}

/** Events cache */

export interface IEventsCacheBase extends IRecorderCacheProducerBase<[SplitIO.EventData, number | undefined]> {
  track(data: SplitIO.EventData, size?: number): MaybeThenable<boolean>
}

export interface IEventsCacheSync extends IEventsCacheBase, IRecorderCacheSync<[SplitIO.EventData, number | undefined], SplitIO.EventData[]> {
  track(data: SplitIO.EventData, size?: number): boolean,
  setOnFullQueueCb(cb: () => void): void
}

export interface IEventsCacheAsync extends IEventsCacheBase, IRecorderCacheAsync<[SplitIO.EventData, number | undefined]> {
  track(data: SplitIO.EventData, size?: number): Promise<boolean>
}

/** Latencies cache */

export interface ILatenciesCacheBase extends IRecorderCacheProducerBase<[string, number]> { }

export interface ILatenciesCacheSync extends ILatenciesCacheBase, IRecorderCacheSync<[string, number], Record<string, number[]>> {
  track(metricName: string, latency: number): boolean
}

export interface ILatenciesCacheAsync extends ILatenciesCacheBase, IRecorderCacheAsync<[string, number]> {
  track(metricName: string, latency: number): Promise<boolean>
}

/** Counts cache */

export interface ICountsCacheBase extends IRecorderCacheProducerBase<[string]> { }

export interface ICountsCacheSync extends ICountsCacheBase, IRecorderCacheSync<[string], Record<string, number>> {
  track(metricName: string): boolean
}

export interface ICountsCacheAsync extends ICountsCacheBase, IRecorderCacheAsync<[string]> {
  track(metricName: string): Promise<boolean>
}

/**
 * Storages
 */

export interface IStorageBase<
  TSplitsCache extends ISplitsCacheBase,
  TSegmentsCache extends ISegmentsCacheBase,
  TImpressionsCache extends IImpressionsCacheBase,
  TImpressionCountsCache extends IImpressionCountsCacheBase,
  TEventsCache extends IEventsCacheBase,
  TLatenciesCache extends ILatenciesCacheBase,
  TCountsCache extends ICountsCacheBase,
  > {
  splits: TSplitsCache,
  segments: TSegmentsCache,
  impressions: TImpressionsCache,
  impressionCounts?: TImpressionCountsCache,
  events: TEventsCache,
  latencies?: TLatenciesCache,
  counts?: TCountsCache,
  destroy(): void,
}

export type IStorageSync = IStorageBase<
  ISplitsCacheSync,
  ISegmentsCacheSync,
  IImpressionsCacheSync,
  IImpressionCountsCacheSync,
  IEventsCacheSync,
  ILatenciesCacheSync,
  ICountsCacheSync
>

export interface IStorageSyncCS extends IStorageSync {
  shared(matchingKey: string): IStorageSync
}

export type IStorageAsync = IStorageBase<
  ISplitsCacheAsync,
  ISegmentsCacheAsync,
  IImpressionsCacheAsync,
  IImpressionCountsCacheAsync,
  IEventsCacheAsync,
  ILatenciesCacheAsync,
  ICountsCacheAsync
>

/** StorageFactory */

export type DataLoader = (storage: IStorageSync, matchingKey: string) => void

export interface IStorageFactoryParams {
  log: ILogger,
  eventsQueueSize: number,
  optimize: boolean /* whether create the `impressionCounts` cache (OPTIMIZED impression mode) or not (DEBUG impression mode) */,
  dataLoader?: DataLoader,

  // ATM, only used by InLocalStorage
  matchingKey?: string, /* undefined on server-side SDKs */
  splitFiltersValidation: ISplitFiltersValidation,

  // ATM, only used by InRedisStorage. @TODO pass a callback to simplify custom storages.
  readinessManager: IReadinessManager,
  metadata: IMetadata,
}
