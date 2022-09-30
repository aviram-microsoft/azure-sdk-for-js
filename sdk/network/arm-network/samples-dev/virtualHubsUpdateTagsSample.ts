/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT License.
 *
 * Code generated by Microsoft (R) AutoRest Code Generator.
 * Changes may cause incorrect behavior and will be lost if the code is regenerated.
 */

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { TagsObject, NetworkManagementClient } from "@azure/arm-network";
import { DefaultAzureCredential } from "@azure/identity";

/**
 * This sample demonstrates how to Updates VirtualHub tags.
 *
 * @summary Updates VirtualHub tags.
 * x-ms-original-file: specification/network/resource-manager/Microsoft.Network/stable/2022-05-01/examples/VirtualHubUpdateTags.json
 */
async function virtualHubUpdate() {
  const subscriptionId = "subid";
  const resourceGroupName = "rg1";
  const virtualHubName = "virtualHub2";
  const virtualHubParameters: TagsObject = {
    tags: { key1: "value1", key2: "value2" }
  };
  const credential = new DefaultAzureCredential();
  const client = new NetworkManagementClient(credential, subscriptionId);
  const result = await client.virtualHubs.updateTags(
    resourceGroupName,
    virtualHubName,
    virtualHubParameters
  );
  console.log(result);
}

virtualHubUpdate().catch(console.error);
