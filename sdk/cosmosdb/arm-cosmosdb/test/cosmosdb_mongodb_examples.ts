/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT License.
 *
 * Code generated by Microsoft (R) AutoRest Code Generator.
 * Changes may cause incorrect behavior and will be lost if the code is regenerated.
 */

import {
  env,
  Recorder,
  RecorderStartOptions,
  delay,
  isPlaybackMode,
} from "@azure-tools/test-recorder";
import { createTestCredential } from "@azure-tools/test-credential";
import { assert } from "chai";
import { Context } from "mocha";
import { CosmosDBManagementClient } from "../src/cosmosDBManagementClient";



const replaceableVariables: Record<string, string> = {
  AZURE_CLIENT_ID: "azure_client_id",
  AZURE_CLIENT_SECRET: "azure_client_secret",
  AZURE_TENANT_ID: "88888888-8888-8888-8888-888888888888",
  SUBSCRIPTION_ID: "azure_subscription_id"
};

const recorderOptions: RecorderStartOptions = {
  envSetupForPlayback: replaceableVariables
};
export const testPollingOptions = {
  updateIntervalInMs: isPlaybackMode() ? 0 : undefined,
};

describe("Cosmosdb test", () => {
  let recorder: Recorder;
  let client: CosmosDBManagementClient;
  let subscriptionId: string;
  let location: string;
  let resourceGroupName: string;
  let accountName: string;
  let databaseName: string;

  beforeEach(async function (this: Context) {
    recorder = new Recorder(this.currentTest);
    await recorder.start(recorderOptions);
    subscriptionId = env.SUBSCRIPTION_ID || '';
    // This is an example of how the environment variables are used
    const credential = createTestCredential();
    client = new CosmosDBManagementClient(credential, subscriptionId, recorder.configureClientOptions({}));
    location = "eastus";
    resourceGroupName = "myjstest";
    accountName = "myaccountxxyy3";
    databaseName = "mydatabasexxxx";
  });

  afterEach(async function () {
    await recorder.stop();
  });

  it("databaseAccounts create for mongoDBResources test", async function () {
    const res = await client.databaseAccounts.beginCreateOrUpdateAndWait(resourceGroupName, accountName, {
      kind: "MongoDB",
      databaseAccountOfferType: "Standard",
      locations: [
        {
          failoverPriority: 0,
          locationName: "eastus",
          isZoneRedundant: false
        }
      ],
      location: location,
      apiProperties: {},
      createMode: "Default"
    }, testPollingOptions);
    assert.equal(res.name, accountName);
  });

  it("mongoDBResources create test", async function () {
    const res = await client.mongoDBResources.beginCreateUpdateMongoDBDatabaseAndWait(resourceGroupName, accountName, databaseName, {
      location: location,
      resource: {
        id: databaseName
      },
      options: {
        throughput: 2000
      }
    }, testPollingOptions);
    assert.equal(res.type, "Microsoft.DocumentDB/databaseAccounts/mongodbDatabases")
  });

  it("mongoDBResources update test", async function () {
    const res = await client.mongoDBResources.beginUpdateMongoDBDatabaseThroughputAndWait(resourceGroupName, accountName, databaseName, {
      location: location,
      resource: {
        throughput: 400
      }
    }, testPollingOptions);
    assert.equal(res.resource?.throughput, 400);
  });

  it("mongoDBResources get test", async function () {
    const res = await client.mongoDBResources.getMongoDBDatabase(resourceGroupName, accountName, databaseName);
    assert.equal(res.type, "Microsoft.DocumentDB/databaseAccounts/mongodbDatabases");
  });

  it("mongoDBResources list test", async function () {
    for await (let item of client.mongoDBResources.listMongoDBDatabases(resourceGroupName, accountName)) {
      assert.equal(item.type, "Microsoft.DocumentDB/databaseAccounts/mongodbDatabases");
    }
  });

  it("mongoDBResources migrate test", async function () {
    const res = await client.mongoDBResources.beginMigrateMongoDBDatabaseToAutoscaleAndWait(resourceGroupName, accountName, databaseName, testPollingOptions);
    assert.equal(res.type, "Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/throughputSettings/migrateToAutoscale");
  });

  it("mongoDBResources delete test", async function () {
    await client.mongoDBResources.beginDeleteMongoDBDatabaseAndWait(resourceGroupName, accountName, databaseName, testPollingOptions);
    const resArray = new Array();
    for await (let item of client.mongoDBResources.listMongoDBDatabases(resourceGroupName, accountName)) {
      resArray.push(item);
    }
    assert.equal(resArray.length, 0);
  });
});
