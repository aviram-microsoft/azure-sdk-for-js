/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT License.
 *
 * Code generated by Microsoft (R) AutoRest Code Generator.
 * Changes may cause incorrect behavior and will be lost if the code is regenerated.
 */

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { NetworkManagementClient } from "@azure/arm-network";
import { DefaultAzureCredential } from "@azure/identity";

/**
 * This sample demonstrates how to Deletes the specified rule from a route filter.
 *
 * @summary Deletes the specified rule from a route filter.
 * x-ms-original-file: specification/network/resource-manager/Microsoft.Network/stable/2022-05-01/examples/RouteFilterRuleDelete.json
 */
async function routeFilterRuleDelete() {
  const subscriptionId = "subid";
  const resourceGroupName = "rg1";
  const routeFilterName = "filterName";
  const ruleName = "ruleName";
  const credential = new DefaultAzureCredential();
  const client = new NetworkManagementClient(credential, subscriptionId);
  const result = await client.routeFilterRules.beginDeleteAndWait(
    resourceGroupName,
    routeFilterName,
    ruleName
  );
  console.log(result);
}

routeFilterRuleDelete().catch(console.error);
