/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for
 * license information.
 *
 * Code generated by Microsoft (R) AutoRest Code Generator.
 * Changes may cause incorrect behavior and will be lost if the code is
 * regenerated.
 */

import * as msRest from "ms-rest-js";
import * as Models from "../models";
import * as Mappers from "../models/workflowsMappers";
import * as Parameters from "../models/parameters";
import { StorageSyncManagementClientContext } from "../storageSyncManagementClientContext";

/** Class representing a Workflows. */
export class Workflows {
  private readonly client: StorageSyncManagementClientContext;

  /**
   * Create a Workflows.
   * @param {StorageSyncManagementClientContext} client Reference to the service client.
   */
  constructor(client: StorageSyncManagementClientContext) {
    this.client = client;
  }

  /**
   * Get a Workflow List
   * @param resourceGroupName The name of the resource group. The name is case insensitive.
   * @param storageSyncServiceName Name of Storage Sync Service resource.
   * @param [options] The optional parameters
   * @returns Promise<Models.WorkflowsListByStorageSyncServiceResponse>
   */
  listByStorageSyncService(resourceGroupName: string, storageSyncServiceName: string, options?: msRest.RequestOptionsBase): Promise<Models.WorkflowsListByStorageSyncServiceResponse>;
  /**
   * @param resourceGroupName The name of the resource group. The name is case insensitive.
   * @param storageSyncServiceName Name of Storage Sync Service resource.
   * @param callback The callback
   */
  listByStorageSyncService(resourceGroupName: string, storageSyncServiceName: string, callback: msRest.ServiceCallback<Models.WorkflowArray>): void;
  /**
   * @param resourceGroupName The name of the resource group. The name is case insensitive.
   * @param storageSyncServiceName Name of Storage Sync Service resource.
   * @param options The optional parameters
   * @param callback The callback
   */
  listByStorageSyncService(resourceGroupName: string, storageSyncServiceName: string, options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<Models.WorkflowArray>): void;
  listByStorageSyncService(resourceGroupName: string, storageSyncServiceName: string, options?: msRest.RequestOptionsBase | msRest.ServiceCallback<Models.WorkflowArray>, callback?: msRest.ServiceCallback<Models.WorkflowArray>): Promise<Models.WorkflowsListByStorageSyncServiceResponse> {
    return this.client.sendOperationRequest(
      {
        resourceGroupName,
        storageSyncServiceName,
        options
      },
      listByStorageSyncServiceOperationSpec,
      callback) as Promise<Models.WorkflowsListByStorageSyncServiceResponse>;
  }

  /**
   * Get Workflows resource
   * @param resourceGroupName The name of the resource group. The name is case insensitive.
   * @param storageSyncServiceName Name of Storage Sync Service resource.
   * @param workflowId workflow Id
   * @param [options] The optional parameters
   * @returns Promise<Models.WorkflowsGetResponse>
   */
  get(resourceGroupName: string, storageSyncServiceName: string, workflowId: string, options?: msRest.RequestOptionsBase): Promise<Models.WorkflowsGetResponse>;
  /**
   * @param resourceGroupName The name of the resource group. The name is case insensitive.
   * @param storageSyncServiceName Name of Storage Sync Service resource.
   * @param workflowId workflow Id
   * @param callback The callback
   */
  get(resourceGroupName: string, storageSyncServiceName: string, workflowId: string, callback: msRest.ServiceCallback<Models.Workflow>): void;
  /**
   * @param resourceGroupName The name of the resource group. The name is case insensitive.
   * @param storageSyncServiceName Name of Storage Sync Service resource.
   * @param workflowId workflow Id
   * @param options The optional parameters
   * @param callback The callback
   */
  get(resourceGroupName: string, storageSyncServiceName: string, workflowId: string, options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<Models.Workflow>): void;
  get(resourceGroupName: string, storageSyncServiceName: string, workflowId: string, options?: msRest.RequestOptionsBase | msRest.ServiceCallback<Models.Workflow>, callback?: msRest.ServiceCallback<Models.Workflow>): Promise<Models.WorkflowsGetResponse> {
    return this.client.sendOperationRequest(
      {
        resourceGroupName,
        storageSyncServiceName,
        workflowId,
        options
      },
      getOperationSpec,
      callback) as Promise<Models.WorkflowsGetResponse>;
  }

  /**
   * Abort the given workflow.
   * @param resourceGroupName The name of the resource group. The name is case insensitive.
   * @param storageSyncServiceName Name of Storage Sync Service resource.
   * @param workflowId workflow Id
   * @param [options] The optional parameters
   * @returns Promise<Models.WorkflowsAbortResponse>
   */
  abort(resourceGroupName: string, storageSyncServiceName: string, workflowId: string, options?: msRest.RequestOptionsBase): Promise<Models.WorkflowsAbortResponse>;
  /**
   * @param resourceGroupName The name of the resource group. The name is case insensitive.
   * @param storageSyncServiceName Name of Storage Sync Service resource.
   * @param workflowId workflow Id
   * @param callback The callback
   */
  abort(resourceGroupName: string, storageSyncServiceName: string, workflowId: string, callback: msRest.ServiceCallback<void>): void;
  /**
   * @param resourceGroupName The name of the resource group. The name is case insensitive.
   * @param storageSyncServiceName Name of Storage Sync Service resource.
   * @param workflowId workflow Id
   * @param options The optional parameters
   * @param callback The callback
   */
  abort(resourceGroupName: string, storageSyncServiceName: string, workflowId: string, options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<void>): void;
  abort(resourceGroupName: string, storageSyncServiceName: string, workflowId: string, options?: msRest.RequestOptionsBase | msRest.ServiceCallback<void>, callback?: msRest.ServiceCallback<void>): Promise<Models.WorkflowsAbortResponse> {
    return this.client.sendOperationRequest(
      {
        resourceGroupName,
        storageSyncServiceName,
        workflowId,
        options
      },
      abortOperationSpec,
      callback) as Promise<Models.WorkflowsAbortResponse>;
  }
}

// Operation Specifications
const serializer = new msRest.Serializer(Mappers);
const listByStorageSyncServiceOperationSpec: msRest.OperationSpec = {
  httpMethod: "GET",
  path: "subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.StorageSync/storageSyncServices/{storageSyncServiceName}/workflows",
  urlParameters: [
    Parameters.subscriptionId,
    Parameters.resourceGroupName,
    Parameters.storageSyncServiceName
  ],
  queryParameters: [
    Parameters.apiVersion
  ],
  headerParameters: [
    Parameters.acceptLanguage
  ],
  responses: {
    200: {
      bodyMapper: Mappers.WorkflowArray,
      headersMapper: Mappers.WorkflowsListByStorageSyncServiceHeaders
    },
    default: {
      bodyMapper: Mappers.StorageSyncError
    }
  },
  serializer
};

const getOperationSpec: msRest.OperationSpec = {
  httpMethod: "GET",
  path: "subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.StorageSync/storageSyncServices/{storageSyncServiceName}/workflows/{workflowId}",
  urlParameters: [
    Parameters.subscriptionId,
    Parameters.resourceGroupName,
    Parameters.storageSyncServiceName,
    Parameters.workflowId
  ],
  queryParameters: [
    Parameters.apiVersion
  ],
  headerParameters: [
    Parameters.acceptLanguage
  ],
  responses: {
    200: {
      bodyMapper: Mappers.Workflow,
      headersMapper: Mappers.WorkflowsGetHeaders
    },
    default: {
      bodyMapper: Mappers.StorageSyncError
    }
  },
  serializer
};

const abortOperationSpec: msRest.OperationSpec = {
  httpMethod: "POST",
  path: "subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.StorageSync/storageSyncServices/{storageSyncServiceName}/workflows/{workflowId}/abort",
  urlParameters: [
    Parameters.subscriptionId,
    Parameters.resourceGroupName,
    Parameters.storageSyncServiceName,
    Parameters.workflowId
  ],
  queryParameters: [
    Parameters.apiVersion
  ],
  headerParameters: [
    Parameters.acceptLanguage
  ],
  responses: {
    200: {
      headersMapper: Mappers.WorkflowsAbortHeaders
    },
    default: {
      bodyMapper: Mappers.StorageSyncError
    }
  },
  serializer
};
