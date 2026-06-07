import { getUncachableRevenueCatClient } from "./revenueCatClient";

import {
  listProjects,
  createProject,
  listApps,
  createApp,
  listAppPublicApiKeys,
  listProducts,
  createProduct,
  listEntitlements,
  createEntitlement,
  attachProductsToEntitlement,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Project,
  type Entitlement,
  type Offering,
  type Package,
  type CreateProductData,
} from "@replit/revenuecat-sdk";

// ─── Judith project constants ─────────────────────────────────────────────────
const PROJECT_NAME = "Judith";

const APP_STORE_APP_NAME = "Judith iOS";
const APP_STORE_BUNDLE_ID = "com.app.judith";
const PLAY_STORE_APP_NAME = "Judith Android";
const PLAY_STORE_PACKAGE_NAME = "com.app.judith";

// Products — one per tier per store
// App Store / test store use the flat identifier; Play Store requires {id}:{basePlanId}
const CHAT_PRODUCT_ID = "chat_ask";
const VOICE_PRODUCT_ID = "voice_ask";
const CHAT_PRODUCT_ID_PLAY = "chat_ask:monthly";
const VOICE_PRODUCT_ID_PLAY = "voice_ask:monthly";

const PRODUCT_DURATION = "P1M";

// Prices in PHP micros (₱ × 1,000,000)
const CHAT_PRICES = [{ amount_micros: 99_000_000, currency: "PHP" }];
const VOICE_PRICES = [{ amount_micros: 199_000_000, currency: "PHP" }];

// Entitlements
const CHAT_ENTITLEMENT_ID = "chat_ask";
const VOICE_ENTITLEMENT_ID = "voice_ask";

// Offering + packages
const OFFERING_ID = "default";
const OFFERING_DISPLAY_NAME = "Default Offering";
const CHAT_PKG_ID = "chat_ask";
const VOICE_PKG_ID = "voice_ask";

// ─── Types ────────────────────────────────────────────────────────────────────
type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function ensureProduct(
  client: Awaited<ReturnType<typeof getUncachableRevenueCatClient>>,
  project: Project,
  targetApp: App,
  label: string,
  storeIdentifier: string,
  displayName: string,
  isTestStore: boolean,
): Promise<Product> {
  const { data: existingProducts, error } = await listProducts({
    client,
    path: { project_id: project.id },
    query: { limit: 100 },
  });
  if (error) throw new Error(`Failed to list products: ${JSON.stringify(error)}`);

  const existing = existingProducts.items?.find(
    (p) => p.store_identifier === storeIdentifier && p.app_id === targetApp.id,
  );
  if (existing) {
    console.log(`  ${label} product already exists: ${existing.id}`);
    return existing;
  }

  const body: CreateProductData["body"] = {
    store_identifier: storeIdentifier,
    app_id: targetApp.id,
    type: "subscription",
    display_name: displayName,
  };
  if (isTestStore) {
    body.subscription = { duration: PRODUCT_DURATION };
    body.title = displayName;
  }

  const { data: created, error: createErr } = await createProduct({
    client,
    path: { project_id: project.id },
    body,
  });
  if (createErr) throw new Error(`Failed to create ${label} product: ${JSON.stringify(createErr)}`);
  console.log(`  Created ${label} product: ${created.id}`);
  return created;
}

async function setTestStorePrices(
  client: Awaited<ReturnType<typeof getUncachableRevenueCatClient>>,
  project: Project,
  product: Product,
  prices: { amount_micros: number; currency: string }[],
  label: string,
) {
  const { data, error } = await client.post<TestStorePricesResponse>({
    url: "/projects/{project_id}/products/{product_id}/test_store_prices",
    path: { project_id: project.id, product_id: product.id },
    body: { prices },
  });
  if (error) {
    if (
      error &&
      typeof error === "object" &&
      "type" in error &&
      error["type"] === "resource_already_exists"
    ) {
      console.log(`  ${label} test store prices already set`);
    } else {
      throw new Error(`Failed to set ${label} prices: ${JSON.stringify(error)}`);
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.log(`  Set ${label} test store prices:`, JSON.stringify((data as any)?.prices));
  }
}

async function ensureEntitlement(
  client: Awaited<ReturnType<typeof getUncachableRevenueCatClient>>,
  project: Project,
  lookupKey: string,
  displayName: string,
  productIds: string[],
): Promise<Entitlement> {
  const { data: existing, error } = await listEntitlements({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (error) throw new Error(`Failed to list entitlements: ${JSON.stringify(error)}`);

  let entitlement = existing.items?.find((e) => e.lookup_key === lookupKey);
  if (entitlement) {
    console.log(`  Entitlement '${lookupKey}' already exists: ${entitlement.id}`);
  } else {
    const { data: created, error: createErr } = await createEntitlement({
      client,
      path: { project_id: project.id },
      body: { lookup_key: lookupKey, display_name: displayName },
    });
    if (createErr) throw new Error(`Failed to create entitlement '${lookupKey}': ${JSON.stringify(createErr)}`);
    console.log(`  Created entitlement '${lookupKey}': ${created.id}`);
    entitlement = created;
  }

  const { error: attachErr } = await attachProductsToEntitlement({
    client,
    path: { project_id: project.id, entitlement_id: entitlement.id },
    body: { product_ids: productIds },
  });
  if (attachErr) {
    if (attachErr.type === "unprocessable_entity_error") {
      console.log(`  Products already attached to '${lookupKey}'`);
    } else {
      throw new Error(`Failed to attach products to '${lookupKey}': ${JSON.stringify(attachErr)}`);
    }
  } else {
    console.log(`  Attached products to '${lookupKey}'`);
  }

  return entitlement;
}

async function ensurePackage(
  client: Awaited<ReturnType<typeof getUncachableRevenueCatClient>>,
  project: Project,
  offering: Offering,
  lookupKey: string,
  displayName: string,
  products: { product_id: string }[],
): Promise<Package> {
  const { data: existing, error } = await listPackages({
    client,
    path: { project_id: project.id, offering_id: offering.id },
    query: { limit: 20 },
  });
  if (error) throw new Error(`Failed to list packages: ${JSON.stringify(error)}`);

  let pkg = existing.items?.find((p) => p.lookup_key === lookupKey);
  if (pkg) {
    console.log(`  Package '${lookupKey}' already exists: ${pkg.id}`);
  } else {
    const { data: created, error: createErr } = await createPackages({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      body: { lookup_key: lookupKey, display_name: displayName },
    });
    if (createErr) throw new Error(`Failed to create package '${lookupKey}': ${JSON.stringify(createErr)}`);
    console.log(`  Created package '${lookupKey}': ${created.id}`);
    pkg = created;
  }

  const { error: attachErr } = await attachProductsToPackage({
    client,
    path: { project_id: project.id, package_id: pkg.id },
    body: {
      products: products.map((p) => ({ ...p, eligibility_criteria: "all" as const })),
    },
  });
  if (attachErr) {
    if (
      attachErr.type === "unprocessable_entity_error" &&
      attachErr.message?.includes("Cannot attach product")
    ) {
      console.log(`  Package '${lookupKey}' products already attached`);
    } else {
      throw new Error(`Failed to attach products to package '${lookupKey}': ${JSON.stringify(attachErr)}`);
    }
  } else {
    console.log(`  Attached products to package '${lookupKey}'`);
  }

  return pkg;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seedRevenueCat() {
  console.log("=== Judith RevenueCat Seed ===\n");
  const client = await getUncachableRevenueCatClient();

  // ── 1. Project ──────────────────────────────────────────────────────────────
  console.log("1. Project…");
  let project: Project;
  const { data: projects, error: listProjectsErr } = await listProjects({
    client,
    query: { limit: 20 },
  });
  if (listProjectsErr) throw new Error(`Failed to list projects: ${JSON.stringify(listProjectsErr)}`);

  const existingProject = projects.items?.find((p) => p.name === PROJECT_NAME);
  if (existingProject) {
    console.log(`   Project already exists: ${existingProject.id}`);
    project = existingProject;
  } else {
    const { data: newProject, error: createErr } = await createProject({
      client,
      body: { name: PROJECT_NAME },
    });
    if (createErr) throw new Error(`Failed to create project: ${JSON.stringify(createErr)}`);
    console.log(`   Created project: ${newProject.id}`);
    project = newProject;
  }

  // ── 2. Apps ─────────────────────────────────────────────────────────────────
  console.log("\n2. Apps…");
  const { data: apps, error: listAppsErr } = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listAppsErr || !apps?.items?.length) throw new Error("No apps found");

  let testApp = apps.items.find((a) => a.type === "test_store");
  if (!testApp) throw new Error("No test store app found — expected RevenueCat to create one automatically");
  console.log(`   Test Store app: ${testApp.id}`);

  let appStoreApp: App | undefined = apps.items.find((a) => a.type === "app_store");
  if (!appStoreApp) {
    const { data: created, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: { name: APP_STORE_APP_NAME, type: "app_store", app_store: { bundle_id: APP_STORE_BUNDLE_ID } },
    });
    if (error) throw new Error(`Failed to create App Store app: ${JSON.stringify(error)}`);
    appStoreApp = created;
    console.log(`   Created App Store app: ${appStoreApp.id}`);
  } else {
    console.log(`   App Store app: ${appStoreApp.id}`);
  }

  let playStoreApp: App | undefined = apps.items.find((a) => a.type === "play_store");
  if (!playStoreApp) {
    const { data: created, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: { name: PLAY_STORE_APP_NAME, type: "play_store", play_store: { package_name: PLAY_STORE_PACKAGE_NAME } },
    });
    if (error) throw new Error(`Failed to create Play Store app: ${JSON.stringify(error)}`);
    playStoreApp = created;
    console.log(`   Created Play Store app: ${playStoreApp.id}`);
  } else {
    console.log(`   Play Store app: ${playStoreApp.id}`);
  }

  // ── 3. Products ─────────────────────────────────────────────────────────────
  console.log("\n3. Products…");

  const chatTest  = await ensureProduct(client, project, testApp,     "chat/test",       CHAT_PRODUCT_ID,      "Chat Ask",  true);
  const chatIos   = await ensureProduct(client, project, appStoreApp, "chat/ios",        CHAT_PRODUCT_ID,      "Chat Ask",  false);
  const chatPlay  = await ensureProduct(client, project, playStoreApp,"chat/play",       CHAT_PRODUCT_ID_PLAY, "Chat Ask",  false);

  const voiceTest = await ensureProduct(client, project, testApp,     "voice/test",      VOICE_PRODUCT_ID,     "Voice Ask", true);
  const voiceIos  = await ensureProduct(client, project, appStoreApp, "voice/ios",       VOICE_PRODUCT_ID,     "Voice Ask", false);
  const voicePlay = await ensureProduct(client, project, playStoreApp,"voice/play",      VOICE_PRODUCT_ID_PLAY,"Voice Ask", false);

  // ── 4. Test store prices ────────────────────────────────────────────────────
  console.log("\n4. Test store prices…");
  await setTestStorePrices(client, project, chatTest,  CHAT_PRICES,  "chat");
  await setTestStorePrices(client, project, voiceTest, VOICE_PRICES, "voice");

  // ── 5. Entitlements ─────────────────────────────────────────────────────────
  console.log("\n5. Entitlements…");
  await ensureEntitlement(client, project, CHAT_ENTITLEMENT_ID,  "Chat Ask",
    [chatTest.id, chatIos.id, chatPlay.id]);
  await ensureEntitlement(client, project, VOICE_ENTITLEMENT_ID, "Voice Ask",
    [voiceTest.id, voiceIos.id, voicePlay.id]);

  // ── 6. Offering ─────────────────────────────────────────────────────────────
  console.log("\n6. Offering…");
  const { data: offeringsData, error: listOfferingsErr } = await listOfferings({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listOfferingsErr) throw new Error(`Failed to list offerings: ${JSON.stringify(listOfferingsErr)}`);

  let offering: Offering | undefined = offeringsData.items?.find((o) => o.lookup_key === OFFERING_ID);
  if (offering) {
    console.log(`   Offering '${OFFERING_ID}' already exists: ${offering.id}`);
  } else {
    const { data: created, error } = await createOffering({
      client,
      path: { project_id: project.id },
      body: { lookup_key: OFFERING_ID, display_name: OFFERING_DISPLAY_NAME },
    });
    if (error) throw new Error(`Failed to create offering: ${JSON.stringify(error)}`);
    console.log(`   Created offering '${OFFERING_ID}': ${created.id}`);
    offering = created;
  }

  if (!offering.is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      body: { is_current: true },
    });
    if (error) throw new Error(`Failed to set offering as current: ${JSON.stringify(error)}`);
    console.log("   Set offering as current");
  }

  // ── 7. Packages ─────────────────────────────────────────────────────────────
  console.log("\n7. Packages…");
  await ensurePackage(client, project, offering, CHAT_PKG_ID, "Chat Ask",
    [{ product_id: chatTest.id }, { product_id: chatIos.id }, { product_id: chatPlay.id }]);
  await ensurePackage(client, project, offering, VOICE_PKG_ID, "Voice Ask",
    [{ product_id: voiceTest.id }, { product_id: voiceIos.id }, { product_id: voicePlay.id }]);

  // ── 8. API keys ─────────────────────────────────────────────────────────────
  console.log("\n8. API keys…");
  const fetchKeys = async (app: App, label: string) => {
    const { data, error } = await listAppPublicApiKeys({
      client,
      path: { project_id: project.id, app_id: app.id },
    });
    if (error) throw new Error(`Failed to fetch keys for ${label}: ${JSON.stringify(error)}`);
    return data?.items?.map((k) => k.key).join(", ") ?? "N/A";
  };

  const testKey  = await fetchKeys(testApp,     "test store");
  const iosKey   = await fetchKeys(appStoreApp, "App Store");
  const playKey  = await fetchKeys(playStoreApp,"Play Store");

  console.log("\n====================");
  console.log("Judith RevenueCat setup complete!");
  console.log("Project ID:                    ", project.id);
  console.log("Test Store App ID:             ", testApp.id);
  console.log("App Store App ID:              ", appStoreApp.id);
  console.log("Play Store App ID:             ", playStoreApp.id);
  console.log("\nSet these as Replit secrets:");
  console.log("EXPO_PUBLIC_REVENUECAT_TEST_API_KEY    =", testKey);
  console.log("EXPO_PUBLIC_REVENUECAT_API_KEY_IOS     =", iosKey);
  console.log("EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID =", playKey);
  console.log("REVENUECAT_PROJECT_ID                  =", project.id);
  console.log("REVENUECAT_TEST_STORE_APP_ID            =", testApp.id);
  console.log("REVENUECAT_APPLE_APP_STORE_APP_ID       =", appStoreApp.id);
  console.log("REVENUECAT_GOOGLE_PLAY_STORE_APP_ID     =", playStoreApp.id);
  console.log("====================\n");
}

seedRevenueCat().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
