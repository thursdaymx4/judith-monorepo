plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.app.judith.wear"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.app.judith"
        minSdk = 30
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    signingConfigs {
        // Reuse the phone app's Expo debug keystore so both apps share one
        // signing identity in DEBUG — needed for the Wear Data Layer to deliver
        // the payload + token between phone and watch during development.
        getByName("debug") {
            storeFile = file("debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
        // RELEASE signing. The keystore is NOT committed — supply it at build
        // time via ~/.gradle/gradle.properties or -P flags. It MUST be the same
        // key as the phone app's Play upload key so the shared com.app.judith
        // package links the two form factors in one Play app.
        //   JUDITH_WEAR_STORE_FILE, JUDITH_WEAR_STORE_PASSWORD,
        //   JUDITH_WEAR_KEY_ALIAS, JUDITH_WEAR_KEY_PASSWORD
        create("release") {
            val storePath = project.findProperty("JUDITH_WEAR_STORE_FILE") as String?
            if (storePath != null) {
                storeFile = file(storePath)
                storePassword = project.findProperty("JUDITH_WEAR_STORE_PASSWORD") as String?
                keyAlias = project.findProperty("JUDITH_WEAR_KEY_ALIAS") as String?
                keyPassword = project.findProperty("JUDITH_WEAR_KEY_PASSWORD") as String?
            }
        }
    }

    buildTypes {
        release {
            // Minify left OFF deliberately: the watch parses WatchPayload via
            // Gson reflection, which R8 would break without careful keep rules.
            // Enable later together with -keep rules for com.app.judith.wear.data.
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)

    // Core / lifecycle
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")

    // Compose UI
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material:material-icons-extended")
    debugImplementation("androidx.compose.ui:ui-tooling")

    // Wear Compose
    implementation("androidx.wear.compose:compose-material:1.4.1")
    implementation("androidx.wear.compose:compose-foundation:1.4.1")
    implementation("androidx.wear.compose:compose-navigation:1.4.1")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")

    // Networking + JSON
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.google.code.gson:gson:2.11.0")

    // Wear Data Layer
    implementation("com.google.android.gms:play-services-wearable:18.2.0")

    // Watch-face complications (data source services + update requester)
    implementation("androidx.wear.watchface:watchface-complications-data-source-ktx:1.2.1")
}
