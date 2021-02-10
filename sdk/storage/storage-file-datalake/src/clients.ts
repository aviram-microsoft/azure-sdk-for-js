// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { HttpRequestBody, isNode, TokenCredential } from "@azure/core-http";
import { BlobClient, BlockBlobClient } from "@azure/storage-blob";
import { CanonicalCode } from "@opentelemetry/api";
import { Readable } from "stream";

import { BufferScheduler } from "../../storage-common/src";
import { AnonymousCredential } from "./credentials/AnonymousCredential";
import { StorageSharedKeyCredential } from "./credentials/StorageSharedKeyCredential";
import { DataLakeLeaseClient } from "./DataLakeLeaseClient";
import { PathOperations } from "./generated/src/operations";
import {
  AccessControlChanges,
  DirectoryCreateIfNotExistsOptions,
  DirectoryCreateIfNotExistsResponse,
  DirectoryCreateOptions,
  DirectoryCreateResponse,
  DirectoryGenerateSasUrlOptions,
  FileAppendOptions,
  FileAppendResponse,
  FileCreateIfNotExistsOptions,
  FileCreateIfNotExistsResponse,
  FileCreateOptions,
  FileCreateResponse,
  FileExpiryMode,
  FileFlushOptions,
  FileFlushResponse,
  FileGenerateSasUrlOptions,
  FileParallelUploadOptions,
  FileQueryOptions,
  FileReadOptions,
  FileReadResponse,
  FileReadToBufferOptions,
  FileSetExpiryOptions,
  FileSetExpiryResponse,
  FileUploadResponse,
  Metadata,
  PathAccessControlItem,
  PathChangeAccessControlRecursiveOptions,
  PathChangeAccessControlRecursiveResponse,
  PathCreateIfNotExistsOptions,
  PathCreateIfNotExistsResponse,
  PathCreateOptions,
  PathCreateResponse,
  PathDeleteIfExistsResponse,
  PathDeleteOptions,
  PathDeleteResponse,
  PathExistsOptions,
  PathGetAccessControlOptions,
  PathGetAccessControlResponse,
  PathGetPropertiesOptions,
  PathGetPropertiesResponse,
  PathHttpHeaders,
  PathMoveOptions,
  PathMoveResponse,
  PathPermissions,
  PathResourceTypeModel,
  PathSetAccessControlOptions,
  PathSetAccessControlResponse,
  PathSetHttpHeadersOptions,
  PathSetHttpHeadersResponse,
  PathSetMetadataOptions,
  PathSetMetadataResponse,
  PathSetPermissionsOptions,
  PathSetPermissionsResponse,
  RemovePathAccessControlItem
} from "./models";
import { PathSetAccessControlRecursiveMode } from "./models.internal";
import { newPipeline, Pipeline, StoragePipelineOptions } from "./Pipeline";
import { generateDataLakeSASQueryParameters } from "./sas/DataLakeSASSignatureValues";
import { StorageClient } from "./StorageClient";
import {
  toAccessControlChangeFailureArray,
  toAclString,
  toPathGetAccessControlResponse,
  toPermissionsString,
  toProperties
} from "./transforms";
import { Batch } from "./utils/Batch";
import {
  BLOCK_BLOB_MAX_BLOCKS,
  DEFAULT_HIGH_LEVEL_CONCURRENCY,
  ETagAny,
  FILE_MAX_SINGLE_UPLOAD_THRESHOLD,
  FILE_MAX_SIZE_BYTES,
  FILE_UPLOAD_DEFAULT_CHUNK_SIZE,
  FILE_UPLOAD_MAX_CHUNK_SIZE
} from "./utils/constants";
import { DataLakeAclChangeFailedError } from "./utils/DataLakeAclChangeFailedError";
import { createSpan } from "./utils/tracing";
import {
  appendToURLPath,
  appendToURLQuery,
  getURLPathAndQuery,
  setURLPath,
  setURLQueries
} from "./utils/utils.common";
import { fsCreateReadStream, fsStat } from "./utils/utils.node";

/**
 * A DataLakePathClient represents a URL to the Azure Storage path (directory or file).
 *
 * @export
 * @class DataLakePathClient
 * @extends {StorageClient}
 */
export class DataLakePathClient extends StorageClient {
  /**
   * pathContext provided by protocol layer.
   *
   * @private
   * @type {PathOperations}
   * @memberof DataLakePathClient
   */
  private pathContext: PathOperations;

  /**
   * blobClient provided by @azure/storage-blob package.
   *
   * @private
   * @type {BlobClient}
   * @memberof DataLakePathClient
   */
  private blobClient: BlobClient;

  /**
   * SetAccessControlRecursiveInternal operation sets the Access Control on a path and sub paths.
   *
   * @private
   * @param {PathSetAccessControlRecursiveMode} mode Mode \"set\" sets POSIX access control rights on files and directories,
   *                                                 Mode \"modify\" modifies one or more POSIX access control rights that pre-exist on files and directories,
   *                                                 Mode \"remove\" removes one or more POSIX access control rights that were present earlier on files and directories.
   * @param {PathAccessControlItem[] | RemovePathAccessControlItem[]} acl The POSIX access control list for the file or directory.
   * @param {PathChangeAccessControlRecursiveOptions} [options={}] Optional. Options
   * @returns {Promise<PathChangeAccessControlRecursiveResponse>}
   * @memberof DataLakePathClient
   */
  private async setAccessControlRecursiveInternal(
    mode: PathSetAccessControlRecursiveMode,
    acl: PathAccessControlItem[] | RemovePathAccessControlItem[],
    options: PathChangeAccessControlRecursiveOptions = {}
  ): Promise<PathChangeAccessControlRecursiveResponse> {
    if (options.maxBatches !== undefined && options.maxBatches < 1) {
      throw RangeError(`Options maxBatches must be larger than 0.`);
    }

    if (options.batchSize !== undefined && options.batchSize < 1) {
      throw RangeError(`Options batchSize must be larger than 0.`);
    }

    const { span, spanOptions } = createSpan(
      `DataLakePathClient-setAccessControlRecursiveInternal`,
      options.tracingOptions
    );

    const result: PathChangeAccessControlRecursiveResponse = {
      counters: {
        failedChangesCount: 0,
        changedDirectoriesCount: 0,
        changedFilesCount: 0
      },
      continuationToken: undefined
    };

    try {
      let continuationToken = options.continuationToken;
      let batchCounter = 0;
      let reachMaxBatches = false;
      do {
        let response;
        try {
          response = await this.pathContext.setAccessControlRecursive(mode, {
            ...options,
            acl: toAclString(acl as PathAccessControlItem[]),
            maxRecords: options.batchSize,
            continuation: continuationToken,
            forceFlag: options.continueOnFailure,
            spanOptions
          });
        } catch (e) {
          throw new DataLakeAclChangeFailedError(e, continuationToken);
        }

        batchCounter++;
        continuationToken = response.continuation;

        // Update result
        result.continuationToken = continuationToken;
        result.counters.failedChangesCount += response.failureCount || 0;
        result.counters.changedDirectoriesCount += response.directoriesSuccessful || 0;
        result.counters.changedFilesCount += response.filesSuccessful || 0;

        // Progress event call back
        if (options.onProgress) {
          const progress: AccessControlChanges = {
            batchFailures: toAccessControlChangeFailureArray(response.failedEntries),
            batchCounters: {
              failedChangesCount: response.failureCount || 0,
              changedDirectoriesCount: response.directoriesSuccessful || 0,
              changedFilesCount: response.filesSuccessful || 0
            },
            aggregateCounters: result.counters,
            continuationToken: continuationToken
          };
          options.onProgress(progress);
        }

        reachMaxBatches =
          options.maxBatches === undefined ? false : batchCounter >= options.maxBatches;
      } while (continuationToken && !reachMaxBatches);

      return result;
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Creates an instance of DataLakePathClient from url and credential.
   *
   * @param {string} url A Client string pointing to Azure Storage data lake path (directory or file), such as
   *                     "https://myaccount.dfs.core.windows.net/filesystem/directory" or "https://myaccount.dfs.core.windows.net/filesystem/file".
   *                     You can append a SAS if using AnonymousCredential, such as "https://myaccount.dfs.core.windows.net/filesystem/directory?sasString".
   * @param {(StorageSharedKeyCredential | AnonymousCredential | TokenCredential)} [credential] Such as AnonymousCredential, StorageSharedKeyCredential or any credential from the @azure/identity package to authenticate requests to the service. You can also provide an object that implements the TokenCredential interface. If not specified, AnonymousCredential is used.
   * @param {StoragePipelineOptions} [options] Optional. Options to configure the HTTP pipeline.
   * @memberof DataLakePathClient
   */
  public constructor(
    url: string,
    credential?: StorageSharedKeyCredential | AnonymousCredential | TokenCredential,
    options?: StoragePipelineOptions
  );

  /**
   * Creates an instance of DataLakePathClient from url and pipeline.
   *
   * @param {string} url A Client string pointing to Azure Storage data lake path (directory or file), such as
   *                     "https://myaccount.dfs.core.windows.net/filesystem/directory" or "https://myaccount.dfs.core.windows.net/filesystem/file".
   *                     You can append a SAS if using AnonymousCredential, such as "https://myaccount.dfs.core.windows.net/filesystem/directory?sasString".
   * @param {Pipeline} pipeline Call newPipeline() to create a default
   *                            pipeline, or provide a customized pipeline.
   * @memberof DataLakePathClient
   */
  public constructor(url: string, pipeline: Pipeline);

  public constructor(
    url: string,
    credentialOrPipeline?:
      | StorageSharedKeyCredential
      | AnonymousCredential
      | TokenCredential
      | Pipeline,
    options?: StoragePipelineOptions
  ) {
    if (credentialOrPipeline instanceof Pipeline) {
      super(url, credentialOrPipeline);
    } else {
      let credential;
      if (credentialOrPipeline === undefined) {
        credential = new AnonymousCredential();
      } else {
        credential = credentialOrPipeline;
      }

      const pipeline = newPipeline(credential, options);
      super(url, pipeline);
    }

    this.pathContext = new PathOperations(this.storageClientContext);
    this.blobClient = new BlobClient(this.blobEndpointUrl, this.pipeline);
  }

  /**
   * Name of current file system.
   *
   * @readonly
   * @type {string}
   * @memberof DataLakePathClient
   */
  public get fileSystemName(): string {
    return this.blobClient.containerName;
  }

  /**
   * Name of current path (directory or file).
   *
   * @readonly
   * @type {string}
   * @memberof DataLakePathClient
   */
  public get name(): string {
    return this.blobClient.name;
  }

  /**
   * Convert current DataLakePathClient to DataLakeDirectoryClient if current path is a directory.
   *
   * @returns {DataLakeDirectoryClient}
   * @memberof DataLakePathClient
   */
  public toDirectoryClient(): DataLakeDirectoryClient {
    return new DataLakeDirectoryClient(this.dfsEndpointUrl, this.pipeline);
  }

  /**
   * Convert current DataLakePathClient to DataLakeFileClient if current path is a file.
   *
   * @returns {DataLakeFileClient}
   * @memberof DataLakePathClient
   */
  public toFileClient(): DataLakeFileClient {
    return new DataLakeFileClient(this.dfsEndpointUrl, this.pipeline);
  }

  /**
   * Get a {@link DataLakeLeaseClient} that manages leases on the path (directory or file).
   *
   * @param {string} [proposeLeaseId] Optional. Initial proposed lease Id.
   * @returns {DataLakeLeaseClient}
   * @memberof DataLakePathClient
   */
  public getDataLakeLeaseClient(proposeLeaseId?: string): DataLakeLeaseClient {
    return new DataLakeLeaseClient(this.blobClient.getBlobLeaseClient(proposeLeaseId));
  }

  /**
   * Create a directory or path.
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/datalakestoragegen2/path/create
   *
   * @param {PathResourceTypeModel} resourceType Resource type, "directory" or "file".
   * @param {PathCreateOptions} [options={}] Optional. Options when creating path.
   * @returns {Promise<PathCreateResponse>}
   * @memberof DataLakePathClient
   */
  public async create(
    resourceType: PathResourceTypeModel,
    options: PathCreateOptions = {}
  ): Promise<PathCreateResponse> {
    options.conditions = options.conditions || {};
    const { span, spanOptions } = createSpan("DataLakePathClient-create", options.tracingOptions);
    try {
      return await this.pathContext.create({
        ...options,
        resource: resourceType,
        leaseAccessConditions: options.conditions,
        modifiedAccessConditions: options.conditions,
        properties: toProperties(options.metadata),
        spanOptions
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Create a directory or file. If the resource already exists, it is not changed.
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/datalakestoragegen2/path/create
   *
   * @param {PathResourceType} resourceType Resource type, "directory" or "file".
   * @param {PathCreateOptions} [options={}]
   * @returns {Promise<PathCreateIfNotExistsResponse>}
   * @memberof DataLakePathClient
   */
  public async createIfNotExists(
    resourceType: PathResourceTypeModel,
    options: PathCreateIfNotExistsOptions = {}
  ): Promise<PathCreateIfNotExistsResponse> {
    const { span, spanOptions } = createSpan(
      "DataLakePathClient-createIfNotExists",
      options.tracingOptions
    );
    try {
      const conditions = { ifNoneMatch: ETagAny };
      const res = await this.create(resourceType, {
        ...options,
        conditions,
        tracingOptions: { ...options!.tracingOptions, spanOptions }
      });
      return {
        succeeded: true,
        ...res
      };
    } catch (e) {
      if (e.details?.errorCode === "PathAlreadyExists") {
        span.setStatus({
          code: CanonicalCode.ALREADY_EXISTS,
          message: "Expected exception when creating a blob only if it does not already exist."
        });
        return {
          succeeded: false,
          ...e.response?.parsedHeaders,
          _response: e.response
        };
      }
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Returns true if the Data Lake file represented by this client exists; false otherwise.
   *
   * NOTE: use this function with care since an existing file might be deleted by other clients or
   * applications. Vice versa new files might be added by other clients or applications after this
   * function completes.
   *
   * @param {PathExistsOptions} [options] options to Exists operation.
   * @returns {Promise<boolean>}
   * @memberof DataLakePathClient
   */
  public async exists(options: PathExistsOptions = {}): Promise<boolean> {
    const { span, spanOptions } = createSpan("DataLakeFileClient-exists", options.tracingOptions);
    try {
      return await this.blobClient.exists({
        ...options,
        tracingOptions: { ...options!.tracingOptions, spanOptions }
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Delete current path (directory or file).
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/datalakestoragegen2/path/delete
   *
   * @param {boolean} [recursive] Required and valid only when the resource is a directory. If "true", all paths beneath the directory will be deleted.
   * @param {PathDeleteOptions} [options={}] Optional. Options when deleting path.
   * @returns {Promise<PathDeleteResponse>}
   * @memberof DataLakePathClient
   */
  public async delete(
    recursive?: boolean,
    options: PathDeleteOptions = {}
  ): Promise<PathDeleteResponse> {
    options.conditions = options.conditions || {};
    const { span, spanOptions } = createSpan("DataLakePathClient-delete", options.tracingOptions);
    try {
      let continuation;
      let response;

      // How to handle long delete loop?
      do {
        response = await this.pathContext.deleteMethod({
          continuation,
          recursive,
          leaseAccessConditions: options.conditions,
          modifiedAccessConditions: options.conditions,
          spanOptions,
          abortSignal: options.abortSignal
        });
        continuation = response.continuation;
      } while (continuation !== undefined && continuation !== "");

      return response;
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Delete current path (directory or file) if it exists.
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/datalakestoragegen2/path/delete
   *
   * @param {boolean} [recursive] Required and valid only when the resource is a directory. If "true", all paths beneath the directory will be deleted.
   * @param {PathDeleteOptions} [options={}]
   * @returns {Promise<PathDeleteIfExistsResponse>}
   * @memberof DataLakePathClient
   */
  public async deleteIfExists(
    recursive?: boolean,
    options: PathDeleteOptions = {}
  ): Promise<PathDeleteIfExistsResponse> {
    options.conditions = options.conditions || {};
    const { span, spanOptions } = createSpan(
      "DataLakePathClient-deleteIfExists",
      options.tracingOptions
    );
    try {
      const res = await this.delete(recursive, {
        ...options,
        tracingOptions: { ...options!.tracingOptions, spanOptions }
      });
      return {
        succeeded: true,
        ...res
      };
    } catch (e) {
      if (e.details?.errorCode === "PathNotFound") {
        span.setStatus({
          code: CanonicalCode.NOT_FOUND,
          message: "Expected exception when deleting a directory or file only if it exists."
        });
        return {
          succeeded: false,
          ...e.response?.parsedHeaders,
          _response: e.response
        };
      }
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Returns the access control data for a path (directory of file).
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/datalakestoragegen2/path/getproperties
   *
   * @param {PathGetAccessControlOptions} [options={}] Optional. Options when getting file access control.
   * @returns {Promise<PathGetAccessControlResponse>}
   * @memberof DataLakePathClient
   */
  public async getAccessControl(
    options: PathGetAccessControlOptions = {}
  ): Promise<PathGetAccessControlResponse> {
    options.conditions = options.conditions || {};
    const { span, spanOptions } = createSpan(
      "DataLakePathClient-getAccessControl",
      options.tracingOptions
    );
    try {
      const response = await this.pathContext.getProperties({
        action: "getAccessControl",
        upn: options.userPrincipalName,
        leaseAccessConditions: options.conditions,
        modifiedAccessConditions: options.conditions,
        spanOptions,
        abortSignal: options.abortSignal
      });
      return toPathGetAccessControlResponse(response);
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Set the access control data for a path (directory of file).
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/datalakestoragegen2/path/update
   *
   * @param {PathAccessControlItem[]} acl The POSIX access control list for the file or directory.
   * @param {PathSetAccessControlOptions} [options={}] Optional. Options when setting path access control.
   * @returns {Promise<PathSetAccessControlResponse>}
   * @memberof DataLakePathClient
   */
  public async setAccessControl(
    acl: PathAccessControlItem[],
    options: PathSetAccessControlOptions = {}
  ): Promise<PathSetAccessControlResponse> {
    options.conditions = options.conditions || {};
    const { span, spanOptions } = createSpan(
      "DataLakePathClient-setAccessControl",
      options.tracingOptions
    );
    try {
      return await this.pathContext.setAccessControl({
        ...options,
        acl: toAclString(acl),
        leaseAccessConditions: options.conditions,
        modifiedAccessConditions: options.conditions,
        spanOptions
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Sets the Access Control on a path and sub paths.
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/datalakestoragegen2/path/update
   *
   * @param {PathAccessControlItem[]} acl The POSIX access control list for the file or directory.
   * @param {PathChangeAccessControlRecursiveOptions} [options={}] Optional. Options
   * @returns {Promise<PathChangeAccessControlRecursiveResponse>}
   * @memberof DataLakePathClient
   */
  public async setAccessControlRecursive(
    acl: PathAccessControlItem[],
    options: PathChangeAccessControlRecursiveOptions = {}
  ): Promise<PathChangeAccessControlRecursiveResponse> {
    const { span, spanOptions } = createSpan(
      "DataLakePathClient-setAccessControlRecursive",
      options.tracingOptions
    );
    try {
      return this.setAccessControlRecursiveInternal("set", acl, {
        ...options,
        tracingOptions: { ...options.tracingOptions, spanOptions }
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Modifies the Access Control on a path and sub paths.
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/datalakestoragegen2/path/update
   *
   * @param {PathAccessControlItem[]} acl The POSIX access control list for the file or directory.
   * @param {PathChangeAccessControlRecursiveOptions} [options={}] Optional. Options
   * @returns {Promise<PathChangeAccessControlRecursiveResponse>}
   * @memberof DataLakePathClient
   */
  public async updateAccessControlRecursive(
    acl: PathAccessControlItem[],
    options: PathChangeAccessControlRecursiveOptions = {}
  ): Promise<PathChangeAccessControlRecursiveResponse> {
    const { span, spanOptions } = createSpan(
      "DataLakePathClient-updateAccessControlRecursive",
      options.tracingOptions
    );
    try {
      return this.setAccessControlRecursiveInternal("modify", acl, {
        ...options,
        tracingOptions: { ...options.tracingOptions, spanOptions }
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Removes the Access Control on a path and sub paths.
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/datalakestoragegen2/path/update
   *
   * @param {RemovePathAccessControlItem[]} acl The POSIX access control list for the file or directory.
   * @param {PathChangeAccessControlRecursiveOptions} [options={}] Optional. Options
   * @returns {Promise<PathChangeAccessControlRecursiveResponse>}
   * @memberof DataLakePathClient
   */
  public async removeAccessControlRecursive(
    acl: RemovePathAccessControlItem[],
    options: PathChangeAccessControlRecursiveOptions = {}
  ): Promise<PathChangeAccessControlRecursiveResponse> {
    const { span, spanOptions } = createSpan(
      "DataLakePathClient-removeAccessControlRecursive",
      options.tracingOptions
    );
    try {
      return this.setAccessControlRecursiveInternal("remove", acl, {
        ...options,
        tracingOptions: { ...options.tracingOptions, spanOptions }
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Sets the file permissions on a path.
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/datalakestoragegen2/path/update
   *
   * @param {PathPermissions} permissions The POSIX access permissions for the file owner, the file owning group, and others.
   * @param {PathSetPermissionsOptions} [options={}] Optional. Options when setting path permissions.
   * @returns {Promise<PathSetPermissionsResponse>}
   * @memberof DataLakePathClient
   */
  public async setPermissions(
    permissions: PathPermissions,
    options: PathSetPermissionsOptions = {}
  ): Promise<PathSetPermissionsResponse> {
    options.conditions = options.conditions || {};
    const { span, spanOptions } = createSpan(
      "DataLakePathClient-setPermissions",
      options.tracingOptions
    );
    try {
      return await this.pathContext.setAccessControl({
        ...options,
        permissions: toPermissionsString(permissions),
        leaseAccessConditions: options.conditions,
        modifiedAccessConditions: options.conditions,
        spanOptions
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Returns all user-defined metadata, standard HTTP properties, and system properties
   * for the path (directory or file).
   *
   * WARNING: The `metadata` object returned in the response will have its keys in lowercase, even if
   * they originally contained uppercase characters. This differs from the metadata keys returned by
   * the methods of {@link DataLakeFileSystemClient} that list paths using the `includeMetadata` option, which
   * will retain their original casing.
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/get-blob-properties
   *
   * @param {PathGetPropertiesOptions} [options={}] Optional. Options when getting path properties.
   * @returns {Promise<PathGetPropertiesResponse>}
   * @memberof DataLakePathClient
   */
  public async getProperties(
    options: PathGetPropertiesOptions = {}
  ): Promise<PathGetPropertiesResponse> {
    const { span, spanOptions } = createSpan(
      "DataLakePathClient-getProperties",
      options.tracingOptions
    );
    try {
      return await this.blobClient.getProperties({
        ...options,
        customerProvidedKey: undefined, // Doesn't support customer provided key in data lake package yet
        tracingOptions: { ...options.tracingOptions, spanOptions }
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Sets system properties on the path (directory or file).
   *
   * If no value provided, or no value provided for the specified blob HTTP headers,
   * these blob HTTP headers without a value will be cleared.
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/set-blob-properties
   *
   * @param {PathHttpHeaders} httpHeaders
   * @param {PathSetHttpHeadersOptions} [options={}]
   * @returns {Promise<PathSetHttpHeadersResponse>}
   * @memberof DataLakePathClient
   */
  public async setHttpHeaders(
    httpHeaders: PathHttpHeaders,
    options: PathSetHttpHeadersOptions = {}
  ): Promise<PathSetHttpHeadersResponse> {
    const { span, spanOptions } = createSpan(
      "DataLakePathClient-setHttpHeaders",
      options.tracingOptions
    );
    try {
      return await this.blobClient.setHTTPHeaders(
        {
          blobCacheControl: httpHeaders.cacheControl,
          blobContentType: httpHeaders.contentType,
          blobContentMD5: httpHeaders.contentMD5,
          blobContentEncoding: httpHeaders.contentEncoding,
          blobContentLanguage: httpHeaders.contentLanguage,
          blobContentDisposition: httpHeaders.contentDisposition
        },
        {
          ...options,
          tracingOptions: { ...options.tracingOptions, spanOptions }
        }
      );
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Sets user-defined metadata for the specified path (directory of file) as one or more name-value pairs.
   *
   * If no option provided, or no metadata defined in the parameter, the path
   * metadata will be removed.
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/set-blob-metadata
   *
   * @param {Metadata} [metadata] Optional. Replace existing metadata with this value.
   *                              If no value provided the existing metadata will be removed.
   * @param {PathSetMetadataOptions} [options={}] Optional. Options when setting path metadata.
   * @returns {Promise<PathSetMetadataResponse>}
   * @memberof DataLakePathClient
   */
  public async setMetadata(
    metadata?: Metadata,
    options: PathSetMetadataOptions = {}
  ): Promise<PathSetMetadataResponse> {
    const { span, spanOptions } = createSpan(
      "DataLakePathClient-setMetadata",
      options.tracingOptions
    );
    try {
      return await this.blobClient.setMetadata(metadata, {
        ...options,
        customerProvidedKey: undefined, // Doesn't support customer provided key in data lake package yet
        tracingOptions: { ...options.tracingOptions, spanOptions }
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Move directory or file within same file system.
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/datalakestoragegen2/path/create
   *
   * @param {string} destinationPath Destination directory path like "directory" or file path "directory/file".
   *                                 If the destinationPath is authenticated with SAS, add the SAS to the destination path like "directory/file?sasToken".
   * @param {PathMoveOptions} [options] Optional. Options when moving directory or file.
   * @returns {Promise<PathMoveResponse>}
   * @memberof DataLakePathClient
   */
  public async move(destinationPath: string, options?: PathMoveOptions): Promise<PathMoveResponse>;

  /**
   * Move directory or file to another file system.
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/datalakestoragegen2/path/create
   *
   * @param {string} destinationFileSystem Destination file system like "filesystem".
   * @param {string} destinationPath Destination directory path like "directory" or file path "directory/file"
   *                                 If the destinationPath is authenticated with SAS, add the SAS to the destination path like "directory/file?sasToken".
   * @param {PathMoveOptions} [options] Optional. Options when moving directory or file.
   * @returns {Promise<PathMoveResponse>}
   * @memberof DataLakePathClient
   */
  public async move(
    destinationFileSystem: string,
    destinationPath: string,
    options?: PathMoveOptions
  ): Promise<PathMoveResponse>;

  public async move(
    destinationPathOrFileSystem: string,
    destinationPathOrOptions?: string | PathMoveOptions,
    options?: PathMoveOptions
  ): Promise<PathMoveResponse> {
    let destinationFileSystem = this.fileSystemName;
    let destinationPath = destinationPathOrFileSystem;

    if (typeof destinationPathOrOptions === "string") {
      destinationFileSystem = destinationPathOrFileSystem;
      destinationPath = destinationPathOrOptions;
      options = options || {};
    } else {
      options = destinationPathOrOptions || {};
    }

    options.conditions = options.conditions || {};
    options.destinationConditions = options.destinationConditions || {};

    const { span, spanOptions } = createSpan("DataLakePathClient-move", options.tracingOptions);

    const renameSource = getURLPathAndQuery(this.dfsEndpointUrl);

    const split: string[] = destinationPath.split("?");
    let destinationUrl: string;
    if (split.length === 2) {
      const renameDestination = `/${destinationFileSystem}/${split[0]}`;
      destinationUrl = setURLPath(this.dfsEndpointUrl, renameDestination);
      destinationUrl = setURLQueries(destinationUrl, split[1]);
    } else if (split.length === 1) {
      const renameDestination = `/${destinationFileSystem}/${destinationPath}`;
      destinationUrl = setURLPath(this.dfsEndpointUrl, renameDestination);
    } else {
      throw new RangeError("Destination path should not contain more than one query string");
    }

    const destPathClient = new DataLakePathClient(destinationUrl, this.pipeline);

    try {
      return await destPathClient.pathContext.create({
        mode: "legacy", // By default
        renameSource,
        sourceLeaseId: options.conditions.leaseId,
        leaseAccessConditions: options.destinationConditions,
        sourceModifiedAccessConditions: {
          sourceIfMatch: options.conditions.ifMatch,
          sourceIfNoneMatch: options.conditions.ifNoneMatch,
          sourceIfModifiedSince: options.conditions.ifModifiedSince,
          sourceIfUnmodifiedSince: options.conditions.ifUnmodifiedSince
        },
        modifiedAccessConditions: options.destinationConditions,
        spanOptions,
        abortSignal: options.abortSignal
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }
}

/**
 * A DataLakeDirectoryClient represents a URL to the Azure Storage directory.
 *
 * @export
 * @class DataLakeDirectoryClient
 * @extends {DataLakePathClient}
 */
export class DataLakeDirectoryClient extends DataLakePathClient {
  // https://stackoverflow.com/questions/50729485/override-method-with-different-argument-types-in-extended-class-typescript
  /**
   * Create a directory.
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/datalakestoragegen2/path/create
   *
   * @param {PathResourceTypeModel} resourceType Resource type, must be "directory" for DataLakeDirectoryClient.
   * @param {PathCreateOptions} [options] Optional. Options when creating directory.
   * @returns {Promise<PathCreateResponse>}
   * @memberof DataLakeDirectoryClient
   */
  public async create(
    resourceType: PathResourceTypeModel,
    options?: PathCreateOptions
  ): Promise<PathCreateResponse>;

  /**
   * Create a directory.
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/datalakestoragegen2/path/create
   *
   * @param {DirectoryCreateOptions} [options] Optional. Options when creating directory.
   * @returns {Promise<DirectoryCreateResponse>}
   * @memberof DataLakeDirectoryClient
   */
  public async create(options?: DirectoryCreateOptions): Promise<DirectoryCreateResponse>;

  public async create(
    resourceTypeOrOptions?: PathResourceTypeModel | PathCreateOptions,
    options: PathCreateOptions = {}
  ): Promise<PathCreateResponse> {
    if (resourceTypeOrOptions === "directory") {
      return super.create(resourceTypeOrOptions as PathResourceTypeModel, options);
    }

    if (resourceTypeOrOptions === "file") {
      throw TypeError(
        `DataLakeDirectoryClient:create() resourceType cannot be ${resourceTypeOrOptions}. Refer to DataLakeFileClient for file creation.`
      );
    }

    options = resourceTypeOrOptions || {};
    options.conditions = options.conditions || {};
    const { span, spanOptions } = createSpan(
      "DataLakeDirectoryClient-create",
      options.tracingOptions
    );
    try {
      return await super.create("directory", {
        ...options,
        tracingOptions: {
          ...options.tracingOptions,
          spanOptions
        }
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Create a directory if it doesn't already exists.
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/datalakestoragegen2/path/create
   *
   * @param {PathResourceType} resourceType Resource type, must be "directory" for DataLakeDirectoryClient.
   * @param {PathCreateIfNotExistsOptions} [options]
   * @returns {Promise<PathCreateIfNotExistsResponse>}
   * @memberof DataLakeDirectoryClient
   */
  public async createIfNotExists(
    resourceType: PathResourceTypeModel,
    options?: PathCreateIfNotExistsOptions
  ): Promise<PathCreateIfNotExistsResponse>;

  /**
   * Create a directory if it doesn't already exists.
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/datalakestoragegen2/path/create
   *
   * @param {DirectoryCreateIfNotExistsOptions} [options]
   * @returns {Promise<DirectoryCreateIfNotExistsResponse>}
   * @memberof DataLakeDirectoryClient
   */
  public async createIfNotExists(
    options?: DirectoryCreateIfNotExistsOptions
  ): Promise<DirectoryCreateIfNotExistsResponse>;

  public async createIfNotExists(
    resourceTypeOrOptions?: PathResourceTypeModel | PathCreateIfNotExistsOptions,
    options: PathCreateIfNotExistsOptions = {}
  ): Promise<PathCreateIfNotExistsResponse> {
    if (resourceTypeOrOptions === "file") {
      throw TypeError(
        `DataLakeDirectoryClient:createIfNotExists() resourceType cannot be ${resourceTypeOrOptions}. Refer to DataLakeFileClient for file creation.`
      );
    }

    if (resourceTypeOrOptions !== "directory") {
      options = resourceTypeOrOptions || {};
    }

    const { span, spanOptions } = createSpan(
      "DataLakeDirectoryClient-createIfNotExists",
      options.tracingOptions
    );
    try {
      return await super.createIfNotExists("directory", {
        ...options,
        tracingOptions: {
          ...options.tracingOptions,
          spanOptions
        }
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Creates a {@link DataLakeDirectoryClient} object under current directory.
   *
   * @param {string} subdirectoryName Subdirectory name.
   * @returns {DataLakeDirectoryClient}
   * @memberof DataLakeDirectoryClient
   */
  public getSubdirectoryClient(subdirectoryName: string): DataLakeDirectoryClient {
    return new DataLakeDirectoryClient(
      appendToURLPath(this.url, encodeURIComponent(subdirectoryName)),
      this.pipeline
    );
  }

  /**
   * Creates a {@link DataLakeFileClient} object under current directory.
   *
   * @param {string} fileName
   * @returns {DataLakeFileClient}
   * @memberof DataLakeDirectoryClient
   */
  public getFileClient(fileName: string): DataLakeFileClient {
    return new DataLakeFileClient(
      appendToURLPath(this.url, encodeURIComponent(fileName)),
      this.pipeline
    );
  }

  /**
   * Only available for clients constructed with a shared key credential.
   *
   * Generates a Service Shared Access Signature (SAS) URI based on the client properties
   * and parameters passed in. The SAS is signed by the shared key credential of the client.
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/constructing-a-service-sas
   *
   * @param {DirectoryGenerateSasUrlOptions} options Optional parameters.
   * @returns {Promise<string>} The SAS URI consisting of the URI to the resource represented by this client, followed by the generated SAS token.
   * @memberof DataLakeDirectoryClient
   */
  public generateSasUrl(options: DirectoryGenerateSasUrlOptions): Promise<string> {
    return new Promise((resolve) => {
      if (!(this.credential instanceof StorageSharedKeyCredential)) {
        throw RangeError(
          "Can only generate the SAS when the client is initialized with a shared key credential"
        );
      }

      const sas = generateDataLakeSASQueryParameters(
        {
          fileSystemName: this.fileSystemName,
          pathName: this.name,
          isDirectory: true,
          ...options
        },
        this.credential
      ).toString();

      resolve(appendToURLQuery(this.url, sas));
    });
  }
}

/**
 * A DataLakeFileClient represents a URL to the Azure Storage file.
 *
 * @export
 * @class DataLakeFileClient
 * @extends {DataLakePathClient}
 */
export class DataLakeFileClient extends DataLakePathClient {
  /**
   * pathContextInternal provided by protocol layer.
   *
   * @private
   * @type {PathOperations}
   * @memberof DataLakeFileClient
   */
  private pathContextInternal: PathOperations;

  /**
   * pathContextInternal provided by protocol layer, with its url pointing to the Blob endpoint.
   *
   * @private
   * @type {PathOperations}
   * @memberof DataLakeFileClient
   */
  private pathContextInternalToBlobEndpoint: PathOperations;

  /**
   * blockBlobClientInternal provided by @azure/storage-blob package.
   *
   * @private
   * @type {BlockBlobClient}
   * @memberof DataLakeFileClient
   */
  private blockBlobClientInternal: BlockBlobClient;

  /**
   * Creates an instance of DataLakeFileClient from url and credential.
   *
   * @param {string} url A Client string pointing to Azure Storage data lake file, such as
   *                     "https://myaccount.dfs.core.windows.net/filesystem/file".
   *                     You can append a SAS if using AnonymousCredential, such as "https://myaccount.dfs.core.windows.net/filesystem/directory/file?sasString".
   * @param {(StorageSharedKeyCredential | AnonymousCredential | TokenCredential)} [credential] Such as AnonymousCredential, StorageSharedKeyCredential or any credential from the @azure/identity package to authenticate requests to the service. You can also provide an object that implements the TokenCredential interface. If not specified, AnonymousCredential is used.
   * @param {StoragePipelineOptions} [options] Optional. Options to configure the HTTP pipeline.
   * @memberof DataLakeFileClient
   */
  public constructor(
    url: string,
    credential?: StorageSharedKeyCredential | AnonymousCredential | TokenCredential,
    options?: StoragePipelineOptions
  );

  /**
   * Creates an instance of DataLakeFileClient from url and pipeline.
   *
   * @param {string} url A Client string pointing to Azure Storage data lake file, such as
   *                     "https://myaccount.dfs.core.windows.net/filesystem/file".
   *                     You can append a SAS if using AnonymousCredential, such as "https://myaccount.dfs.core.windows.net/filesystem/directory/file?sasString".
   * @param {Pipeline} pipeline Call newPipeline() to create a default
   *                            pipeline, or provide a customized pipeline.
   * @memberof DataLakeFileClient
   */
  public constructor(url: string, pipeline: Pipeline);

  public constructor(
    url: string,
    credentialOrPipeline?:
      | StorageSharedKeyCredential
      | AnonymousCredential
      | TokenCredential
      | Pipeline,
    options?: StoragePipelineOptions
  ) {
    if (credentialOrPipeline instanceof Pipeline) {
      super(url, credentialOrPipeline);
    } else {
      let credential;
      if (credentialOrPipeline === undefined) {
        credential = new AnonymousCredential();
      } else {
        credential = credentialOrPipeline;
      }

      const pipeline = newPipeline(credential, options);
      super(url, pipeline);
    }

    this.pathContextInternal = new PathOperations(this.storageClientContext);
    this.blockBlobClientInternal = new BlockBlobClient(this.blobEndpointUrl, this.pipeline);
    this.pathContextInternalToBlobEndpoint = new PathOperations(
      this.storageClientContextToBlobEndpoint
    );
  }

  /**
   * Create a file.
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/datalakestoragegen2/path/create
   *
   * @param {PathResourceTypeModel} resourceType Resource type, must be "file" for DataLakeFileClient.
   * @param {PathCreateOptions} [options] Optional. Options when creating file.
   * @returns {Promise<PathCreateResponse>}
   * @memberof DataLakeFileClient
   */
  public async create(
    resourceType: PathResourceTypeModel,
    options?: PathCreateOptions
  ): Promise<PathCreateResponse>;

  /**
   * Create a file.
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/datalakestoragegen2/path/create
   *
   * @param {FileCreateOptions} [options] Optional. Options when creating file.
   * @returns {Promise<FileCreateResponse>}
   * @memberof DataLakeFileClient
   */
  public async create(options?: FileCreateOptions): Promise<FileCreateResponse>;

  public async create(
    resourceTypeOrOptions?: PathResourceTypeModel | PathCreateOptions,
    options: PathCreateOptions = {}
  ): Promise<PathCreateResponse> {
    if (resourceTypeOrOptions === "file") {
      return super.create(resourceTypeOrOptions as PathResourceTypeModel, options);
    }

    if (resourceTypeOrOptions === "directory") {
      throw TypeError(
        `DataLakeFileClient:create() resourceType cannot be ${resourceTypeOrOptions}. Refer to DataLakeDirectoryClient for directory creation.`
      );
    }

    options = resourceTypeOrOptions || {};
    options.conditions = options.conditions || {};
    const { span, spanOptions } = createSpan("DataLakeFileClient-create", options.tracingOptions);
    try {
      return await super.create("file", {
        ...options,
        tracingOptions: {
          ...options.tracingOptions,
          spanOptions
        }
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Create a file if it doesn't already exists.
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/datalakestoragegen2/path/create
   *
   * @param {PathResourceType} resourceType Resource type, must be "file" for DataLakeFileClient.
   * @param {PathCreateIfNotExistsOptions} [options]
   * @returns {Promise<PathCreateIfNotExistsResponse>}
   * @memberof DataLakeFileClient
   */
  public async createIfNotExists(
    resourceType: PathResourceTypeModel,
    options?: PathCreateIfNotExistsOptions
  ): Promise<PathCreateIfNotExistsResponse>;

  /**
   * Create a file if it doesn't already exists.
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/datalakestoragegen2/path/create
   *
   * @param {FileCreateIfNotExistsOptions} [options] Optional. Options when creating file.
   * @returns {Promise<FileCreateIfNotExistsResponse>}
   * @memberof DataLakeFileClient
   */
  public async createIfNotExists(
    options?: FileCreateIfNotExistsOptions
  ): Promise<FileCreateIfNotExistsResponse>;

  public async createIfNotExists(
    resourceTypeOrOptions?: PathResourceTypeModel | PathCreateOptions,
    options: PathCreateIfNotExistsOptions = {}
  ): Promise<PathCreateIfNotExistsResponse> {
    if (resourceTypeOrOptions === "directory") {
      throw TypeError(
        `DataLakeFileClient:createIfNotExists() resourceType cannot be ${resourceTypeOrOptions}. Refer to DataLakeDirectoryClient for directory creation.`
      );
    }

    if (resourceTypeOrOptions !== "file") {
      options = resourceTypeOrOptions || {};
    }

    const { span, spanOptions } = createSpan(
      "DataLakeFileClient-createIfNotExists",
      options.tracingOptions
    );
    try {
      return await super.createIfNotExists("file", {
        ...options,
        tracingOptions: {
          ...options.tracingOptions,
          spanOptions
        }
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Downloads a file from the service, including its metadata and properties.
   *
   * * In Node.js, data returns in a Readable stream readableStreamBody
   * * In browsers, data returns in a promise contentAsBlob
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/get-blob
   *
   * * Example usage (Node.js):
   *
   * ```js
   * // Download and convert a file to a string
   * const downloadResponse = await fileClient.read();
   * const downloaded = await streamToBuffer(downloadResponse.readableStreamBody);
   * console.log("Downloaded file content:", downloaded.toString());
   *
   * async function streamToBuffer(readableStream) {
   *   return new Promise((resolve, reject) => {
   *     const chunks = [];
   *     readableStream.on("data", (data) => {
   *       chunks.push(data instanceof Buffer ? data : Buffer.from(data));
   *     });
   *     readableStream.on("end", () => {
   *       resolve(Buffer.concat(chunks));
   *     });
   *     readableStream.on("error", reject);
   *   });
   * }
   * ```
   *
   * Example usage (browser):
   *
   * ```js
   * // Download and convert a file to a string
   * const downloadResponse = await fileClient.read();
   * const downloaded = await blobToString(await downloadResponse.contentAsBlob);
   * console.log("Downloaded file content", downloaded);
   *
   * async function blobToString(blob: Blob): Promise<string> {
   *   const fileReader = new FileReader();
   *   return new Promise<string>((resolve, reject) => {
   *     fileReader.onloadend = (ev: any) => {
   *       resolve(ev.target!.result);
   *     };
   *     fileReader.onerror = reject;
   *     fileReader.readAsText(blob);
   *   });
   * }
   * ```
   *
   * @param {number} [offset=0] Optional. Offset to read file, default value is 0.
   * @param {number} [count] Optional. How many bytes to read, default will read from offset to the end.
   * @param {FileReadOptions} [options={}] Optional. Options when reading file.
   * @returns {Promise<FileReadResponse>}
   * @memberof DataLakeFileClient
   */
  public async read(
    offset: number = 0,
    count?: number,
    options: FileReadOptions = {}
  ): Promise<FileReadResponse> {
    const { span, spanOptions } = createSpan("DataLakeFileClient-read", options.tracingOptions);
    try {
      const rawResponse = await this.blockBlobClientInternal.download(offset, count, {
        ...options,
        tracingOptions: { ...options.tracingOptions, spanOptions }
      });

      const response = rawResponse as FileReadResponse;
      if (!isNode && !response.contentAsBlob) {
        response.contentAsBlob = rawResponse.blobBody;
      }
      response.fileContentMD5 = rawResponse.blobContentMD5;
      response._response.parsedHeaders.fileContentMD5 =
        rawResponse._response.parsedHeaders.blobContentMD5;
      delete rawResponse.blobContentMD5;
      delete rawResponse._response.parsedHeaders.blobContentMD5;

      return response;
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Uploads data to be appended to a file. Data can only be appended to a file.
   * To apply perviously uploaded data to a file, call flush.
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/datalakestoragegen2/path/update
   *
   * @param {HttpRequestBody} body Content to be uploaded.
   * @param {number} offset Append offset in bytes.
   * @param {number} length Length of content to append in bytes.
   * @param {FileAppendOptions} [options={}] Optional. Options when appending data.
   * @returns {Promise<FileAppendResponse>}
   * @memberof DataLakeFileClient
   */
  public async append(
    body: HttpRequestBody,
    offset: number,
    length: number,
    options: FileAppendOptions = {}
  ): Promise<FileAppendResponse> {
    options.conditions = options.conditions || {};
    const { span, spanOptions } = createSpan("DataLakeFileClient-append", options.tracingOptions);
    try {
      return await this.pathContextInternal.appendData(body, {
        pathHttpHeaders: {
          contentMD5: options.transactionalContentMD5
        },
        abortSignal: options.abortSignal,
        position: offset,
        contentLength: length,
        leaseAccessConditions: options.conditions,
        onUploadProgress: options.onProgress,
        spanOptions
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Flushes (writes) previously appended data to a file.
   *
   * @param {number} position File position to flush.
   *                          This parameter allows the caller to upload data in parallel and control the order in which it is appended to the file.
   *                          It is required when uploading data to be appended to the file and when flushing previously uploaded data to the file.
   *                          The value must be the position where the data is to be appended. Uploaded data is not immediately flushed, or written,
   *                          to the file. To flush, the previously uploaded data must be contiguous, the position parameter must be specified and
   *                          equal to the length of the file after all data has been written, and there must not be a request entity body included
   *                          with the request.
   * @param {FileFlushOptions} [options={}] Optional. Options when flushing data.
   * @returns {Promise<FileFlushResponse>}
   * @memberof DataLakeFileClient
   */
  public async flush(position: number, options: FileFlushOptions = {}): Promise<FileFlushResponse> {
    options.conditions = options.conditions || {};
    const { span, spanOptions } = createSpan("DataLakeFileClient-flush", options.tracingOptions);
    try {
      return await this.pathContextInternal.flushData({
        ...options,
        position,
        contentLength: 0,
        leaseAccessConditions: options.conditions,
        modifiedAccessConditions: options.conditions,
        spanOptions
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  // high level functions

  /**
   * ONLY AVAILABLE IN NODE.JS RUNTIME.
   *
   * Uploads a local file to a Data Lake file.
   *
   * @param {string} filePath Full path of the local file
   * @param {FileParallelUploadOptions} [options]
   * @returns {(Promise<FileUploadResponse>)}
   * @memberof DataLakeFileClient
   */
  public async uploadFile(
    filePath: string,
    options: FileParallelUploadOptions = {}
  ): Promise<FileUploadResponse> {
    const { span, spanOptions } = createSpan(
      "DataLakeFileClient-uploadFile",
      options.tracingOptions
    );
    try {
      const size = (await fsStat(filePath)).size;
      return await this.uploadSeekableInternal(
        (offset: number, size: number) => {
          return () =>
            fsCreateReadStream(filePath, {
              autoClose: true,
              end: offset + size - 1,
              start: offset
            });
        },
        size,
        { ...options, tracingOptions: { ...options!.tracingOptions, spanOptions } }
      );
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Uploads a Buffer(Node.js)/Blob/ArrayBuffer/ArrayBufferView to a File.
   *
   * @param {Buffer | Blob | ArrayBuffer | ArrayBufferView} data Buffer(Node), Blob, ArrayBuffer or ArrayBufferView
   * @param {FileParallelUploadOptions} [options]
   * @returns {Promise<FileUploadResponse>}
   * @memberof DataLakeFileClient
   */
  public async upload(
    data: Buffer | Blob | ArrayBuffer | ArrayBufferView,
    options: FileParallelUploadOptions = {}
  ): Promise<FileUploadResponse> {
    const { span, spanOptions } = createSpan("DataLakeFileClient-upload", options.tracingOptions);
    try {
      if (isNode) {
        let buffer: Buffer;
        if (data instanceof Buffer) {
          buffer = data;
        } else if (data instanceof ArrayBuffer) {
          buffer = Buffer.from(data);
        } else {
          data = data as ArrayBufferView;
          buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
        }

        return this.uploadSeekableInternal(
          (offset: number, size: number): Buffer => buffer.slice(offset, offset + size),
          buffer.length,
          {
            ...options,
            tracingOptions: { ...options!.tracingOptions, spanOptions }
          }
        );
      } else {
        const browserBlob = new Blob([data]);
        return this.uploadSeekableInternal(
          (offset: number, size: number): Blob => browserBlob.slice(offset, offset + size),
          browserBlob.size,
          { ...options, tracingOptions: { ...options!.tracingOptions, spanOptions } }
        );
      }
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  private async uploadSeekableInternal(
    bodyFactory: (offset: number, count: number) => HttpRequestBody,
    size: number,
    options: FileParallelUploadOptions = {}
  ): Promise<FileUploadResponse> {
    const { span, spanOptions } = createSpan(
      "DataLakeFileClient-uploadData",
      options.tracingOptions
    );
    try {
      if (size > FILE_MAX_SIZE_BYTES) {
        throw new RangeError(`size must be <= ${FILE_MAX_SIZE_BYTES}.`);
      }

      // Create the file.
      const createRes = this.create({
        abortSignal: options.abortSignal,
        metadata: options.metadata,
        permissions: options.permissions,
        umask: options.umask,
        conditions: options.conditions,
        pathHttpHeaders: options.pathHttpHeaders,
        tracingOptions: { ...options!.tracingOptions, spanOptions }
      });
      // append() with empty data would return error, so do not continue
      if (size === 0) {
        return await createRes;
      } else {
        await createRes;
      }

      // After the File is Create, Lease ID is the only valid request parameter.
      options.conditions = { leaseId: options.conditions?.leaseId };

      if (!options.chunkSize) {
        options.chunkSize = Math.ceil(size / BLOCK_BLOB_MAX_BLOCKS);
        if (options.chunkSize < FILE_UPLOAD_DEFAULT_CHUNK_SIZE) {
          options.chunkSize = FILE_UPLOAD_DEFAULT_CHUNK_SIZE;
        }
      }
      if (options.chunkSize < 1 || options.chunkSize > FILE_UPLOAD_MAX_CHUNK_SIZE) {
        throw new RangeError(`chunkSize option must be >= 1 and <= ${FILE_UPLOAD_MAX_CHUNK_SIZE}`);
      }

      if (!options.maxConcurrency) {
        options.maxConcurrency = DEFAULT_HIGH_LEVEL_CONCURRENCY;
      }
      if (options.maxConcurrency <= 0) {
        throw new RangeError(`maxConcurrency must be > 0.`);
      }

      if (!options.singleUploadThreshold) {
        options.singleUploadThreshold = FILE_MAX_SINGLE_UPLOAD_THRESHOLD;
      }
      if (
        options.singleUploadThreshold < 1 ||
        options.singleUploadThreshold > FILE_MAX_SINGLE_UPLOAD_THRESHOLD
      ) {
        throw new RangeError(
          `singleUploadThreshold option must be >= 1 and <= ${FILE_MAX_SINGLE_UPLOAD_THRESHOLD}`
        );
      }

      // When buffer length <= singleUploadThreshold, this method will use one append/flush call to finish the upload.
      if (size <= options.singleUploadThreshold) {
        await this.append(bodyFactory(0, size), 0, size, {
          abortSignal: options.abortSignal,
          conditions: options.conditions,
          onProgress: options.onProgress,
          tracingOptions: { ...options!.tracingOptions, spanOptions }
        });

        return await this.flush(size, {
          abortSignal: options.abortSignal,
          conditions: options.conditions,
          close: options.close,
          pathHttpHeaders: options.pathHttpHeaders,
          tracingOptions: { ...options!.tracingOptions, spanOptions }
        });
      }

      const numBlocks: number = Math.floor((size - 1) / options.chunkSize) + 1;
      if (numBlocks > BLOCK_BLOB_MAX_BLOCKS) {
        throw new RangeError(
          `The data's size is too big or the chunkSize is too small;` +
            `the number of chunks must be <= ${BLOCK_BLOB_MAX_BLOCKS}`
        );
      }

      let transferProgress: number = 0;
      const batch = new Batch(options.maxConcurrency);

      for (let i = 0; i < numBlocks; i++) {
        batch.addOperation(
          async (): Promise<any> => {
            const start = options.chunkSize! * i;
            const end = i === numBlocks - 1 ? size : start + options.chunkSize!;
            const contentLength = end - start;
            await this.append(bodyFactory(start, contentLength), start, contentLength, {
              abortSignal: options.abortSignal,
              conditions: options.conditions,
              tracingOptions: { ...options!.tracingOptions, spanOptions }
            });

            transferProgress += contentLength;
            if (options.onProgress) {
              options.onProgress({ loadedBytes: transferProgress });
            }
          }
        );
      }
      await batch.do();

      return await this.flush(size, {
        abortSignal: options.abortSignal,
        conditions: options.conditions,
        close: options.close,
        pathHttpHeaders: options.pathHttpHeaders,
        tracingOptions: { ...options!.tracingOptions, spanOptions }
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * ONLY AVAILABLE IN NODE.JS RUNTIME.
   *
   * Uploads a Node.js Readable stream into a Data Lake file.
   * This method will try to create a file, then starts uploading chunk by chunk.
   * Please make sure potential size of stream doesn't exceed FILE_MAX_SIZE_BYTES and
   * potential number of chunks doesn't exceed BLOCK_BLOB_MAX_BLOCKS.
   *
   * PERFORMANCE IMPROVEMENT TIPS:
   * * Input stream highWaterMark is better to set a same value with options.chunkSize
   *   parameter, which will avoid Buffer.concat() operations.
   *
   * @param {Readable} stream Node.js Readable stream.
   * @param {FileParallelUploadOptions} [options]
   * @returns {Promise<FileUploadResponse>}
   * @memberof DataLakeFileClient
   */
  public async uploadStream(
    stream: Readable,
    options: FileParallelUploadOptions = {}
  ): Promise<FileUploadResponse> {
    const { span, spanOptions } = createSpan(
      "DataLakeFileClient-uploadStream",
      options.tracingOptions
    );
    try {
      // Create the file
      await this.create({
        abortSignal: options.abortSignal,
        metadata: options.metadata,
        permissions: options.permissions,
        umask: options.umask,
        conditions: options.conditions,
        pathHttpHeaders: options.pathHttpHeaders,
        tracingOptions: { ...options!.tracingOptions, spanOptions }
      });

      // After the File is Create, Lease ID is the only valid request parameter.
      options.conditions = { leaseId: options.conditions?.leaseId };

      if (!options.chunkSize) {
        options.chunkSize = FILE_UPLOAD_DEFAULT_CHUNK_SIZE;
      }
      if (options.chunkSize < 1 || options.chunkSize > FILE_UPLOAD_MAX_CHUNK_SIZE) {
        throw new RangeError(`chunkSize option must be >= 1 and <= ${FILE_UPLOAD_MAX_CHUNK_SIZE}`);
      }
      if (!options.maxConcurrency) {
        options.maxConcurrency = DEFAULT_HIGH_LEVEL_CONCURRENCY;
      }
      if (options.maxConcurrency <= 0) {
        throw new RangeError(`maxConcurrency must be > 0.`);
      }

      let transferProgress: number = 0;
      const scheduler = new BufferScheduler(
        stream,
        options.chunkSize,
        options.maxConcurrency,
        async (body, length, offset) => {
          await this.append(body, offset!, length, {
            abortSignal: options.abortSignal,
            conditions: options.conditions,
            tracingOptions: { ...options!.tracingOptions, spanOptions }
          });

          // Update progress after block is successfully uploaded to server, in case of block trying
          transferProgress += length;
          if (options.onProgress) {
            options.onProgress({ loadedBytes: transferProgress });
          }
        },
        // concurrency should set a smaller value than maxConcurrency, which is helpful to
        // reduce the possibility when a outgoing handler waits for stream data, in
        // this situation, outgoing handlers are blocked.
        // Outgoing queue shouldn't be empty.
        Math.ceil((options.maxConcurrency / 4) * 3)
      );
      await scheduler.do();

      return await this.flush(transferProgress, {
        abortSignal: options.abortSignal,
        conditions: options.conditions,
        close: options.close,
        pathHttpHeaders: options.pathHttpHeaders,
        tracingOptions: { ...options!.tracingOptions, spanOptions }
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * ONLY AVAILABLE IN NODE.JS RUNTIME.
   *
   * Reads a Data Lake file in parallel to a buffer.
   * Offset and count are optional, pass 0 for both to read the entire file.
   *
   * Warning: Buffers can only support files up to about one gigabyte on 32-bit systems or about two
   * gigabytes on 64-bit systems due to limitations of Node.js/V8. For files larger than this size,
   * consider {@link readToFile}.
   *
   * @param {Buffer} buffer Buffer to be fill, must have length larger than count
   * @param {number} offset From which position of the Data Lake file to read
   * @param {number} [count] How much data to be read. Will read to the end when passing undefined
   * @param {FileReadToBufferOptions} [options]
   * @returns {Promise<Buffer>}
   * @memberof DataLakeFileClient
   */
  public async readToBuffer(
    buffer: Buffer,
    offset?: number,
    count?: number,
    options?: FileReadToBufferOptions
  ): Promise<Buffer>;

  /**
   * ONLY AVAILABLE IN NODE.JS RUNTIME
   *
   * Reads a Data Lake file in parallel to a buffer.
   * Offset and count are optional, pass 0 for both to read the entire file
   *
   * Warning: Buffers can only support files up to about one gigabyte on 32-bit systems or about two
   * gigabytes on 64-bit systems due to limitations of Node.js/V8. For files larger than this size,
   * consider {@link readToFile}.
   *
   * @param {number} offset From which position of the Data Lake file to read(in bytes)
   * @param {number} [count] How much data(in bytes) to be read. Will read to the end when passing undefined
   * @param {FileReadToBufferOptions} [options]
   * @returns {Promise<Buffer>}
   * @memberof DataLakeFileClient
   */
  public async readToBuffer(
    offset?: number,
    count?: number,
    options?: FileReadToBufferOptions
  ): Promise<Buffer>;

  public async readToBuffer(
    bufferOrOffset?: Buffer | number,
    offsetOrCount?: number,
    countOrOptions?: FileReadToBufferOptions | number,
    optOptions: FileReadToBufferOptions = {}
  ): Promise<Buffer> {
    let buffer: Buffer | undefined = undefined;
    let offset = 0;
    let count = 0;
    let options = optOptions;
    if (bufferOrOffset instanceof Buffer) {
      buffer = bufferOrOffset;
      offset = offsetOrCount || 0;
      count = typeof countOrOptions === "number" ? countOrOptions : 0;
    } else {
      offset = typeof bufferOrOffset === "number" ? bufferOrOffset : 0;
      count = typeof offsetOrCount === "number" ? offsetOrCount : 0;
      options = (countOrOptions as FileReadToBufferOptions) || {};
    }
    const { span, spanOptions } = createSpan(
      "DataLakeFileClient-readToBuffer",
      options.tracingOptions
    );
    try {
      if (buffer) {
        return await this.blockBlobClientInternal.downloadToBuffer(buffer, offset, count, {
          ...options,
          maxRetryRequestsPerBlock: options.maxRetryRequestsPerChunk,
          blockSize: options.chunkSize,
          tracingOptions: { ...options!.tracingOptions, spanOptions }
        });
      } else {
        return await this.blockBlobClientInternal.downloadToBuffer(offset, count, {
          ...options,
          maxRetryRequestsPerBlock: options.maxRetryRequestsPerChunk,
          blockSize: options.chunkSize,
          tracingOptions: { ...options!.tracingOptions, spanOptions }
        });
      }
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * ONLY AVAILABLE IN NODE.JS RUNTIME.
   *
   * Downloads a Data Lake file to a local file.
   * Fails if the the given file path already exits.
   * Offset and count are optional, pass 0 and undefined respectively to download the entire file.
   *
   * @param {string} filePath
   * @param {number} [offset] From which position of the file to download.
   * @param {number} [count] How much data to be downloaded. Will download to the end when passing undefined.
   * @param {FileReadOptions} [options] Options to read Data Lake file.
   * @returns {Promise<FileReadResponse>} The response data for file read operation,
   *                                      but with readableStreamBody set to undefined since its
   *                                      content is already read and written into a local file
   *                                      at the specified path.
   * @memberof DataLakeFileClient
   */
  public async readToFile(
    filePath: string,
    offset: number = 0,
    count?: number,
    options: FileReadOptions = {}
  ): Promise<FileReadResponse> {
    const { span, spanOptions } = createSpan(
      "DataLakeFileClient-readToFile",
      options.tracingOptions
    );
    try {
      return await this.blockBlobClientInternal.downloadToFile(filePath, offset, count, {
        ...options,
        tracingOptions: { ...options!.tracingOptions, spanOptions }
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Quick query for a JSON or CSV formatted file.
   *
   * Example usage (Node.js):
   *
   * ```js
   * // Query and convert a file to a string
   * const queryResponse = await fileClient.query("select * from BlobStorage");
   * const downloaded = (await streamToBuffer(queryResponse.readableStreamBody)).toString();
   * console.log("Query file content:", downloaded);
   *
   * async function streamToBuffer(readableStream) {
   *   return new Promise((resolve, reject) => {
   *     const chunks = [];
   *     readableStream.on("data", (data) => {
   *       chunks.push(data instanceof Buffer ? data : Buffer.from(data));
   *     });
   *     readableStream.on("end", () => {
   *       resolve(Buffer.concat(chunks));
   *     });
   *     readableStream.on("error", reject);
   *   });
   * }
   * ```
   *
   * @param {string} query
   * @param {FileQueryOptions} [options={}]
   * @returns {Promise<FileReadResponse>}
   * @memberof DataLakeFileClient
   */
  public async query(query: string, options: FileQueryOptions = {}): Promise<FileReadResponse> {
    const { span, spanOptions } = createSpan("DataLakeFileClient-query", options.tracingOptions);

    try {
      const rawResponse = await this.blockBlobClientInternal.query(query, {
        ...options,
        tracingOptions: { ...options.tracingOptions, spanOptions }
      });
      const response = rawResponse as FileReadResponse;
      if (!isNode && !response.contentAsBlob) {
        response.contentAsBlob = rawResponse.blobBody;
      }
      response.fileContentMD5 = rawResponse.blobContentMD5;
      response._response.parsedHeaders.fileContentMD5 =
        rawResponse._response.parsedHeaders.blobContentMD5;
      delete rawResponse.blobContentMD5;
      delete rawResponse._response.parsedHeaders.blobContentMD5;
      return response;
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Sets an expiry time on a file, once that time is met the file is deleted.
   *
   * @param {FileExpiryMode} mode
   * @param {FileSetExpiryOptions} [options={}]
   * @returns {Promise<FileSetExpiryResponse>}
   * @memberof DataLakeFileClient
   */
  public async setExpiry(
    mode: FileExpiryMode,
    options: FileSetExpiryOptions = {}
  ): Promise<FileSetExpiryResponse> {
    const { span, spanOptions } = createSpan(
      "DataLakeFileClient-setExpiry",
      options.tracingOptions
    );
    try {
      let expiresOn: string | undefined = undefined;
      if (mode === "RelativeToNow" || mode === "RelativeToCreation") {
        if (!options.timeToExpireInMs) {
          throw new Error(`Should specify options.timeToExpireInMs when using mode ${mode}.`);
        }
        // MINOR: need check against <= 2**64, but JS number has the precision problem.
        expiresOn = Math.round(options.timeToExpireInMs).toString();
      }

      if (mode === "Absolute") {
        if (!options.expiresOn) {
          throw new Error(`Should specify options.expiresOn when using mode ${mode}.`);
        }
        const now = new Date();
        if (!(options.expiresOn!.getTime() > now.getTime())) {
          throw new Error(
            `options.expiresOn should be later than now: ${now.toUTCString()} when using mode ${mode}, but is ${options.expiresOn?.toUTCString()}`
          );
        }
        expiresOn = options.expiresOn!.toUTCString();
      }

      const adaptedOptions = { ...options, expiresOn };
      return await this.pathContextInternalToBlobEndpoint.setExpiry(mode, {
        ...adaptedOptions,
        tracingOptions: { ...options.tracingOptions, spanOptions }
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Only available for clients constructed with a shared key credential.
   *
   * Generates a Service Shared Access Signature (SAS) URI based on the client properties
   * and parameters passed in. The SAS is signed by the shared key credential of the client.
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/constructing-a-service-sas
   *
   * @param {FileGenerateSasUrlOptions} options Optional parameters.
   * @returns {Promise<string>} The SAS URI consisting of the URI to the resource represented by this client, followed by the generated SAS token.
   * @memberof DataLakeFileClient
   */
  public generateSasUrl(options: FileGenerateSasUrlOptions): Promise<string> {
    return new Promise((resolve) => {
      if (!(this.credential instanceof StorageSharedKeyCredential)) {
        throw RangeError(
          "Can only generate the SAS when the client is initialized with a shared key credential"
        );
      }

      const sas = generateDataLakeSASQueryParameters(
        {
          fileSystemName: this.fileSystemName,
          pathName: this.name,
          ...options
        },
        this.credential
      ).toString();

      resolve(appendToURLQuery(this.url, sas));
    });
  }
}
