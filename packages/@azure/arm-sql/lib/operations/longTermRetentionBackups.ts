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
import * as msRestAzure from "ms-rest-azure-js";
import * as Models from "../models";
import * as Mappers from "../models/longTermRetentionBackupsMappers";
import * as Parameters from "../models/parameters";
import { SqlManagementClientContext } from "../sqlManagementClientContext";

/** Class representing a LongTermRetentionBackups. */
export class LongTermRetentionBackups {
  private readonly client: SqlManagementClientContext;

  /**
   * Create a LongTermRetentionBackups.
   * @param {SqlManagementClientContext} client Reference to the service client.
   */
  constructor(client: SqlManagementClientContext) {
    this.client = client;
  }

  /**
   * Gets a long term retention backup.
   * @param locationName The location of the database.
   * @param longTermRetentionServerName
   * @param longTermRetentionDatabaseName
   * @param backupName The backup name.
   * @param [options] The optional parameters
   * @returns Promise<Models.LongTermRetentionBackupsGetResponse>
   */
  get(locationName: string, longTermRetentionServerName: string, longTermRetentionDatabaseName: string, backupName: string, options?: msRest.RequestOptionsBase): Promise<Models.LongTermRetentionBackupsGetResponse>;
  /**
   * @param locationName The location of the database.
   * @param longTermRetentionServerName
   * @param longTermRetentionDatabaseName
   * @param backupName The backup name.
   * @param callback The callback
   */
  get(locationName: string, longTermRetentionServerName: string, longTermRetentionDatabaseName: string, backupName: string, callback: msRest.ServiceCallback<Models.LongTermRetentionBackup>): void;
  /**
   * @param locationName The location of the database.
   * @param longTermRetentionServerName
   * @param longTermRetentionDatabaseName
   * @param backupName The backup name.
   * @param options The optional parameters
   * @param callback The callback
   */
  get(locationName: string, longTermRetentionServerName: string, longTermRetentionDatabaseName: string, backupName: string, options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<Models.LongTermRetentionBackup>): void;
  get(locationName: string, longTermRetentionServerName: string, longTermRetentionDatabaseName: string, backupName: string, options?: msRest.RequestOptionsBase | msRest.ServiceCallback<Models.LongTermRetentionBackup>, callback?: msRest.ServiceCallback<Models.LongTermRetentionBackup>): Promise<Models.LongTermRetentionBackupsGetResponse> {
    return this.client.sendOperationRequest(
      {
        locationName,
        longTermRetentionServerName,
        longTermRetentionDatabaseName,
        backupName,
        options
      },
      getOperationSpec,
      callback) as Promise<Models.LongTermRetentionBackupsGetResponse>;
  }

  /**
   * Deletes a long term retention backup.
   * @param locationName The location of the database
   * @param longTermRetentionServerName
   * @param longTermRetentionDatabaseName
   * @param backupName The backup name.
   * @param [options] The optional parameters
   * @returns Promise<msRest.RestResponse>
   */
  deleteMethod(locationName: string, longTermRetentionServerName: string, longTermRetentionDatabaseName: string, backupName: string, options?: msRest.RequestOptionsBase): Promise<msRest.RestResponse> {
    return this.beginDeleteMethod(locationName,longTermRetentionServerName,longTermRetentionDatabaseName,backupName,options)
      .then(lroPoller => lroPoller.pollUntilFinished());
  }

  /**
   * Lists all long term retention backups for a database.
   * @param locationName The location of the database
   * @param longTermRetentionServerName
   * @param longTermRetentionDatabaseName
   * @param [options] The optional parameters
   * @returns Promise<Models.LongTermRetentionBackupsListByDatabaseResponse>
   */
  listByDatabase(locationName: string, longTermRetentionServerName: string, longTermRetentionDatabaseName: string, options?: Models.LongTermRetentionBackupsListByDatabaseOptionalParams): Promise<Models.LongTermRetentionBackupsListByDatabaseResponse>;
  /**
   * @param locationName The location of the database
   * @param longTermRetentionServerName
   * @param longTermRetentionDatabaseName
   * @param callback The callback
   */
  listByDatabase(locationName: string, longTermRetentionServerName: string, longTermRetentionDatabaseName: string, callback: msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>): void;
  /**
   * @param locationName The location of the database
   * @param longTermRetentionServerName
   * @param longTermRetentionDatabaseName
   * @param options The optional parameters
   * @param callback The callback
   */
  listByDatabase(locationName: string, longTermRetentionServerName: string, longTermRetentionDatabaseName: string, options: Models.LongTermRetentionBackupsListByDatabaseOptionalParams, callback: msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>): void;
  listByDatabase(locationName: string, longTermRetentionServerName: string, longTermRetentionDatabaseName: string, options?: Models.LongTermRetentionBackupsListByDatabaseOptionalParams | msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>, callback?: msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>): Promise<Models.LongTermRetentionBackupsListByDatabaseResponse> {
    return this.client.sendOperationRequest(
      {
        locationName,
        longTermRetentionServerName,
        longTermRetentionDatabaseName,
        options
      },
      listByDatabaseOperationSpec,
      callback) as Promise<Models.LongTermRetentionBackupsListByDatabaseResponse>;
  }

  /**
   * Lists the long term retention backups for a given location.
   * @param locationName The location of the database
   * @param [options] The optional parameters
   * @returns Promise<Models.LongTermRetentionBackupsListByLocationResponse>
   */
  listByLocation(locationName: string, options?: Models.LongTermRetentionBackupsListByLocationOptionalParams): Promise<Models.LongTermRetentionBackupsListByLocationResponse>;
  /**
   * @param locationName The location of the database
   * @param callback The callback
   */
  listByLocation(locationName: string, callback: msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>): void;
  /**
   * @param locationName The location of the database
   * @param options The optional parameters
   * @param callback The callback
   */
  listByLocation(locationName: string, options: Models.LongTermRetentionBackupsListByLocationOptionalParams, callback: msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>): void;
  listByLocation(locationName: string, options?: Models.LongTermRetentionBackupsListByLocationOptionalParams | msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>, callback?: msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>): Promise<Models.LongTermRetentionBackupsListByLocationResponse> {
    return this.client.sendOperationRequest(
      {
        locationName,
        options
      },
      listByLocationOperationSpec,
      callback) as Promise<Models.LongTermRetentionBackupsListByLocationResponse>;
  }

  /**
   * Lists the long term retention backups for a given server.
   * @param locationName The location of the database
   * @param longTermRetentionServerName
   * @param [options] The optional parameters
   * @returns Promise<Models.LongTermRetentionBackupsListByServerResponse>
   */
  listByServer(locationName: string, longTermRetentionServerName: string, options?: Models.LongTermRetentionBackupsListByServerOptionalParams): Promise<Models.LongTermRetentionBackupsListByServerResponse>;
  /**
   * @param locationName The location of the database
   * @param longTermRetentionServerName
   * @param callback The callback
   */
  listByServer(locationName: string, longTermRetentionServerName: string, callback: msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>): void;
  /**
   * @param locationName The location of the database
   * @param longTermRetentionServerName
   * @param options The optional parameters
   * @param callback The callback
   */
  listByServer(locationName: string, longTermRetentionServerName: string, options: Models.LongTermRetentionBackupsListByServerOptionalParams, callback: msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>): void;
  listByServer(locationName: string, longTermRetentionServerName: string, options?: Models.LongTermRetentionBackupsListByServerOptionalParams | msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>, callback?: msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>): Promise<Models.LongTermRetentionBackupsListByServerResponse> {
    return this.client.sendOperationRequest(
      {
        locationName,
        longTermRetentionServerName,
        options
      },
      listByServerOperationSpec,
      callback) as Promise<Models.LongTermRetentionBackupsListByServerResponse>;
  }

  /**
   * Deletes a long term retention backup.
   * @param locationName The location of the database
   * @param longTermRetentionServerName
   * @param longTermRetentionDatabaseName
   * @param backupName The backup name.
   * @param [options] The optional parameters
   * @returns Promise<msRestAzure.LROPoller>
   */
  beginDeleteMethod(locationName: string, longTermRetentionServerName: string, longTermRetentionDatabaseName: string, backupName: string, options?: msRest.RequestOptionsBase): Promise<msRestAzure.LROPoller> {
    return this.client.sendLRORequest(
      {
        locationName,
        longTermRetentionServerName,
        longTermRetentionDatabaseName,
        backupName,
        options
      },
      beginDeleteMethodOperationSpec,
      options);
  }

  /**
   * Lists all long term retention backups for a database.
   * @param nextPageLink The NextLink from the previous successful call to List operation.
   * @param [options] The optional parameters
   * @returns Promise<Models.LongTermRetentionBackupsListByDatabaseNextResponse>
   */
  listByDatabaseNext(nextPageLink: string, options?: msRest.RequestOptionsBase): Promise<Models.LongTermRetentionBackupsListByDatabaseNextResponse>;
  /**
   * @param nextPageLink The NextLink from the previous successful call to List operation.
   * @param callback The callback
   */
  listByDatabaseNext(nextPageLink: string, callback: msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>): void;
  /**
   * @param nextPageLink The NextLink from the previous successful call to List operation.
   * @param options The optional parameters
   * @param callback The callback
   */
  listByDatabaseNext(nextPageLink: string, options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>): void;
  listByDatabaseNext(nextPageLink: string, options?: msRest.RequestOptionsBase | msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>, callback?: msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>): Promise<Models.LongTermRetentionBackupsListByDatabaseNextResponse> {
    return this.client.sendOperationRequest(
      {
        nextPageLink,
        options
      },
      listByDatabaseNextOperationSpec,
      callback) as Promise<Models.LongTermRetentionBackupsListByDatabaseNextResponse>;
  }

  /**
   * Lists the long term retention backups for a given location.
   * @param nextPageLink The NextLink from the previous successful call to List operation.
   * @param [options] The optional parameters
   * @returns Promise<Models.LongTermRetentionBackupsListByLocationNextResponse>
   */
  listByLocationNext(nextPageLink: string, options?: msRest.RequestOptionsBase): Promise<Models.LongTermRetentionBackupsListByLocationNextResponse>;
  /**
   * @param nextPageLink The NextLink from the previous successful call to List operation.
   * @param callback The callback
   */
  listByLocationNext(nextPageLink: string, callback: msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>): void;
  /**
   * @param nextPageLink The NextLink from the previous successful call to List operation.
   * @param options The optional parameters
   * @param callback The callback
   */
  listByLocationNext(nextPageLink: string, options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>): void;
  listByLocationNext(nextPageLink: string, options?: msRest.RequestOptionsBase | msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>, callback?: msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>): Promise<Models.LongTermRetentionBackupsListByLocationNextResponse> {
    return this.client.sendOperationRequest(
      {
        nextPageLink,
        options
      },
      listByLocationNextOperationSpec,
      callback) as Promise<Models.LongTermRetentionBackupsListByLocationNextResponse>;
  }

  /**
   * Lists the long term retention backups for a given server.
   * @param nextPageLink The NextLink from the previous successful call to List operation.
   * @param [options] The optional parameters
   * @returns Promise<Models.LongTermRetentionBackupsListByServerNextResponse>
   */
  listByServerNext(nextPageLink: string, options?: msRest.RequestOptionsBase): Promise<Models.LongTermRetentionBackupsListByServerNextResponse>;
  /**
   * @param nextPageLink The NextLink from the previous successful call to List operation.
   * @param callback The callback
   */
  listByServerNext(nextPageLink: string, callback: msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>): void;
  /**
   * @param nextPageLink The NextLink from the previous successful call to List operation.
   * @param options The optional parameters
   * @param callback The callback
   */
  listByServerNext(nextPageLink: string, options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>): void;
  listByServerNext(nextPageLink: string, options?: msRest.RequestOptionsBase | msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>, callback?: msRest.ServiceCallback<Models.LongTermRetentionBackupListResult>): Promise<Models.LongTermRetentionBackupsListByServerNextResponse> {
    return this.client.sendOperationRequest(
      {
        nextPageLink,
        options
      },
      listByServerNextOperationSpec,
      callback) as Promise<Models.LongTermRetentionBackupsListByServerNextResponse>;
  }
}

// Operation Specifications
const serializer = new msRest.Serializer(Mappers);
const getOperationSpec: msRest.OperationSpec = {
  httpMethod: "GET",
  path: "subscriptions/{subscriptionId}/providers/Microsoft.Sql/locations/{locationName}/longTermRetentionServers/{longTermRetentionServerName}/longTermRetentionDatabases/{longTermRetentionDatabaseName}/longTermRetentionBackups/{backupName}",
  urlParameters: [
    Parameters.locationName,
    Parameters.longTermRetentionServerName,
    Parameters.longTermRetentionDatabaseName,
    Parameters.backupName,
    Parameters.subscriptionId
  ],
  queryParameters: [
    Parameters.apiVersion3
  ],
  headerParameters: [
    Parameters.acceptLanguage
  ],
  responses: {
    200: {
      bodyMapper: Mappers.LongTermRetentionBackup
    },
    default: {
      bodyMapper: Mappers.CloudError
    }
  },
  serializer
};

const listByDatabaseOperationSpec: msRest.OperationSpec = {
  httpMethod: "GET",
  path: "subscriptions/{subscriptionId}/providers/Microsoft.Sql/locations/{locationName}/longTermRetentionServers/{longTermRetentionServerName}/longTermRetentionDatabases/{longTermRetentionDatabaseName}/longTermRetentionBackups",
  urlParameters: [
    Parameters.locationName,
    Parameters.longTermRetentionServerName,
    Parameters.longTermRetentionDatabaseName,
    Parameters.subscriptionId
  ],
  queryParameters: [
    Parameters.onlyLatestPerDatabase,
    Parameters.databaseState,
    Parameters.apiVersion3
  ],
  headerParameters: [
    Parameters.acceptLanguage
  ],
  responses: {
    200: {
      bodyMapper: Mappers.LongTermRetentionBackupListResult
    },
    default: {
      bodyMapper: Mappers.CloudError
    }
  },
  serializer
};

const listByLocationOperationSpec: msRest.OperationSpec = {
  httpMethod: "GET",
  path: "subscriptions/{subscriptionId}/providers/Microsoft.Sql/locations/{locationName}/longTermRetentionBackups",
  urlParameters: [
    Parameters.locationName,
    Parameters.subscriptionId
  ],
  queryParameters: [
    Parameters.onlyLatestPerDatabase,
    Parameters.databaseState,
    Parameters.apiVersion3
  ],
  headerParameters: [
    Parameters.acceptLanguage
  ],
  responses: {
    200: {
      bodyMapper: Mappers.LongTermRetentionBackupListResult
    },
    default: {
      bodyMapper: Mappers.CloudError
    }
  },
  serializer
};

const listByServerOperationSpec: msRest.OperationSpec = {
  httpMethod: "GET",
  path: "subscriptions/{subscriptionId}/providers/Microsoft.Sql/locations/{locationName}/longTermRetentionServers/{longTermRetentionServerName}/longTermRetentionBackups",
  urlParameters: [
    Parameters.locationName,
    Parameters.longTermRetentionServerName,
    Parameters.subscriptionId
  ],
  queryParameters: [
    Parameters.onlyLatestPerDatabase,
    Parameters.databaseState,
    Parameters.apiVersion3
  ],
  headerParameters: [
    Parameters.acceptLanguage
  ],
  responses: {
    200: {
      bodyMapper: Mappers.LongTermRetentionBackupListResult
    },
    default: {
      bodyMapper: Mappers.CloudError
    }
  },
  serializer
};

const beginDeleteMethodOperationSpec: msRest.OperationSpec = {
  httpMethod: "DELETE",
  path: "subscriptions/{subscriptionId}/providers/Microsoft.Sql/locations/{locationName}/longTermRetentionServers/{longTermRetentionServerName}/longTermRetentionDatabases/{longTermRetentionDatabaseName}/longTermRetentionBackups/{backupName}",
  urlParameters: [
    Parameters.locationName,
    Parameters.longTermRetentionServerName,
    Parameters.longTermRetentionDatabaseName,
    Parameters.backupName,
    Parameters.subscriptionId
  ],
  queryParameters: [
    Parameters.apiVersion3
  ],
  headerParameters: [
    Parameters.acceptLanguage
  ],
  responses: {
    200: {},
    202: {},
    default: {
      bodyMapper: Mappers.CloudError
    }
  },
  serializer
};

const listByDatabaseNextOperationSpec: msRest.OperationSpec = {
  httpMethod: "GET",
  baseUrl: "https://management.azure.com",
  path: "{nextLink}",
  urlParameters: [
    Parameters.nextPageLink
  ],
  headerParameters: [
    Parameters.acceptLanguage
  ],
  responses: {
    200: {
      bodyMapper: Mappers.LongTermRetentionBackupListResult
    },
    default: {
      bodyMapper: Mappers.CloudError
    }
  },
  serializer
};

const listByLocationNextOperationSpec: msRest.OperationSpec = {
  httpMethod: "GET",
  baseUrl: "https://management.azure.com",
  path: "{nextLink}",
  urlParameters: [
    Parameters.nextPageLink
  ],
  headerParameters: [
    Parameters.acceptLanguage
  ],
  responses: {
    200: {
      bodyMapper: Mappers.LongTermRetentionBackupListResult
    },
    default: {
      bodyMapper: Mappers.CloudError
    }
  },
  serializer
};

const listByServerNextOperationSpec: msRest.OperationSpec = {
  httpMethod: "GET",
  baseUrl: "https://management.azure.com",
  path: "{nextLink}",
  urlParameters: [
    Parameters.nextPageLink
  ],
  headerParameters: [
    Parameters.acceptLanguage
  ],
  responses: {
    200: {
      bodyMapper: Mappers.LongTermRetentionBackupListResult
    },
    default: {
      bodyMapper: Mappers.CloudError
    }
  },
  serializer
};
